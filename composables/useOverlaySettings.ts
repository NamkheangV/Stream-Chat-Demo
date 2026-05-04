/**
 * composables/useOverlaySettings.ts
 *
 * ── วิธี sync settings → OBS ──
 * Settings page encode non-image settings ลงใน URL → user copy ไปวางใน OBS
 * Overlay page decode URL params → apply CSS vars ทันที
 * Badge images ไม่ผ่าน URL → เก็บใน localStorage แยก (ป้องกัน HTTP 431)
 *
 * ── Badge image strategy ──
 * 1. Default badges → ใช้รูปจาก /public/badges/ (asset ใน project)
 *    path จะถูก prefix ด้วย useNuxtApp().$config.app.baseURL อัตโนมัติ
 *    เพื่อรองรับ GitHub Pages ที่ deploy อยู่ใน sub-path เช่น /stream-chat-demo/
 * 2. Custom badges  → อัปโหลดจากหน้า /settings → แปลงเป็น Base64
 *    → บันทึกลง localStorage (BADGE_KEY) ไม่ผ่าน URL
 *
 * ── EventSub credentials strategy ──
 * twitchClientId และ twitchToken เก็บใน localStorage แยก (EVENTSUB_CRED_KEY)
 * ไม่ encode ลง URL เพื่อความปลอดภัย (ป้องกัน token รั่วใน URL)
 * OBS overlay โหลด credentials จาก localStorage โดยตรง
 */

export interface BadgeImages {
    broadcaster: string   // URL หรือ base64 data URL
    moderator:   string
    vip:         string
    subscriber:  string   // tier 1
    sub2:        string   // tier 2
    sub3:        string   // tier 3

    // subscriber ตามระยะเวลา
    sub_1month:  string
    sub_2month:  string
    sub_3month:  string
    sub_6month:  string
    sub_9month:  string
    sub_1year:   string
}

// ── Preview background mode ────────────────
export type PreviewBgMode = 'gradient' | 'solid' | 'image' | 'none'

export interface OverlaySettings {
    // ── Twitch ──────────────────────────────
    channel:          string

    // ── Twitch EventSub credentials ─────────
    // ใช้สำหรับ Follow alerts (EventSub WebSocket)
    // ⚠️  เก็บใน localStorage เท่านั้น ไม่ผ่าน URL
    twitchClientId:   string   // Twitch App Client ID
    twitchToken:      string   // OAuth Token (scope: moderator:read:followers)

    // ── Bubble ──────────────────────────────
    bubbleBgColor:    string
    bubbleOpacity:    number

    accentColor:      string
    accentOpacity:    number

    // ── Text ────────────────────────────────
    textColor:        string
    fontSizeMsg:      number
    fontSizeUser:     number

    // ── Layout ──────────────────────────────
    chatWidth:        number
    msgGap:           number
    maxMessages:      number

    /**
     * อายุของแต่ละข้อความ (วินาที)
     * 0 = ไม่ fade ออกอัตโนมัติ (ใช้แค่ maxMessages)
     * >0 = ลบข้อความออกหลังครบเวลา พร้อม CSS fade
     */
    msgLifetime:      number

    // ── Role colors ─────────────────────────
    colorBroadcaster: string
    colorModerator:   string
    colorVip:         string
    colorSubscriber:  string
    colorDefault:     string

    // ── Preview background (settings page only) ──
    previewBgMode:    PreviewBgMode
    previewBgColor:   string   // solid color หรือ gradient color 1
    previewBgColor2:  string   // gradient color 2
    previewBgAngle:   number   // gradient angle (deg)
    previewBgImage:   string   // base64 data URL (เก็บแยกใน PREVIEW_BG_KEY)

    // ── Badge images (URL หรือ base64) ──────
    badgeImages:      BadgeImages
}

// ── Default badge paths (รูปใน /public/badges/) ─────────────
const BADGE_FILENAMES = {
    broadcaster: 'broadcaster.svg',
    moderator:   'moderator.svg',
    vip:         'vip.svg',
    subscriber:  'sub1.svg',
    sub2:        'sub2.svg',
    sub3:        'sub3.svg',
    sub_1month:  'sub_1month.svg',
    sub_2month:  'sub_2month.svg',
    sub_3month:  'sub_3month.svg',
    sub_6month:  'sub_6month.svg',
    sub_9month:  'sub_9month.svg',
    sub_1year:   'sub_1year.svg',
} as const satisfies Record<keyof BadgeImages, string>

