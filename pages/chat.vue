<script setup lang="ts">
import tmi from 'tmi.js'

/* ════════════════════════════════════════════
   SETTINGS — โหลดจาก URL query params
   badge images รวมอยู่ใน settings.badgeImages แล้ว
════════════════════════════════════════════ */
const { settings, loadFromUrl } = useOverlaySettings()
onMounted(() => {
    loadFromUrl()
})

/* URL PARAM — ?ch=xxx override channel */
const route = useRoute()
const channelParam = computed(() =>
    (route.query.ch as string) || (route.query.channel as string) || settings.value.channel || 'ReienOkami'
)

/* CHAT STATE */
const chats = ref<{
    id: number
    user: string
    html: string
    badges: string[]
    nameColor: string
}[]>([])

/* CONNECTION STATUS */
const status = ref<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
const statusText = computed(() => ({
    connecting: `กำลังเชื่อมต่อ #${channelParam.value}…`,
    connected: '',
    disconnected: 'หลุดการเชื่อมต่อ — กำลัง reconnect…',
    error: 'เชื่อมต่อไม่ได้ กรุณาตรวจสอบ channel name',
}[status.value]))

/* ════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════ */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

// แปลง emote positions → <img> — sort จากท้ายก่อนเพื่อไม่ให้ index เลื่อน
function parseEmotes(message: string, emotes?: Record<string, string[]>): string {
    if (!emotes) return escapeHtml(message)

    const positions: { id: string; start: number; end: number }[] = []
    for (const [id, ranges] of Object.entries(emotes)) {
        for (const range of ranges) {
            const [start, end] = range.split('-').map(Number)
            positions.push({ id, start, end })
        }
    }
    positions.sort((a, b) => b.start - a.start)

    let result = message
    for (const { id, start, end } of positions) {
        const name = message.slice(start, end + 1)
        const img = `<img class="emote" src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0" alt="${escapeHtml(name)}" title="${escapeHtml(name)}">`
        result = result.slice(0, start) + img + result.slice(end + 1)
    }
    return result
}

/* ════════════════════════════════════════════
   BADGE PARSER
   ใช้รูปจาก settings.badgeImages
   รองรับ: local path, base64 data URL, CDN URL

   Twitch subscriber badge value format:
   - value = tier * 1000 + months
   - เช่น Tier1 3เดือน = "3", Tier2 6เดือน = "2006", Tier3 1ปี = "3012"
   - months = Number(value) % 1000   (tier1 value < 1000 ดังนั้น months = value ตรงๆ)

   เลือกรูป badge ตามระยะเวลา (months):
   - 0        → subscriber (default / tier fallback)
   - 1        → sub_1month
   - 2        → sub_2month
   - 3        → sub_3month
   - 6        → sub_6month
   - 9        → sub_9month
   - 12+      → sub_1year
════════════════════════════════════════════ */
function getSubscriberBadgeSrc(value: string): string {
    const bi = settings.value.badgeImages
    const months = Number(value) % 1000   // แยก months ออกจาก tier prefix

    if (months >= 12) return bi.sub_1year || bi.subscriber
    if (months >= 9)  return bi.sub_9month || bi.subscriber
    if (months >= 6)  return bi.sub_6month || bi.subscriber
    if (months >= 3)  return bi.sub_3month || bi.subscriber
    if (months >= 2)  return bi.sub_2month || bi.subscriber
    if (months >= 1)  return bi.sub_1month || bi.subscriber
    return bi.subscriber   // 0 months = เพิ่งซับ / fallback
}

function parseBadges(badges?: Record<string, string>): { icons: string[]; nameColor: string } {
    if (!badges) return { icons: [], nameColor: 'var(--color-default)' }

    const bi = settings.value.badgeImages

    let nameColor = 'var(--color-default)'
    if (badges.broadcaster) nameColor = 'var(--color-broadcaster)'
    else if (badges.moderator) nameColor = 'var(--color-moderator)'
    else if (badges.vip) nameColor = 'var(--color-vip)'
    else if (badges.subscriber) nameColor = 'var(--color-subscriber)'

    const icons: string[] = []

    for (const [key, value] of Object.entries(badges)) {
        let src = ''

        if (key === 'subscriber') {
            // เลือกรูปตามระยะเวลาการซับ
            src = getSubscriberBadgeSrc(value)
        } else {
            src = (bi as any)[key] || ''
        }

        if (src) {
            icons.push(`<img class="badge-img" src="${src}" alt="${key}" title="${key} ${value}">`)
        }
    }

    return { icons, nameColor }
}

/* ════════════════════════════════════════════
   TMI.JS — AUTO-RECONNECT
════════════════════════════════════════════ */
let client: tmi.Client | null = null
let reconnectTimer: ReturnType<typeof setTimeout>

