<script setup lang="ts">
/**
 * pages/chat/index.vue  — OBS Overlay
 *
 * ══════════════════════════════════════════════════════════════
 *  EVENT SOURCES
 * ══════════════════════════════════════════════════════════════
 *
 *  ① tmi.js  (Twitch IRC WebSocket)  — ไม่ต้องการ Token
 *     • message       → แชทปกติ
 *     • subscription  → sub ใหม่ / prime
 *     • resub         → ต่ออายุ (พร้อมจำนวนเดือนสะสม)
 *     • subgift       → gift sub ให้คนอื่น
 *     • submysterygift→ gift sub แบบสุ่ม (community gift)
 *     • raided        → raid เข้าช่อง
 *     • cheer         → ส่ง bits
 *
 *  ② Twitch EventSub  (WebSocket)  — ต้องการ Client ID + OAuth Token
 *     • channel.follow → ผู้ใช้ใหม่ติดตามช่อง
 *
 *     วิธีขอ Token (สำหรับ streamer ใช้เอง):
 *     https://id.twitch.tv/oauth2/authorize
 *       ?response_type=token
 *       &client_id=YOUR_CLIENT_ID
 *       &redirect_uri=http://localhost
 *       &scope=moderator:read:followers
 *
 *     แล้วนำ access_token จาก URL fragment มาใส่ใน Settings
 *
 * ══════════════════════════════════════════════════════════════
 *  ALERT TYPES และสีธีม
 * ══════════════════════════════════════════════════════════════
 *  follow   → 🌸  rose    #f43f5e
 *  raid     → ⚔️  amber   #f59e0b
 *  sub      → ⭐  cyan    accent color
 *  resub    → 💫  cyan    accent color  + milestone badge
 *  subgift  → 🎁  purple  #a855f7
 *  bits     → 💎  gold    #facc15  (tier emoji ตามจำนวน)
 */

import tmi from 'tmi.js'

/* ════════════════════════════════════════════
   SETTINGS
════════════════════════════════════════════ */
const { settings, loadFromUrl } = useOverlaySettings()
onMounted(() => loadFromUrl())

const route = useRoute()

/** channel name จาก URL query → settings → fallback */
const channelParam = computed(() =>
    (route.query.ch as string)
    || (route.query.channel as string)
    || settings.value.channel
    || 'ReienOkami'
)

/* ════════════════════════════════════════════
   TYPES
════════════════════════════════════════════ */
type ChatItem = {
    id:        number
    kind:      'chat'
    user:      string
    html:      string           // HTML string (emote img tags)
    badges:    string[]         // HTML string ของแต่ละ badge img
    nameColor: string           // CSS color
}

type AlertKind = 'follow' | 'sub' | 'resub' | 'subgift' | 'subgift-mass' | 'raid' | 'bits'

type AlertItem = {
    id:          number
    kind:        AlertKind
    user:        string         // display name ของผู้ทำ event

    // ── sub / resub ──────────────────────
    months?:     number         // จำนวนเดือนสะสม (resub)
    tier?:       string         // '1000' | '2000' | '3000' | 'Prime'
    isPrime?:    boolean        // sub ด้วย Prime Gaming

    // ── sub message (resub / sub) ────────
    message?:    string

    // ── subgift ──────────────────────────
    recipient?:  string         // ผู้รับ gift sub
    giftCount?:  number         // จำนวน gift (mystery gift)

    // ── raid ─────────────────────────────
    viewerCount?: number

    // ── bits ─────────────────────────────
    bits?:       number
}

type FeedItem = ChatItem | AlertItem

/* ════════════════════════════════════════════
   STATE
════════════════════════════════════════════ */
const feed = ref<FeedItem[]>([])

/** สถานะการเชื่อมต่อ IRC (tmi.js) */
const ircStatus = ref<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')

/**
 * สถานะ EventSub (follow alerts)
 * 'idle'       = ยังไม่ได้ตั้งค่า Client ID / Token
 * 'connecting' = กำลังเชื่อมต่อ
 * 'ready'      = ลงทะเบียน subscription สำเร็จ รอ follow event
 * 'error'      = เชื่อมต่อ/ลงทะเบียนไม่ได้
 */
const eventSubStatus = ref<'idle' | 'connecting' | 'ready' | 'error'>('idle')

const statusText = computed(() => {
    const irc: Record<string, string> = {
        connecting:   `กำลังเชื่อมต่อ #${channelParam.value}…`,
        connected:    '',
        disconnected: 'IRC หลุด — กำลัง reconnect…',
        error:        'IRC เชื่อมต่อไม่ได้',
    }
    return irc[ircStatus.value] || ''
})

const showStatus = computed(() => ircStatus.value !== 'connected')

/* ════════════════════════════════════════════
   HELPERS — HTML / TEXT
════════════════════════════════════════════ */

/** escape HTML entities เพื่อป้องกัน XSS */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

/**
 * แปลงข้อความ + emote positions จาก Twitch
 * → HTML string ที่มี <img> สำหรับแต่ละ emote
 *
 * ทำงานโดย:
 * 1. Twitch ส่ง emotes map:  { "emote_id": ["start-end", "start-end"] }
 * 2. เรียง position จากท้ายไปหน้า (reverse) เพื่อไม่ให้ index เลื่อน
 * 3. Replace แต่ละ emote range ด้วย <img> tag
 */
