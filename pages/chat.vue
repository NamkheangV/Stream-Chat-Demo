<script setup lang="ts">
import tmi from 'tmi.js'

/* ════════════════════════════════════════════
   SETTINGS
════════════════════════════════════════════ */
const { settings, loadFromUrl } = useOverlaySettings()
onMounted(() => loadFromUrl())

const route = useRoute()
const channelParam = computed(() =>
    (route.query.ch as string) || (route.query.channel as string) || settings.value.channel || 'ReienOkami'
)

/* ════════════════════════════════════════════
   TYPES
════════════════════════════════════════════ */
type ChatItem = {
    id: number
    kind: 'chat'
    user: string
    html: string
    badges: string[]
    nameColor: string
}

type AlertKind = 'follow' | 'sub' | 'resub' | 'subgift' | 'raid' | 'bits'

type AlertItem = {
    id: number
    kind: AlertKind
    user: string
    // sub / resub
    months?: number
    tier?: string
    // resub message
    message?: string
    // subgift
    recipient?: string
    giftCount?: number
    // raid
    viewerCount?: number
    // bits
    bits?: number
}

type FeedItem = ChatItem | AlertItem

/* ════════════════════════════════════════════
   STATE
════════════════════════════════════════════ */
const feed = ref<FeedItem[]>([])

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

function getSubscriberBadgeSrc(value: string): string {
    const bi = settings.value.badgeImages
    const months = Number(value) % 1000
    if (months >= 12) return bi.sub_1year || bi.subscriber
    if (months >= 9)  return bi.sub_9month || bi.subscriber
    if (months >= 6)  return bi.sub_6month || bi.subscriber
    if (months >= 3)  return bi.sub_3month || bi.subscriber
    if (months >= 2)  return bi.sub_2month || bi.subscriber
    if (months >= 1)  return bi.sub_1month || bi.subscriber
    return bi.subscriber
}

function parseBadges(badges?: Record<string, string>): { icons: string[]; nameColor: string } {
    if (!badges) return { icons: [], nameColor: 'var(--color-default)' }
    const bi = settings.value.badgeImages
    let nameColor = 'var(--color-default)'
    if (badges.broadcaster)     nameColor = 'var(--color-broadcaster)'
    else if (badges.moderator)  nameColor = 'var(--color-moderator)'
    else if (badges.vip)        nameColor = 'var(--color-vip)'
    else if (badges.subscriber) nameColor = 'var(--color-subscriber)'
    const icons: string[] = []
    for (const [key, value] of Object.entries(badges)) {
        const src = key === 'subscriber'
            ? getSubscriberBadgeSrc(value)
            : (bi as any)[key] || ''
        if (src) icons.push(`<img class="badge-img" src="${src}" alt="${key}" title="${key} ${value}">`)
    }
    return { icons, nameColor }
}

/** แปลง tier string จาก Twitch → label */
function tierLabel(tier?: string): string {
    if (tier === '2000') return 'Tier 2'
    if (tier === '3000') return 'Tier 3'
    return 'Tier 1'
}

/** แปลง cumulative months → ป้าย milestone */
function monthsLabel(months: number): string {
    if (months >= 12 && months % 12 === 0) return `${months / 12} ปี`
    return `${months} เดือน`
}

/** แปลง bits → ป้าย emoji tier */
function bitsEmoji(bits: number): string {
    if (bits >= 10000) return '💎'
    if (bits >= 5000)  return '🔴'
    if (bits >= 1000)  return '🟣'
    if (bits >= 100)   return '🔵'
    if (bits >= 10)    return '🟢'
    return '⬜'
}

/* ════════════════════════════════════════════
   FEED MANAGEMENT
════════════════════════════════════════════ */
let idCounter = 0
function nextId() { return ++idCounter }

function pushFeed(item: FeedItem) {
    feed.value.push(item)
    const max = settings.value.maxMessages || 8
    if (feed.value.length > max) feed.value.shift()
}

function pushAlert(alert: Omit<AlertItem, 'id'>) {
    pushFeed({ id: nextId(), ...alert })
}