function connect(channel: string) {
    if (client) {
        client.removeAllListeners()
        client.disconnect().catch(() => { })
        client = null
    }
    clearTimeout(reconnectTimer)
    status.value = 'connecting'

    client = new tmi.Client({ channels: [channel] })

    client.on('connected', () => { status.value = 'connected' })

    client.on('disconnected', (reason: string) => {
        console.warn('[TwitchChat] Disconnected:', reason)
        status.value = 'disconnected'
        reconnectTimer = setTimeout(() => connect(channel), 5000)
    })

    client.on('message', (_ch, tags, message) => {
        const { icons, nameColor } = parseBadges(tags.badges as Record<string, string>)
        chats.value.push({
            id: Date.now(),
            user: tags['display-name'] || tags.username || 'Unknown',
            html: parseEmotes(message, tags.emotes as any),
            badges: icons,
            nameColor,
        })
        const max = settings.value.maxMessages || 8
        if (chats.value.length > max) chats.value.shift()
    })

    client.connect().catch((err: unknown) => {
        console.error('[TwitchChat] Error:', err)
        status.value = 'error'
        reconnectTimer = setTimeout(() => connect(channel), 10000)
    })
}

onMounted(() => connect(channelParam.value))
watch(channelParam, (newCh) => connect(newCh))
onUnmounted(() => {
    clearTimeout(reconnectTimer)
    client?.removeAllListeners()
    client?.disconnect().catch(() => { })
})
</script>

<template>
    <div class="overlay-root">

        <!-- Connection status -->
        <Transition name="status">
            <div v-if="status !== 'connected'" class="status-badge" :class="status">
                <span class="status-dot" />
                {{ statusText }}
            </div>
        </Transition>

        <!-- Chat messages -->
        <TransitionGroup name="msg" tag="div" class="chat-list">
            <div v-for="msg in chats" :key="msg.id" class="chat-item">

                <div class="chat-header">
                    <span v-for="(badge, i) in msg.badges" :key="i" class="badge-slot" v-html="badge" />
                    <span class="username" :style="{ color: msg.nameColor }">
                        {{ msg.user }}
                    </span>
                </div>

                <div class="chat-bubble" v-html="msg.html" />

            </div>
        </TransitionGroup>

    </div>
</template>

<style scoped>
.overlay-root {
    width: var(--chat-width);
    min-height: 100vh;
    background: transparent;
    padding: 10px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    position: relative;
}

.status-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    font-size: 12px;
    font-family: var(--font-body);
    font-weight: 500;
    backdrop-filter: blur(12px);
}

.status-badge.connecting {
    background: rgba(30, 30, 50, 0.85);
    color: #94a3b8;
    border: 1px solid rgba(255, 255, 255, 0.08);
}

.status-badge.disconnected {
    background: rgba(40, 20, 10, 0.9);
    color: #fb923c;
    border: 1px solid rgba(251, 146, 60, 0.25);
}

.status-badge.error {
    background: rgba(40, 10, 10, 0.9);
    color: #f87171;
    border: 1px solid rgba(248, 113, 113, 0.25);
}

.status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    animation: pulse 1.5s ease-in-out infinite;
}

.connecting .status-dot {
    background: #94a3b8;
}

.disconnected .status-dot {
    background: #fb923c;
}

.error .status-dot {
    background: #f87171;
    animation: none;
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
        transform: scale(1);
    }

    50% {
        opacity: 0.4;
        transform: scale(0.8);
    }
}

.status-enter-active,
.status-leave-active {
    transition: opacity 0.3s, transform 0.3s;
}

.status-enter-from,
.status-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}

.chat-list {
    display: flex;
    flex-direction: column;
    gap: var(--msg-gap);
    position: relative;
}

.chat-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.chat-header {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    padding: 0 4px;
}

:deep(.badge-img) {
    width: var(--badge-size, 16px);
    height: var(--badge-size, 16px);
    object-fit: contain;
    vertical-align: middle;
    flex-shrink: 0;
}

.username {
    font-family: var(--font-display);
    font-size: var(--font-size-user);
    font-weight: 700;
    letter-spacing: 0.01em;
    line-height: 1;
}

.chat-bubble {
    background: var(--bubble-bg);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-left: 3px solid var(--accent-color);
    border-radius: 16px;
    padding: 10px 14px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    font-size: var(--font-size-msg);
    color: var(--text-color);
    line-height: 1.6;
    font-family: var(--font-body);
    overflow-wrap: anywhere;
    word-break: break-word;
    white-space: pre-wrap;
}

:deep(.emote) {
    width: var(--emote-size, 26px);
    height: var(--emote-size, 26px);
    object-fit: contain;
    vertical-align: middle;
    display: inline-block;
    margin: 0 2px;
}

.msg-enter-active {
    transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.msg-leave-active {
    transition: opacity 0.25s ease, transform 0.25s ease;
    position: absolute;
    width: 100%;
}

.msg-enter-from {
    opacity: 0;
    transform: translateY(12px) scale(0.97);
}

.msg-leave-to {
    opacity: 0;
    transform: translateX(-12px) scale(0.96);
}

.msg-move {
    transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
</style>