function parseEmotes(message: string, emotes?: Record<string, string[]>): string {
    if (!emotes) return escapeHtml(message)

    const positions: { id: string; start: number; end: number }[] = []
    for (const [id, ranges] of Object.entries(emotes)) {
        for (const range of ranges) {
            const [start, end] = range.split('-').map(Number)
            positions.push({ id, start, end })
        }
    }
    positions.sort((a, b) => b.start - a.start) // reverse order

    let result = message
    for (const { id, start, end } of positions) {
        const name = message.slice(start, end + 1)
        const img = `<img class="emote"
            src="https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/3.0"
            alt="${escapeHtml(name)}" title="${escapeHtml(name)}">`
        result = result.slice(0, start) + img + result.slice(end + 1)
    }
    return result
}

/* ════════════════════════════════════════════
   HELPERS — BADGE
════════════════════════════════════════════ */

/**
 * เลือก badge รูปสำหรับ subscriber ตามจำนวนเดือนสะสม
 * Twitch ส่ง badge value เป็น cumulative months (เช่น "6", "12", "1006")
 * กรณี value > 1000 หมายถึง tier 2/3 — ใช้ modulo 1000 เพื่อดึงเดือน
 */
function getSubscriberBadgeSrc(value: string): string {
    const bi = settings.value.badgeImages
    const months = Number(value) % 1000
    if (months >= 12) return bi.sub_1year  || bi.subscriber
    if (months >= 9)  return bi.sub_9month || bi.subscriber
    if (months >= 6)  return bi.sub_6month || bi.subscriber
    if (months >= 3)  return bi.sub_3month || bi.subscriber
    if (months >= 2)  return bi.sub_2month || bi.subscriber
    if (months >= 1)  return bi.sub_1month || bi.subscriber
    return bi.subscriber
}

/**
 * แปลง badges object จาก Twitch tags
 * → { icons: HTML[] , nameColor: CSS color }
 *
 * Priority สี username:  broadcaster > moderator > vip > subscriber > default
 */
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
        if (src) {
            icons.push(`<img class="badge-img" src="${src}" alt="${key}" title="${key} ${value}">`)
        }
    }
    return { icons, nameColor }
}

/* ════════════════════════════════════════════
   HELPERS — LABEL / DISPLAY
════════════════════════════════════════════ */

/** Twitch tier string → readable label */
function tierLabel(tier?: string, isPrime?: boolean): string {
    if (isPrime)            return 'Prime'
    if (tier === '2000')    return 'Tier 2'
    if (tier === '3000')    return 'Tier 3'
    return 'Tier 1'
}

/**
 * จำนวนเดือนสะสม → label milestone
 * ตรวจ milestone พิเศษ: 6, 12, 24, 36, ... เดือน
 */
function monthsLabel(months: number): string {
    if (months % 12 === 0 && months >= 12) return `${months / 12} ปี 🎊`
    if (months % 6  === 0 && months >= 6)  return `${months} เดือน ✨`
    return `${months} เดือน`
}

/**
 * จำนวน bits → emoji tier สำหรับแสดงใน alert icon
 * ใช้ Twitch standard tiers:
 *   1 bit    = ⬜ (gray)
 *   10 bits  = 🟢 (green)
 *   100 bits = 🔵 (blue)
 *   1000     = 🟣 (purple)
 *   5000     = 🔴 (red)
 *   10000    = 💎 (diamond)
 */
function bitsEmoji(bits: number): string {
    if (bits >= 10000) return '💎'
    if (bits >= 5000)  return '🔴'
    if (bits >= 1000)  return '🟣'
    if (bits >= 100)   return '🔵'
    if (bits >= 10)    return '🟢'
    return '⬜'
}

/** จำนวน bits → ชื่อ tier สำหรับ badge label */
function bitsTierName(bits: number): string {
    if (bits >= 10000) return 'DIAMOND'
    if (bits >= 5000)  return 'RED'
    if (bits >= 1000)  return 'PURPLE'
    if (bits >= 100)   return 'BLUE'
    if (bits >= 10)    return 'GREEN'
    return 'BITS'
}

/* ════════════════════════════════════════════
   FEED MANAGEMENT
════════════════════════════════════════════ */
let idCounter = 0
function nextId() { return ++idCounter }

/**
 * Set ของ id ที่กำลัง fade out อยู่
 * ใช้สำหรับ bind class .fading ลงบน element
 */
const fadingIds = ref<Set<number>>(new Set())

/** timers สำหรับ auto-expire — map id → setTimeout handle */
const expireTimers = new Map<number, ReturnType<typeof setTimeout>>()

/**
 * เพิ่ม item เข้า feed และตัดเก่าออกถ้าเกิน maxMessages
 * ถ้า msgLifetime > 0 → ตั้ง timer fade + ลบออกอัตโนมัติ
 */
function pushFeed(item: FeedItem) {
    feed.value.push(item)
    const max = settings.value.maxMessages || 8
    if (feed.value.length > max) {
        const removed = feed.value.shift()
        if (removed) cancelExpire(removed.id)
    }
    scheduleExpire(item.id)
}