/** คืนค่า BadgeImages พร้อม baseURL prefix — เรียกใน client-side เท่านั้น */
export function getDefaultBadgeImages(): BadgeImages {
    let base = ''
    try {
        base = useNuxtApp().$config.app.baseURL ?? ''
        base = base.replace(/\/$/, '')
    } catch { /* นอก Nuxt context */ }

    const result = {} as BadgeImages
    for (const [key, filename] of Object.entries(BADGE_FILENAMES) as [keyof BadgeImages, string][]) {
        result[key] = `${base}/badges/${filename}`
    }
    return result
}

// ── static fallback สำหรับใช้นอก Nuxt context ──
export const DEFAULT_BADGE_IMAGES: BadgeImages = (() => {
    const result = {} as BadgeImages
    for (const [key, filename] of Object.entries(BADGE_FILENAMES) as [keyof BadgeImages, string][]) {
        result[key] = `/badges/${filename}`
    }
    return result
})()

// fallback เมื่อรูป local ไม่มี → ใช้ Twitch CDN
export const TWITCH_CDN_BADGES: BadgeImages = {
    broadcaster: 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/2',
    moderator:   'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2',
    vip:         'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/2',
    subscriber:  'https://static-cdn.jtvnw.net/badges/v1/0e6c1a38-98a9-4d8a-b8f4-8f6bbf5e09c2/2',
    sub2:        'https://static-cdn.jtvnw.net/badges/v1/0e6c1a38-98a9-4d8a-b8f4-8f6bbf5e09c2/2',
    sub3:        'https://static-cdn.jtvnw.net/badges/v1/0e6c1a38-98a9-4d8a-b8f4-8f6bbf5e09c2/2',
    sub_1month:  '',
    sub_2month:  '',
    sub_3month:  '',
    sub_6month:  '',
    sub_9month:  '',
    sub_1year:   '',
}

export const DEFAULT_SETTINGS: OverlaySettings = {
    channel:          'ReienOkami',
    twitchClientId:   '',
    twitchToken:      '',
    bubbleBgColor:    '#0a0c16',
    bubbleOpacity:    82,
    accentColor:      '#7ecfdc',
    accentOpacity:    55,
    textColor:        '#dde3ee',
    fontSizeMsg:      14,
    fontSizeUser:     13,
    chatWidth:        340,
    msgGap:           10,
    maxMessages:      8,
    msgLifetime:      0,
    colorBroadcaster: '#FFD700',
    colorModerator:   '#00E676',
    colorVip:         '#E040FB',
    colorSubscriber:  '#40C4FF',
    colorDefault:     '#FFFFFF',
    previewBgMode:    'solid',
    previewBgColor:   '#1a1a2e',
    previewBgColor2:  '#16213e',
    previewBgAngle:   135,
    previewBgImage:   '',
    badgeImages:      { ...DEFAULT_BADGE_IMAGES },
}

// ── Short param keys (non-sensitive settings เท่านั้น) ────────
// ⚠️  twitchClientId และ twitchToken ไม่อยู่ใน PARAM_MAP
//     → ไม่ถูก encode ลง URL → ปลอดภัย
const PARAM_MAP: Record<string, string> = {
    channel:          'ch',
    bubbleBgColor:    'bb',
    bubbleOpacity:    'bo',
    accentColor:      'ac',
    accentOpacity:    'ao',
    textColor:        'tc',
    fontSizeMsg:      'fm',
    fontSizeUser:     'fu',
    chatWidth:        'cw',
    msgGap:           'mg',
    maxMessages:      'mm',
    msgLifetime:      'ml',
    colorBroadcaster: 'cbr',
    colorModerator:   'cmo',
    colorVip:         'cv',
    colorSubscriber:  'cs',
    colorDefault:     'cd',
}

const REVERSE_MAP = Object.fromEntries(
    Object.entries(PARAM_MAP).map(([k, v]) => [v, k])
)