/* ════════════════════════════════════════════
   TMI.JS — EVENTS
════════════════════════════════════════════ */
let client: tmi.Client | null = null
let reconnectTimer: ReturnType<typeof setTimeout>

function connect(channel: string) {
    if (client) {
        client.removeAllListeners()
        client.disconnect().catch(() => {})
        client = null
    }
    clearTimeout(reconnectTimer)
    status.value = 'connecting'

    client = new tmi.Client({ channels: [channel] })

    /* ── Connected ── */
    client.on('connected', () => { status.value = 'connected' })

    /* ── Disconnected ── */
    client.on('disconnected', (reason: string) => {
        console.warn('[TwitchChat] Disconnected:', reason)
        status.value = 'disconnected'
        reconnectTimer = setTimeout(() => connect(channel), 5000)
    })

    /* ── Chat message ── */
    client.on('message', (_ch, tags, message) => {
        const { icons, nameColor } = parseBadges(tags.badges as Record<string, string>)
        pushFeed({
            id: nextId(),
            kind: 'chat',
            user: tags['display-name'] || tags.username || 'Unknown',
            html: parseEmotes(message, tags.emotes as any),
            badges: icons,
            nameColor,
        })
    })

    /* ── Follow ── */
    client.on('raided', (ch, username, viewers) => {
        pushAlert({
            kind: 'raid',
            user: username,
            viewerCount: Number(viewers) || 0,
        })
    })

    /* ── Sub (new / prime) ── */
    client.on('subscription', (_ch, username, method, message, tags) => {
        pushAlert({
            kind: 'sub',
            user: tags?.['display-name'] || username,
            tier: (method as any)?.plan || '1000',
            message: message || undefined,
        })
    })

    /* ── Resub ── */
    client.on('resub', (_ch, username, months, message, tags, methods) => {
        pushAlert({
            kind: 'resub',
            user: tags?.['display-name'] || username,
            months: Number(months) || 1,
            tier: (methods as any)?.plan || '1000',
            message: message || undefined,
        })
    })

    /* ── Sub gift ── */
    client.on('subgift', (_ch, username, streakMonths, recipient, methods, tags) => {
        pushAlert({
            kind: 'subgift',
            user: tags?.['display-name'] || username,
            recipient,
            tier: (methods as any)?.plan || '1000',
        })
    })

    /* ── Community sub gift (mystery gift) ── */
    client.on('submysterygift', (_ch, username, giftCount, methods, tags) => {
        pushAlert({
            kind: 'subgift',
            user: tags?.['display-name'] || username,
            giftCount: Number(giftCount) || 1,
            tier: (methods as any)?.plan || '1000',
        })
    })

    /* ── Bits / Cheer ── */
    client.on('cheer', (_ch, tags, message) => {
        pushAlert({
            kind: 'bits',
            user: tags['display-name'] || tags.username || 'Anonymous',
            bits: Number(tags.bits) || 0,
            message: message || undefined,
        })
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
    client?.disconnect().catch(() => {})
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

        <!-- Feed -->
        <TransitionGroup name="msg" tag="div" class="chat-list">
            <template v-for="item in feed" :key="item.id">

                <!-- ── Regular chat message ── -->
                <div v-if="item.kind === 'chat'" class="chat-item">
                    <div class="chat-header">
                        <span v-for="(badge, i) in (item as any).badges" :key="i" class="badge-slot" v-html="badge" />
                        <span class="username" :style="{ color: (item as any).nameColor }">
                            {{ item.user }}
                        </span>
                    </div>
                    <div class="chat-bubble" v-html="(item as any).html" />
                </div>

                <!-- ── Follow alert ── -->
                <div v-else-if="item.kind === 'follow'" class="alert-card alert-follow">
                    <span class="alert-icon">🌸</span>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">ติดตามช่องแล้ว!</span>
                    </div>
                </div>

                <!-- ── Raid alert ── -->
                <div v-else-if="item.kind === 'raid'" class="alert-card alert-raid">
                    <span class="alert-icon">⚔️</span>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            Raid มา {{ (item as any).viewerCount?.toLocaleString() }} คน!
                        </span>
                    </div>
                    <span class="alert-badge raid-badge">RAID</span>
                </div>

                <!-- ── New sub alert ── -->
                <div v-else-if="item.kind === 'sub'" class="alert-card alert-sub">
                    <span class="alert-icon">⭐</span>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            สมัครสมาชิกใหม่
                            <em>{{ tierLabel((item as any).tier) }}</em>!
                        </span>
                        <span v-if="(item as any).message" class="alert-sub-msg">
                            "{{ (item as any).message }}"
                        </span>
                    </div>
                    <span class="alert-badge sub-badge">NEW SUB</span>
                </div>

                <!-- ── Resub alert ── -->
                <div v-else-if="item.kind === 'resub'" class="alert-card alert-sub">
                    <span class="alert-icon">💫</span>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            ต่ออายุ
                            <em>{{ tierLabel((item as any).tier) }}</em>
                            ครบ <strong>{{ monthsLabel((item as any).months ?? 0) }}</strong>!
                        </span>
                        <span v-if="(item as any).message" class="alert-sub-msg">
                            "{{ (item as any).message }}"
                        </span>
                    </div>
                    <span class="alert-badge resub-badge">RESUB</span>
                </div>

                <!-- ── Sub gift alert ── -->
                <div v-else-if="item.kind === 'subgift'" class="alert-card alert-gift">
                    <span class="alert-icon">🎁</span>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span v-if="(item as any).recipient" class="alert-msg">
                            ให้ Gift Sub
                            <em>{{ tierLabel((item as any).tier) }}</em>
                            แก่ <strong>{{ (item as any).recipient }}</strong>!
                        </span>
                        <span v-else class="alert-msg">
                            Gift Sub
                            <em>{{ tierLabel((item as any).tier) }}</em>
                            จำนวน <strong>{{ (item as any).giftCount }}</strong> ราย!
                        </span>
                    </div>
                    <span class="alert-badge gift-badge">GIFT</span>
                </div>

                <!-- ── Bits / Cheer alert ── -->
                <div v-else-if="item.kind === 'bits'" class="alert-card alert-bits">
                    <span class="alert-icon">{{ bitsEmoji((item as any).bits ?? 0) }}</span>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            Cheer <strong>{{ (item as any).bits?.toLocaleString() }}</strong> Bits!
                        </span>
                        <span v-if="(item as any).message" class="alert-sub-msg">
                            "{{ (item as any).message }}"
                        </span>
                    </div>
                    <span class="alert-badge bits-badge">BITS</span>
                </div>

            </template>
        </TransitionGroup>

    </div>
</template>

<style scoped>
/* ════════════════════════════════════════════
   ROOT
════════════════════════════════════════════ */
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

/* ════════════════════════════════════════════
   CONNECTION STATUS
════════════════════════════════════════════ */
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
.status-badge.connecting   { background: rgba(30,30,50,0.85); color:#94a3b8; border:1px solid rgba(255,255,255,0.08); }
.status-badge.disconnected { background: rgba(40,20,10,0.9);  color:#fb923c; border:1px solid rgba(251,146,60,0.25); }
.status-badge.error        { background: rgba(40,10,10,0.9);  color:#f87171; border:1px solid rgba(248,113,113,0.25); }

.status-dot {
    width: 7px; height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    animation: pulse 1.5s ease-in-out infinite;
}
.connecting .status-dot   { background: #94a3b8; }
.disconnected .status-dot { background: #fb923c; }
.error .status-dot        { background: #f87171; animation: none; }

@keyframes pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%     { opacity:0.4; transform:scale(0.8); }
}

.status-enter-active, .status-leave-active { transition: opacity 0.3s, transform 0.3s; }
.status-enter-from, .status-leave-to       { opacity:0; transform:translateY(-6px); }

/* ════════════════════════════════════════════
   FEED LIST
════════════════════════════════════════════ */
.chat-list {
    display: flex;
    flex-direction: column;
    gap: var(--msg-gap);
    position: relative;
}

/* ── Chat item ── */
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
    border: 1px solid rgba(255,255,255,0.07);
    border-left: 3px solid var(--accent-color);
    border-radius: 16px;
    padding: 10px 14px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
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

/* ════════════════════════════════════════════
   ALERT CARDS
════════════════════════════════════════════ */
.alert-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    position: relative;
    overflow: hidden;
}

/* shimmer sweep animation */
.alert-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg,
        transparent 40%,
        rgba(255,255,255,0.06) 50%,
        transparent 60%);
    background-size: 200% 100%;
    animation: shimmer 2.2s ease-in-out infinite;
    pointer-events: none;
}

@keyframes shimmer {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
}

.alert-icon {
    font-size: 22px;
    line-height: 1;
    flex-shrink: 0;
    filter: drop-shadow(0 0 6px currentColor);
}

.alert-body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
}

.alert-user {
    font-family: var(--font-display);
    font-size: var(--font-size-user);
    font-weight: 800;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.alert-msg {
    font-family: var(--font-body);
    font-size: calc(var(--font-size-msg) - 1px);
    color: var(--text-color);
    line-height: 1.4;
}

.alert-msg em {
    font-style: normal;
    opacity: 0.75;
}

.alert-msg strong {
    font-weight: 700;
}

.alert-sub-msg {
    font-family: var(--font-body);
    font-size: calc(var(--font-size-msg) - 2px);
    color: var(--text-color);
    opacity: 0.65;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.alert-badge {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.1em;
    padding: 3px 7px;
    border-radius: 6px;
    flex-shrink: 0;
    align-self: flex-start;
}

/* ── Per-event colour themes ── */

/* Follow — rose */
.alert-follow {
    background: rgba(244, 63, 94, 0.14);
    border-color: rgba(244, 63, 94, 0.3);
    border-left: 3px solid #f43f5e;
}
.alert-follow .alert-user { color: #fb7185; }

/* Raid — amber */
.alert-raid {
    background: rgba(245, 158, 11, 0.14);
    border-color: rgba(245, 158, 11, 0.3);
    border-left: 3px solid #f59e0b;
}
.alert-raid .alert-user { color: #fbbf24; }
.raid-badge { background: rgba(245,158,11,0.25); color: #fbbf24; }

/* Sub / Resub — cyan (accent) */
.alert-sub {
    background: rgba(126, 207, 220, 0.12);
    border-color: rgba(126, 207, 220, 0.28);
    border-left: 3px solid var(--accent-color);
}
.alert-sub .alert-user { color: var(--accent-color, #7ecfdc); }
.sub-badge   { background: rgba(126,207,220,0.2); color: #7ecfdc; }
.resub-badge { background: rgba(126,207,220,0.2); color: #7ecfdc; }

/* Sub gift — purple */
.alert-gift {
    background: rgba(168, 85, 247, 0.14);
    border-color: rgba(168, 85, 247, 0.3);
    border-left: 3px solid #a855f7;
}
.alert-gift .alert-user { color: #c084fc; }
.gift-badge { background: rgba(168,85,247,0.25); color: #c084fc; }

/* Bits — yellow-gold */
.alert-bits {
    background: rgba(250, 204, 21, 0.12);
    border-color: rgba(250, 204, 21, 0.28);
    border-left: 3px solid #facc15;
}
.alert-bits .alert-user { color: #facc15; }
.bits-badge { background: rgba(250,204,21,0.22); color: #facc15; }

/* ════════════════════════════════════════════
   TRANSITIONS
════════════════════════════════════════════ */
.msg-enter-active {
    transition: opacity 0.4s cubic-bezier(0.16,1,0.3,1), transform 0.4s cubic-bezier(0.16,1,0.3,1);
}
.msg-leave-active {
    transition: opacity 0.25s ease, transform 0.25s ease;
    position: absolute;
    width: 100%;
}
.msg-enter-from { opacity: 0; transform: translateY(12px) scale(0.97); }
.msg-leave-to   { opacity: 0; transform: translateX(-12px) scale(0.96); }
.msg-move       { transition: transform 0.35s cubic-bezier(0.16,1,0.3,1); }
</style>