/** ตั้ง timer ลบ item ออกตาม msgLifetime */
function scheduleExpire(id: number) {
    const lifetime = settings.value.msgLifetime
    if (!lifetime || lifetime <= 0) return

    const FADE_DURATION = 800 // ms — ต้องตรงกับ CSS transition

    const timer = setTimeout(() => {
        // เริ่ม fade: เพิ่ม class .fading
        fadingIds.value = new Set(fadingIds.value).add(id)

        // หลัง fade animation เสร็จ → ลบออกจาก feed
        setTimeout(() => {
            feed.value = feed.value.filter(i => i.id !== id)
            const next = new Set(fadingIds.value)
            next.delete(id)
            fadingIds.value = next
            expireTimers.delete(id)
        }, FADE_DURATION)
    }, lifetime * 1000)

    expireTimers.set(id, timer)
}

/** ยกเลิก timer ของ item (ถ้ามี) */
function cancelExpire(id: number) {
    const t = expireTimers.get(id)
    if (t !== undefined) {
        clearTimeout(t)
        expireTimers.delete(id)
    }
    if (fadingIds.value.has(id)) {
        const next = new Set(fadingIds.value)
        next.delete(id)
        fadingIds.value = next
    }
}

function pushAlert(alert: Omit<AlertItem, 'id'>) {
    pushFeed({ id: nextId(), ...alert })
}

/* ════════════════════════════════════════════
   LAYER 1 — tmi.js (IRC)
   ────────────────────────────────────────────
   เชื่อมต่อ Twitch IRC ผ่าน tmi.js
   รองรับ: chat, sub, resub, subgift, raid, cheer
   ไม่รองรับ: follow (ต้องใช้ EventSub)
════════════════════════════════════════════ */
let ircClient: tmi.Client | null = null
let ircReconnectTimer: ReturnType<typeof setTimeout>

function connectIrc(channel: string) {
    // cleanup client เดิมถ้ามี
    if (ircClient) {
        ircClient.removeAllListeners()
        ircClient.disconnect().catch(() => {})
        ircClient = null
    }
    clearTimeout(ircReconnectTimer)
    ircStatus.value = 'connecting'

    ircClient = new tmi.Client({ channels: [channel] })

    /* ─ Connected ─ */
    ircClient.on('connected', () => {
        console.info('[IRC] Connected to', channel)
        ircStatus.value = 'connected'
    })

    /* ─ Disconnected ─ */
    ircClient.on('disconnected', (reason: string) => {
        console.warn('[IRC] Disconnected:', reason)
        ircStatus.value = 'disconnected'
        ircReconnectTimer = setTimeout(() => connectIrc(channel), 5000)
    })

    /* ─ Chat message ─ */
    ircClient.on('message', (_ch, tags, message) => {
        const { icons, nameColor } = parseBadges(tags.badges as Record<string, string>)
        pushFeed({
            id:        nextId(),
            kind:      'chat',
            user:      tags['display-name'] || tags.username || 'Unknown',
            html:      parseEmotes(message, tags.emotes as any),
            badges:    icons,
            nameColor,
        })
    })

    /* ─ New Sub / Prime Sub ─ */
    ircClient.on('subscription', (_ch, username, method, message, tags) => {
        const plan: string = (method as any)?.plan || '1000'
        pushAlert({
            kind:    'sub',
            user:    tags?.['display-name'] || username,
            tier:    plan,
            isPrime: plan === 'Prime',
            message: message || undefined,
        })
    })

    /* ─ Resub (ต่ออายุ) ─ */
    ircClient.on('resub', (_ch, username, months, message, tags, methods) => {
        const plan: string = (methods as any)?.plan || '1000'
        pushAlert({
            kind:    'resub',
            user:    tags?.['display-name'] || username,
            months:  Number(months) || 1,
            tier:    plan,
            isPrime: plan === 'Prime',
            message: message || undefined,
        })
    })

    /* ─ Gift Sub (ให้คนอื่น 1 คน) ─ */
    ircClient.on('subgift', (_ch, username, _streakMonths, recipient, methods, tags) => {
        pushAlert({
            kind:      'subgift',
            user:      tags?.['display-name'] || username,
            recipient,
            tier:      (methods as any)?.plan || '1000',
        })
    })

    /* ─ Mystery Gift (gift หลายคนพร้อมกัน) ─ */
    ircClient.on('submysterygift', (_ch, username, giftCount, methods, tags) => {
        pushAlert({
            kind:      'subgift-mass',
            user:      tags?.['display-name'] || username,
            giftCount: Number(giftCount) || 1,
            tier:      (methods as any)?.plan || '1000',
        })
    })

    /* ─ Raid ─ */
    ircClient.on('raided', (_ch, username, viewers) => {
        pushAlert({
            kind:        'raid',
            user:        username,
            viewerCount: Number(viewers) || 0,
        })
    })

    /* ─ Bits / Cheer ─ */
    ircClient.on('cheer', (_ch, tags, message) => {
        pushAlert({
            kind:    'bits',
            user:    tags['display-name'] || tags.username || 'Anonymous',
            bits:    Number(tags.bits) || 0,
            message: message || undefined,
        })
    })

    ircClient.connect().catch((err: unknown) => {
        console.error('[IRC] Connection error:', err)
        ircStatus.value = 'error'
        ircReconnectTimer = setTimeout(() => connectIrc(channel), 10000)
    })
}