const NUMERIC_FIELDS = new Set([
    'bubbleOpacity', 'accentOpacity', 'fontSizeMsg', 'fontSizeUser',
    'chatWidth', 'msgGap', 'maxMessages', 'msgLifetime',
])

// ── hex → rgb ────────────────────────────────────────────────
function hexToRgb(hex: string) {
    const c = hex.replace('#', '')
    const n = parseInt(c, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// ── Apply CSS variables ──────────────────────────────────────
export function applyCssVars(s: OverlaySettings) {
    if (typeof document === 'undefined') return
    const root = document.documentElement

    const bg = hexToRgb(s.bubbleBgColor)
    root.style.setProperty('--bubble-bg', `rgba(${bg.r},${bg.g},${bg.b},${s.bubbleOpacity / 100})`)

    const ac = hexToRgb(s.accentColor)
    root.style.setProperty('--accent-color', `rgba(${ac.r},${ac.g},${ac.b},${s.accentOpacity / 100})`)

    root.style.setProperty('--text-color',       s.textColor)
    root.style.setProperty('--font-size-msg',    `${s.fontSizeMsg}px`)
    root.style.setProperty('--font-size-user',   `${s.fontSizeUser}px`)
    root.style.setProperty('--chat-width',       `${s.chatWidth}px`)
    root.style.setProperty('--msg-gap',          `${s.msgGap}px`)

    root.style.setProperty('--color-broadcaster', s.colorBroadcaster)
    root.style.setProperty('--color-moderator',   s.colorModerator)
    root.style.setProperty('--color-vip',         s.colorVip)
    root.style.setProperty('--color-subscriber',  s.colorSubscriber)
    root.style.setProperty('--color-default',     s.colorDefault)
}

// ── Encode settings → URL query string ──────────────────────
export function encodeSettingsToUrl(s: OverlaySettings): string {
    const params = new URLSearchParams()
    for (const [field, key] of Object.entries(PARAM_MAP)) {
        params.set(key, String((s as any)[field]))
    }
    return params.toString()
}

// ── Decode URL query string → settings ──────────────────────
export function decodeSettingsFromUrl(search: string): Partial<OverlaySettings> {
    const params = new URLSearchParams(search)
    const result: Partial<OverlaySettings> = {}

    for (const [key, raw] of params.entries()) {
        const field = REVERSE_MAP[key]
        if (!field) continue
        ;(result as any)[field] = NUMERIC_FIELDS.has(field) ? Number(raw) : raw
    }

    return result
}

// ── localStorage keys ────────────────────────────────────────
const STORAGE_KEY        = 'twitch-overlay-settings-v3'
const BADGE_KEY          = 'twitch-overlay-badges-v1'
const PREVIEW_BG_KEY     = 'twitch-overlay-preview-bg-v1'
/**
 * เก็บ EventSub credentials แยก key เพื่อ:
 * 1. ป้องกัน token รั่วใน URL
 * 2. ให้ OBS overlay โหลด credentials จาก localStorage
 *    โดยไม่ต้องผ่าน URL (เพราะ OBS browser source ใช้ browser เดียวกัน)
 */
const EVENTSUB_CRED_KEY  = 'twitch-overlay-eventsub-v1'

// ── Storage read/write ───────────────────────────────────────

function readStorage(): Omit<OverlaySettings, 'badgeImages' | 'twitchClientId' | 'twitchToken'> | null {
    if (typeof localStorage === 'undefined') return null
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        // drop sensitive fields ถ้าหลงมา
        const { badgeImages: _b, twitchClientId: _c, twitchToken: _t, ...rest } = parsed
        return { ...DEFAULT_SETTINGS, ...rest }
    } catch { return null }
}

function readBadgeStorage(): BadgeImages {
    const defaults = getDefaultBadgeImages()
    if (typeof localStorage === 'undefined') return defaults
    try {
        const raw = localStorage.getItem(BADGE_KEY)
        if (!raw) return defaults
        const parsed = JSON.parse(raw) as Partial<BadgeImages>
        return { ...defaults, ...parsed }
    } catch { return defaults }
}

function writeBadgeStorage(bi: BadgeImages) {
    if (typeof localStorage === 'undefined') return
    const custom: Partial<BadgeImages> = {}
    for (const [k, v] of Object.entries(bi) as [keyof BadgeImages, string][]) {
        if (v.startsWith('data:')) custom[k] = v
    }
    if (Object.keys(custom).length > 0) {
        localStorage.setItem(BADGE_KEY, JSON.stringify(custom))
    } else {
        localStorage.removeItem(BADGE_KEY)
    }
}

/** อ่าน EventSub credentials จาก localStorage แยก key */
function readEventSubCreds(): { clientId: string; token: string } {
    if (typeof localStorage === 'undefined') return { clientId: '', token: '' }
    try {
        const raw = localStorage.getItem(EVENTSUB_CRED_KEY)
        if (!raw) return { clientId: '', token: '' }
        const parsed = JSON.parse(raw)
        return {
            clientId: parsed?.clientId ?? '',
            token:    parsed?.token    ?? '',
        }
    } catch { return { clientId: '', token: '' } }
}

/** บันทึก EventSub credentials ลง localStorage แยก key */
function writeEventSubCreds(clientId: string, token: string) {
    if (typeof localStorage === 'undefined') return
    if (clientId || token) {
        localStorage.setItem(EVENTSUB_CRED_KEY, JSON.stringify({ clientId, token }))
    } else {
        localStorage.removeItem(EVENTSUB_CRED_KEY)
    }
}

function readPreviewBgImage(): string {
    if (typeof localStorage === 'undefined') return ''
    try { return localStorage.getItem(PREVIEW_BG_KEY) ?? '' } catch { return '' }
}

function writePreviewBgImage(img: string) {
    if (typeof localStorage === 'undefined') return
    if (img) {
        localStorage.setItem(PREVIEW_BG_KEY, img)
    } else {
        localStorage.removeItem(PREVIEW_BG_KEY)
    }
}

// ── Composable ───────────────────────────────────────────────
export function useOverlaySettings() {
    const settings = useState<OverlaySettings>('overlay-settings', () => ({
        ...DEFAULT_SETTINGS,
        badgeImages: getDefaultBadgeImages(),
    }))

    /** load() — หน้า /settings */
    function load() {
        const stored = readStorage()
        const badges = readBadgeStorage()
        const creds  = readEventSubCreds()
        settings.value = {
            ...(stored ?? DEFAULT_SETTINGS),
            badgeImages:    badges,
            twitchClientId: creds.clientId,
            twitchToken:    creds.token,
        }
        applyCssVars(settings.value)
    }

    /** save() — หน้า /settings */
    function save() {
        if (typeof localStorage !== 'undefined') {
            // บันทึก settings โดยไม่รวม badgeImages และ credentials
            const { badgeImages, twitchClientId, twitchToken, ...rest } = settings.value
            localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
            writeBadgeStorage(badgeImages)
            writeEventSubCreds(twitchClientId, twitchToken)
        }
        applyCssVars(settings.value)
    }

    /**
     * loadFromUrl() — หน้า /chat (OBS overlay)
     * โหลด settings จาก URL params + badge + credentials จาก localStorage
     * credentials ไม่ผ่าน URL เพื่อความปลอดภัย
     */
    function loadFromUrl() {
        if (typeof window === 'undefined') return
        const fromUrl = decodeSettingsFromUrl(window.location.search)
        const badges  = readBadgeStorage()
        const creds   = readEventSubCreds()
        settings.value = {
            ...DEFAULT_SETTINGS,
            ...fromUrl,
            badgeImages:    badges,
            twitchClientId: creds.clientId,
            twitchToken:    creds.token,
        }
        applyCssVars(settings.value)
    }

    /** buildObsUrl() — ไม่รวม credentials ใน URL */
    function buildObsUrl(base: string): string {
        return `${base}?${encodeSettingsToUrl(settings.value)}`
    }

    function reset() {
        settings.value = {
            ...DEFAULT_SETTINGS,
            badgeImages:    getDefaultBadgeImages(),
            twitchClientId: '',
            twitchToken:    '',
        }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(BADGE_KEY)
            localStorage.removeItem(EVENTSUB_CRED_KEY)
        }
        save()
    }

    return { settings, load, save, loadFromUrl, buildObsUrl, reset }
}