/* ════════════════════════════════════════════
   LAYER 2 — Twitch EventSub WebSocket
   ────────────────────────────────────────────
   ใช้สำหรับรับ Follow Event เท่านั้น
   (IRC ไม่รองรับ follow events)
   
   ขั้นตอน:
   1. GET /helix/users  → แปลง channel name → user_id
   2. เปิด WebSocket → wss://eventsub.wss.twitch.tv/ws
   3. รับ session_welcome → session_id
   4. POST /helix/eventsub/subscriptions  (type: channel.follow)
   5. รับ notification → push follow alert
   
   ต้องการ:
   - Client ID  (settings.twitchClientId)
   - OAuth Token ที่มี scope: moderator:read:followers
     (settings.twitchToken)
════════════════════════════════════════════ */
let eventSubWs: WebSocket | null = null
let eventSubReconnectTimer: ReturnType<typeof setTimeout>
let eventSubKeepaliveTimer: ReturnType<typeof setTimeout>

/** Twitch API base */
const TWITCH_API = 'https://api.twitch.tv/helix'
/** EventSub WebSocket endpoint */
const EVENTSUB_WS = 'wss://eventsub.wss.twitch.tv/ws'

/**
 * แปลง channel name → broadcaster user_id
 * จำเป็นสำหรับลงทะเบียน EventSub subscription
 */
async function fetchUserId(channel: string, clientId: string, token: string): Promise<string | null> {
    try {
        const res = await fetch(`${TWITCH_API}/users?login=${encodeURIComponent(channel)}`, {
            headers: {
                'Client-Id':     clientId,
                'Authorization': `Bearer ${token}`,
            },
        })
        if (!res.ok) {
            console.error('[EventSub] fetchUserId failed:', res.status, await res.text())
            return null
        }
        const json = await res.json()
        return json?.data?.[0]?.id ?? null
    } catch (err) {
        console.error('[EventSub] fetchUserId error:', err)
        return null
    }
}

/**
 * ลงทะเบียน channel.follow subscription กับ Twitch EventSub
 * ต้องการ session_id จาก welcome message และ broadcaster_user_id
 *
 * scope ที่ต้องการ: moderator:read:followers
 * moderator_user_id ต้องเป็น user_id ของเจ้าของ Token
 */
async function subscribeFollowEvent(
    sessionId:        string,
    broadcasterId:    string,
    clientId:         string,
    token:            string,
): Promise<boolean> {
    try {
        // ดึง user_id ของเจ้าของ token (ต้องเป็น moderator หรือ broadcaster เอง)
        const meRes = await fetch(`${TWITCH_API}/users`, {
            headers: {
                'Client-Id':     clientId,
                'Authorization': `Bearer ${token}`,
            },
        })
        const meJson = await meRes.json()
        const moderatorId: string = meJson?.data?.[0]?.id ?? broadcasterId

        const res = await fetch(`${TWITCH_API}/eventsub/subscriptions`, {
            method:  'POST',
            headers: {
                'Client-Id':     clientId,
                'Authorization': `Bearer ${token}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({
                type:      'channel.follow',
                version:   '2',
                condition: {
                    broadcaster_user_id: broadcasterId,
                    moderator_user_id:   moderatorId,
                },
                transport: {
                    method:     'websocket',
                    session_id: sessionId,
                },
            }),
        })

        if (!res.ok) {
            const errText = await res.text()
            console.error('[EventSub] subscribe failed:', res.status, errText)
            return false
        }
        console.info('[EventSub] channel.follow subscribed ✅')
        return true
    } catch (err) {
        console.error('[EventSub] subscribe error:', err)
        return false
    }
}

/**
 * เปิด EventSub WebSocket connection
 * จัดการ reconnect อัตโนมัติถ้าหลุด
 */
function connectEventSub(channel: string) {
    const clientId = settings.value.twitchClientId?.trim()
    const token    = settings.value.twitchToken?.trim()

    // ถ้าไม่มี credentials → ข้าม (ไม่ error)
    if (!clientId || !token) {
        eventSubStatus.value = 'idle'
        console.info('[EventSub] No credentials — follow alerts disabled')
        return
    }

    // cleanup connection เดิม
    if (eventSubWs) {
        eventSubWs.onclose = null
        eventSubWs.close()
        eventSubWs = null
    }
    clearTimeout(eventSubReconnectTimer)
    clearTimeout(eventSubKeepaliveTimer)
    eventSubStatus.value = 'connecting'

    const ws = new WebSocket(EVENTSUB_WS)
    eventSubWs = ws

    ws.onopen = () => {
        console.info('[EventSub] WebSocket opened')
    }

    ws.onmessage = async (event: MessageEvent) => {
        let msg: any
        try { msg = JSON.parse(event.data) } catch { return }

        const type    = msg?.metadata?.message_type
        const payload = msg?.payload

        /* ── session_welcome: ได้ session_id แล้ว ── */
        if (type === 'session_welcome') {
            const sessionId      = payload?.session?.id
            const keepaliveSecs  = payload?.session?.keepalive_timeout_seconds ?? 10

            console.info('[EventSub] session_welcome, id:', sessionId)

            // ตั้ง keepalive watchdog
            // ถ้าไม่ได้รับ keepalive หรือ notification ภายใน timeout → reconnect
            resetKeepalive(keepaliveSecs + 5, () => {
                console.warn('[EventSub] Keepalive timeout — reconnecting')
                connectEventSub(channel)
            })

            // แปลง channel name → user_id แล้วลงทะเบียน
            const userId = await fetchUserId(channel, clientId!, token!)
            if (!userId) {
                console.error('[EventSub] Cannot resolve channel user_id')
                eventSubStatus.value = 'error'
                return
            }

            const ok = await subscribeFollowEvent(sessionId, userId, clientId!, token!)
            eventSubStatus.value = ok ? 'ready' : 'error'
        }

        /* ── session_keepalive: รีเซ็ต watchdog ── */
        else if (type === 'session_keepalive') {
            const keepaliveSecs = payload?.session?.keepalive_timeout_seconds ?? 10
            resetKeepalive(keepaliveSecs + 5, () => connectEventSub(channel))
        }

        /* ── notification: event จริง ── */
        else if (type === 'notification') {
            resetKeepalive(15, () => connectEventSub(channel))
            const subType = msg?.metadata?.subscription_type

            if (subType === 'channel.follow') {
                const follower = payload?.event?.user_name || payload?.event?.user_login || 'Someone'
                console.info('[EventSub] New follower:', follower)
                pushAlert({ kind: 'follow', user: follower })
            }
        }

        /* ── session_reconnect: Twitch ขอให้ reconnect ── */
        else if (type === 'session_reconnect') {
            const newUrl = payload?.session?.reconnect_url
            console.info('[EventSub] session_reconnect →', newUrl)
            if (newUrl) connectEventSubToUrl(newUrl, channel, clientId!, token!)
        }

        /* ── revocation: subscription ถูกยกเลิก ── */
        else if (type === 'revocation') {
            console.warn('[EventSub] Subscription revoked:', payload?.subscription?.status)
            eventSubStatus.value = 'error'
        }
    }

    ws.onerror = (err) => {
        console.error('[EventSub] WebSocket error:', err)
    }

    ws.onclose = (ev) => {
        console.warn('[EventSub] WebSocket closed:', ev.code, ev.reason)
        clearTimeout(eventSubKeepaliveTimer)
        if (eventSubStatus.value !== 'idle') {
            eventSubStatus.value = 'connecting'
            eventSubReconnectTimer = setTimeout(() => connectEventSub(channel), 5000)
        }
    }
}

/**
 * reconnect ไปยัง URL ใหม่ที่ Twitch กำหนด (session_reconnect)
 * ต้องไม่ปิด connection เดิมจนกว่าจะ welcome บน connection ใหม่
 */
async function connectEventSubToUrl(
    url:       string,
    channel:   string,
    clientId:  string,
    token:     string,
) {
    const oldWs = eventSubWs
    const ws    = new WebSocket(url)
    eventSubWs  = ws

    ws.onmessage = async (event: MessageEvent) => {
        let msg: any
        try { msg = JSON.parse(event.data) } catch { return }

        if (msg?.metadata?.message_type === 'session_welcome') {
            // ปิด connection เดิมหลังจาก welcome
            if (oldWs) { oldWs.onclose = null; oldWs.close() }
            // ส่ง event ไปที่ handler หลัก
            eventSubWs = ws
            ws.onmessage = (e) => {
                // forward ไป handler ปกติ (trick: re-dispatch)
                connectEventSub(channel)
            }
        }
    }

    ws.onerror = () => connectEventSub(channel)
}

/** รีเซ็ต keepalive watchdog timer */
function resetKeepalive(seconds: number, onTimeout: () => void) {
    clearTimeout(eventSubKeepaliveTimer)
    eventSubKeepaliveTimer = setTimeout(onTimeout, seconds * 1000)
}

/* ════════════════════════════════════════════
   LIFECYCLE
════════════════════════════════════════════ */
onMounted(() => {
    connectIrc(channelParam.value)
    connectEventSub(channelParam.value)
})

/** เปลี่ยน channel → reconnect ทั้งสอง layer */
watch(channelParam, (newCh) => {
    connectIrc(newCh)
    connectEventSub(newCh)
})

/** cleanup ทุก connection เมื่อ unmount */
onUnmounted(() => {
    clearTimeout(ircReconnectTimer)
    clearTimeout(eventSubReconnectTimer)
    clearTimeout(eventSubKeepaliveTimer)

    // ยกเลิก expire timers ทั้งหมด
    for (const t of expireTimers.values()) clearTimeout(t)
    expireTimers.clear()

    ircClient?.removeAllListeners()
    ircClient?.disconnect().catch(() => {})

    if (eventSubWs) {
        eventSubWs.onclose = null
        eventSubWs.close()
    }
})
</script>

<template>
    <div class="overlay-root">

        <!-- ── Connection Status Badge ── -->
        <Transition name="status">
            <div v-if="showStatus" class="status-badge" :class="ircStatus">
                <span class="status-dot" />
                {{ statusText }}
            </div>
        </Transition>

        <!-- ── EventSub Status (แสดงเฉพาะ error) ── -->
        <Transition name="status">
            <div v-if="eventSubStatus === 'error'" class="status-badge eventsub-error"
                style="top: 50px; font-size: 11px;">
                <span class="status-dot" style="background:#f87171; animation:none" />
                Follow alerts: ไม่สามารถเชื่อมต่อ EventSub ได้
            </div>
        </Transition>

        <!-- ── Feed ── -->
        <TransitionGroup name="msg" tag="div" class="chat-list">
            <template v-for="item in feed" :key="item.id">

                <!-- ════ CHAT MESSAGE ════ -->
                <div v-if="item.kind === 'chat'" class="chat-item" :class="{ fading: fadingIds.has(item.id) }">
                    <div class="chat-header">
                        <span
                            v-for="(badge, i) in (item as ChatItem).badges"
                            :key="i"
                            class="badge-slot"
                            v-html="badge"
                        />
                        <span class="username" :style="{ color: (item as ChatItem).nameColor }">
                            {{ item.user }}
                        </span>
                    </div>
                    <div class="chat-bubble" v-html="(item as ChatItem).html" />
                </div>

                <!-- ════ FOLLOW ALERT ════ -->
                <!--
                    Follow จาก EventSub — ต้องการ Client ID + Token
                    ธีมสี: Rose #f43f5e
                -->
                <div v-else-if="item.kind === 'follow'" class="alert-card alert-follow" :class="{ fading: fadingIds.has(item.id) }">
                    <div class="alert-icon-wrap follow-icon-wrap">
                        <span class="alert-icon">🌸</span>
                    </div>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">ติดตามช่องแล้ว! ขอบคุณมากนะครับ 💕</span>
                    </div>
                    <div class="alert-right">
                        <span class="alert-badge follow-badge">FOLLOW</span>
                    </div>
                </div>

                <!-- ════ RAID ALERT ════ -->
                <!--
                    Raid จาก IRC (tmi.js 'raided' event)
                    ธีมสี: Amber #f59e0b
                -->
                <div v-else-if="item.kind === 'raid'" class="alert-card alert-raid" :class="{ fading: fadingIds.has(item.id) }">
                    <div class="alert-icon-wrap raid-icon-wrap">
                        <span class="alert-icon">⚔️</span>
                    </div>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            Raid เข้ามา
                            <strong>{{ (item as AlertItem).viewerCount?.toLocaleString() }}</strong>
                            คน!
                        </span>
                    </div>
                    <div class="alert-right">
                        <span class="alert-badge raid-badge">RAID</span>
                        <span class="alert-count">{{ (item as AlertItem).viewerCount?.toLocaleString() }}</span>
                    </div>
                </div>

                <!-- ════ NEW SUB ALERT ════ -->
                <!--
                    Sub ใหม่ / Prime Sub จาก IRC ('subscription' event)
                    ธีมสี: Cyan (accent color)
                -->
                <div v-else-if="item.kind === 'sub'" class="alert-card alert-sub" :class="{ fading: fadingIds.has(item.id) }">
                    <div class="alert-icon-wrap sub-icon-wrap">
                        <span class="alert-icon">{{ (item as AlertItem).isPrime ? '👑' : '⭐' }}</span>
                    </div>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            สมัครสมาชิกใหม่
                            <em class="tier-tag">{{ tierLabel((item as AlertItem).tier, (item as AlertItem).isPrime) }}</em>!
                        </span>
                        <span v-if="(item as AlertItem).message" class="alert-sub-msg">
                            "{{ (item as AlertItem).message }}"
                        </span>
                    </div>
                    <div class="alert-right">
                        <span class="alert-badge sub-badge">
                            {{ (item as AlertItem).isPrime ? 'PRIME' : 'NEW SUB' }}
                        </span>
                    </div>
                </div>

                <!-- ════ RESUB ALERT ════ -->
                <!--
                    ต่ออายุสมาชิก จาก IRC ('resub' event)
                    แสดงจำนวนเดือนสะสม + milestone badge ถ้าครบ 6, 12, 24... เดือน
                    ธีมสี: Cyan (accent color)
                -->
                <div v-else-if="item.kind === 'resub'" class="alert-card alert-sub alert-resub" :class="{ fading: fadingIds.has(item.id) }">
                    <div class="alert-icon-wrap sub-icon-wrap">
                        <span class="alert-icon">💫</span>
                    </div>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            ต่ออายุ
                            <em class="tier-tag">{{ tierLabel((item as AlertItem).tier, (item as AlertItem).isPrime) }}</em>
                            ครบ
                            <strong>{{ monthsLabel((item as AlertItem).months ?? 0) }}</strong>!
                        </span>
                        <span v-if="(item as AlertItem).message" class="alert-sub-msg">
                            "{{ (item as AlertItem).message }}"
                        </span>
                    </div>
                    <div class="alert-right">
                        <span class="alert-badge resub-badge">RESUB</span>
                        <!-- milestone badge สำหรับ 6, 12, 24 เดือน -->
                        <span
                            v-if="(item as AlertItem).months && (item as AlertItem).months! % 6 === 0"
                            class="milestone-badge"
                        >
                            {{ (item as AlertItem).months! % 12 === 0 ? '🎂' : '🎖️' }}
                            {{ (item as AlertItem).months! >= 12
                                ? `${(item as AlertItem).months! / 12}yr`
                                : `${(item as AlertItem).months!}mo` }}
                        </span>
                    </div>
                </div>

                <!-- ════ GIFT SUB ALERT (1 คน) ════ -->
                <!--
                    Gift Sub ให้คนใดคนหนึ่ง จาก IRC ('subgift' event)
                    ธีมสี: Purple #a855f7
                -->
                <div v-else-if="item.kind === 'subgift'" class="alert-card alert-gift" :class="{ fading: fadingIds.has(item.id) }">
                    <div class="alert-icon-wrap gift-icon-wrap">
                        <span class="alert-icon">🎁</span>
                    </div>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            ให้ Gift Sub
                            <em class="tier-tag">{{ tierLabel((item as AlertItem).tier) }}</em>
                            แก่ <strong>{{ (item as AlertItem).recipient }}</strong>!
                        </span>
                    </div>
                    <div class="alert-right">
                        <span class="alert-badge gift-badge">GIFT</span>
                    </div>
                </div>

                <!-- ════ MYSTERY GIFT SUB ALERT (หลายคน) ════ -->
                <!--
                    Community Gift Sub จาก IRC ('submysterygift' event)
                    ส่ง gift หลายๆ คนพร้อมกัน
                    ธีมสี: Purple #a855f7
                -->
                <div v-else-if="item.kind === 'subgift-mass'" class="alert-card alert-gift alert-gift-mass" :class="{ fading: fadingIds.has(item.id) }">
                    <div class="alert-icon-wrap gift-icon-wrap">
                        <span class="alert-icon">🎊</span>
                    </div>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            Gift Sub
                            <em class="tier-tag">{{ tierLabel((item as AlertItem).tier) }}</em>
                            จำนวน
                            <strong>{{ (item as AlertItem).giftCount }}</strong>
                            ราย!
                        </span>
                    </div>
                    <div class="alert-right">
                        <span class="alert-badge gift-badge">GIFT ×{{ (item as AlertItem).giftCount }}</span>
                    </div>
                </div>

                <!-- ════ BITS / CHEER ALERT ════ -->
                <!--
                    Bits จาก IRC ('cheer' event)
                    Icon และสี badge เปลี่ยนตาม tier ของจำนวน bits
                    ธีมสี: Gold #facc15
                -->
                <div v-else-if="item.kind === 'bits'" class="alert-card alert-bits" :class="{ fading: fadingIds.has(item.id) }">
                    <div class="alert-icon-wrap bits-icon-wrap">
                        <span class="alert-icon">{{ bitsEmoji((item as AlertItem).bits ?? 0) }}</span>
                    </div>
                    <div class="alert-body">
                        <span class="alert-user">{{ item.user }}</span>
                        <span class="alert-msg">
                            Cheer
                            <strong>{{ (item as AlertItem).bits?.toLocaleString() }}</strong>
                            Bits!
                        </span>
                        <span v-if="(item as AlertItem).message" class="alert-sub-msg">
                            "{{ (item as AlertItem).message }}"
                        </span>
                    </div>
                    <div class="alert-right">
                        <span class="alert-badge bits-badge">{{ bitsTierName((item as AlertItem).bits ?? 0) }}</span>
                        <span class="bits-count">{{ (item as AlertItem).bits?.toLocaleString() }}</span>
                    </div>
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
    z-index: 10;
}
.status-badge.connecting   { background: rgba(30,30,50,0.85); color:#94a3b8; border:1px solid rgba(255,255,255,0.08); }
.status-badge.disconnected { background: rgba(40,20,10,0.9);  color:#fb923c; border:1px solid rgba(251,146,60,0.25); }
.status-badge.error        { background: rgba(40,10,10,0.9);  color:#f87171; border:1px solid rgba(248,113,113,0.25); }
.status-badge.eventsub-error { background: rgba(40,10,10,0.85); color:#f87171; border:1px solid rgba(248,113,113,0.2); }

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

/* ════════════════════════════════════════════
   CHAT ITEM
════════════════════════════════════════════ */
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
   ALERT CARDS — BASE
════════════════════════════════════════════ */
.alert-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.35);
    position: relative;
    overflow: hidden;
}

/* shimmer sweep animation — แสดงความ "live" */
.alert-card::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
        105deg,
        transparent 40%,
        rgba(255,255,255,0.055) 50%,
        transparent 60%
    );
    background-size: 200% 100%;
    animation: shimmer 2.4s ease-in-out infinite;
    pointer-events: none;
}

@keyframes shimmer {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
}

/* ── Icon wrap (วงกลมหลัง emoji) ── */
.alert-icon-wrap {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.alert-icon {
    font-size: 20px;
    line-height: 1;
}

/* ── Body ── */
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

.tier-tag {
    font-style: normal;
    opacity: 0.7;
    font-size: 0.9em;
}

.alert-msg strong { font-weight: 700; }

.alert-sub-msg {
    font-family: var(--font-body);
    font-size: calc(var(--font-size-msg) - 2px);
    color: var(--text-color);
    opacity: 0.6;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-style: italic;
}

/* ── Right side (badges + count) ── */
.alert-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
}

.alert-badge {
    font-size: 9px;
    font-weight: 800;
    letter-spacing: 0.1em;
    padding: 3px 7px;
    border-radius: 6px;
    white-space: nowrap;
}

/* จำนวน count (viewers, bits) */
.alert-count,
.bits-count {
    font-family: var(--font-display);
    font-size: 11px;
    font-weight: 700;
    opacity: 0.6;
}

/* ── Milestone badge (resub) ── */
.milestone-badge {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.7);
    white-space: nowrap;
}

/* ════════════════════════════════════════════
   PER-EVENT COLOR THEMES
════════════════════════════════════════════ */

/* ── Follow — Rose ── */
.alert-follow {
    background: rgba(244, 63, 94, 0.13);
    border-color: rgba(244, 63, 94, 0.28);
    border-left: 3px solid #f43f5e;
}
.alert-follow .alert-user { color: #fb7185; }
.follow-icon-wrap { background: rgba(244,63,94,0.15); }
.follow-badge { background: rgba(244,63,94,0.25); color: #fb7185; }

/* ── Raid — Amber ── */
.alert-raid {
    background: rgba(245, 158, 11, 0.13);
    border-color: rgba(245, 158, 11, 0.28);
    border-left: 3px solid #f59e0b;
}
.alert-raid .alert-user { color: #fbbf24; }
.raid-icon-wrap { background: rgba(245,158,11,0.15); }
.raid-badge { background: rgba(245,158,11,0.25); color: #fbbf24; }
.alert-raid .alert-count { color: #fbbf24; }

/* ── Sub / Resub — Cyan (accent) ── */
.alert-sub {
    background: rgba(126, 207, 220, 0.11);
    border-color: rgba(126, 207, 220, 0.26);
    border-left: 3px solid var(--accent-color);
}
.alert-sub .alert-user { color: var(--accent-color, #7ecfdc); }
.sub-icon-wrap  { background: rgba(126,207,220,0.15); }
.sub-badge      { background: rgba(126,207,220,0.22); color: #7ecfdc; }
.resub-badge    { background: rgba(126,207,220,0.22); color: #7ecfdc; }

/* Resub เพิ่ม glow เล็กน้อย */
.alert-resub {
    box-shadow: 0 4px 24px rgba(126,207,220,0.12), 0 0 0 1px rgba(126,207,220,0.05);
}

/* ── Gift Sub — Purple ── */
.alert-gift {
    background: rgba(168, 85, 247, 0.13);
    border-color: rgba(168, 85, 247, 0.28);
    border-left: 3px solid #a855f7;
}
.alert-gift .alert-user { color: #c084fc; }
.gift-icon-wrap { background: rgba(168,85,247,0.15); }
.gift-badge { background: rgba(168,85,247,0.25); color: #c084fc; }

/* Mass gift — เพิ่ม intensity */
.alert-gift-mass {
    background: rgba(168, 85, 247, 0.18);
    border-color: rgba(168, 85, 247, 0.38);
    box-shadow: 0 4px 24px rgba(168,85,247,0.15);
}

/* ── Bits — Gold ── */
.alert-bits {
    background: rgba(250, 204, 21, 0.11);
    border-color: rgba(250, 204, 21, 0.26);
    border-left: 3px solid #facc15;
}
.alert-bits .alert-user { color: #facc15; }
.bits-icon-wrap { background: rgba(250,204,21,0.15); }
.bits-badge     { background: rgba(250,204,21,0.22); color: #facc15; }
.bits-count     { color: #facc15; }

/* ════════════════════════════════════════════
   FEED TRANSITIONS
════════════════════════════════════════════ */
.msg-enter-active {
    transition: opacity 0.4s cubic-bezier(0.16,1,0.3,1),
                transform 0.4s cubic-bezier(0.16,1,0.3,1);
}
.msg-leave-active {
    transition: opacity 0.25s ease, transform 0.25s ease;
    position: absolute;
    width: 100%;
}
.msg-enter-from { opacity: 0; transform: translateY(14px) scale(0.97); }
.msg-leave-to   { opacity: 0; transform: translateX(-14px) scale(0.96); }
.msg-move       { transition: transform 0.35s cubic-bezier(0.16,1,0.3,1); }

/* ── Lifetime fade-out ───────────────────────────────────────
   .fading เพิ่มเมื่อ msgLifetime ครบ → item ค่อย ๆ จางลง
   ต้องใช้ transition แยกจาก TransitionGroup เพราะ item
   ยังอยู่ใน DOM ระหว่าง fade (ก่อนจะถูก filter ออก)
   ─────────────────────────────────────────────────────────── */
.chat-item,
.alert-card {
    transition: opacity 0.8s ease, transform 0.8s ease;
}

.chat-item.fading,
.alert-card.fading {
    opacity: 0 !important;
    transform: translateY(-6px) scale(0.97);
    pointer-events: none;
}
</style>