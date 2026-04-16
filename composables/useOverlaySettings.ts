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
 */

export interface BadgeImages {
    broadcaster: string   // URL หรือ base64 data URL
    moderator: string
    vip: string
    subscriber: string   // tier 1
    sub2: string   // tier 2
    sub3: string   // tier 3

    // subscriber ตามระยะเวลา
    sub_1month: string
    sub_2month: string
    sub_3month: string
    sub_6month: string
    sub_9month: string
    sub_1year: string

    // turbo: string
    // partner: string
    // prime: string
    // staff: string
    // 'sub-gifter': string
}

// ── Preview background mode ────────────────
export type PreviewBgMode = 'gradient' | 'solid' | 'image' | 'none'

export interface OverlaySettings {
    // ── Twitch ──────────────────────────────
    channel: string

    // ── Bubble ──────────────────────────────
    bubbleBgColor: string
    bubbleOpacity: number

    accentColor: string
    accentOpacity: number

    // ── Text ────────────────────────────────
    textColor: string
    fontSizeMsg: number
    fontSizeUser: number

    // ── Layout ──────────────────────────────
    chatWidth: number
    msgGap: number
    maxMessages: number

    // ── Role colors ─────────────────────────
    colorBroadcaster: string
    colorModerator: string
    colorVip: string
    colorSubscriber: string
    colorDefault: string

    // ── Preview background (settings page only) ──
    previewBgMode: PreviewBgMode
    previewBgColor: string   // solid color หรือ gradient color 1
    previewBgColor2: string   // gradient color 2
    previewBgAngle: number   // gradient angle (deg)
    previewBgImage: string   // base64 data URL (เก็บแยกใน PREVIEW_BG_KEY)

    // ── Badge images (URL หรือ base64) ──────
    // เก็บเป็น JSON string ใน URL param "bi"
    badgeImages: BadgeImages
}

// ── Default badge paths (รูปใน /public/badges/) ─────────────
// ใช้ฟังก์ชันแทน const เพื่อ prefix baseURL ตอน runtime
// รองรับ GitHub Pages ที่ deploy ใน sub-path เช่น /stream-chat-demo/badges/xxx.svg
const BADGE_FILENAMES = {
    broadcaster: 'broadcaster.svg',
    moderator: 'moderator.svg',
    vip: 'vip.svg',
    subscriber: 'sub1.svg',
    sub2: 'sub2.svg',
    sub3: 'sub3.svg',
    sub_1month: 'sub_1month.svg',
    sub_2month: 'sub_2month.svg',
    sub_3month: 'sub_3month.svg',
    sub_6month: 'sub_6month.svg',
    sub_9month: 'sub_9month.svg',
    sub_1year: 'sub_1year.svg',
} as const satisfies Record<keyof BadgeImages, string>

/** คืนค่า BadgeImages พร้อม baseURL prefix — เรียกใน client-side เท่านั้น */
export function getDefaultBadgeImages(): BadgeImages {
    // useNuxtApp ใช้ได้เฉพาะใน Nuxt context (client)
    // ถ้าเรียกนอก context (เช่น unit test) ให้ใช้ '' แทน
    let base = ''
    try {
        base = useNuxtApp().$config.app.baseURL ?? ''
        // ตัด trailing slash ออก เพื่อ join กับ /badges/xxx ได้สะอาด
        base = base.replace(/\/$/, '')
    } catch { /* นอก Nuxt context */ }
    const result = {} as BadgeImages
    for (const [key, filename] of Object.entries(BADGE_FILENAMES) as [keyof BadgeImages, string][]) {
        result[key] = `${base}/badges/${filename}`
    }
    return result
}

// ── static fallback สำหรับใช้นอก Nuxt context (เช่น DEFAULT_SETTINGS) ──
// ตอน runtime จริง getDefaultBadgeImages() จะถูกเรียกแทนเสมอ
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
    moderator: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2',
    vip: 'https://static-cdn.jtvnw.net/badges/v1/b817aba4-fad8-49e2-b88a-7cc744dfa6ec/2',
    subscriber: 'https://static-cdn.jtvnw.net/badges/v1/0e6c1a38-98a9-4d8a-b8f4-8f6bbf5e09c2/2',
    sub2: 'https://static-cdn.jtvnw.net/badges/v1/0e6c1a38-98a9-4d8a-b8f4-8f6bbf5e09c2/2',
    sub3: 'https://static-cdn.jtvnw.net/badges/v1/0e6c1a38-98a9-4d8a-b8f4-8f6bbf5e09c2/2',
    sub_1month: '',
    sub_2month: '',
    sub_3month: '',
    sub_6month: '',
    sub_9month: '',
    sub_1year: '',
    // turbo: 'https://static-cdn.jtvnw.net/badges/v1/bd444ec6-8f34-4bf9-91f4-af1e3428d80f/2',
    // partner: 'https://static-cdn.jtvnw.net/badges/v1/d12a2e27-16f6-41d0-ab77-b780518f00a3/2',
    // prime: 'https://static-cdn.jtvnw.net/badges/v1/bbbe0db0-a598-423e-86d0-f9fb98ca1933/2',
    // staff: 'https://static-cdn.jtvnw.net/badges/v1/d97c37bd-a6f5-4c38-8f57-4e4bef88af34/2',
    // 'sub-gifter': 'https://static-cdn.jtvnw.net/badges/v1/f1d8486f-eb2e-4553-b44f-4d614617afc1/2',
}

export const DEFAULT_SETTINGS: OverlaySettings = {
    channel: 'ReienOkami',
    bubbleBgColor: '#0a0c16',
    bubbleOpacity: 82,
    accentColor: '#7ecfdc',
    accentOpacity: 55,
    textColor: '#dde3ee',
    fontSizeMsg: 14,
    fontSizeUser: 13,
    chatWidth: 340,
    msgGap: 10,
    maxMessages: 8,
    colorBroadcaster: '#FFD700',
    colorModerator: '#00E676',
    colorVip: '#E040FB',
    colorSubscriber: '#40C4FF',
    colorDefault: '#FFFFFF',
    previewBgMode: 'solid',
    previewBgColor: '#1a1a2e',
    previewBgColor2: '#16213e',
    previewBgAngle: 135,
    previewBgImage: '',
    badgeImages: { ...DEFAULT_BADGE_IMAGES },
}

// ── Short param keys ─────────────────────────────────────────
const PARAM_MAP: Record<string, string> = {
    channel: 'ch',
    bubbleBgColor: 'bb',
    bubbleOpacity: 'bo',
    accentColor: 'ac',
    accentOpacity: 'ao',
    textColor: 'tc',
    fontSizeMsg: 'fm',
    fontSizeUser: 'fu',
    chatWidth: 'cw',
    msgGap: 'mg',
    maxMessages: 'mm',
    colorBroadcaster: 'cbr',
    colorModerator: 'cmo',
    colorVip: 'cv',
    colorSubscriber: 'cs',
    colorDefault: 'cd',
    // badgeImages encode เป็น JSON แล้ว compress → param "bi"
}

const REVERSE_MAP = Object.fromEntries(
    Object.entries(PARAM_MAP).map(([k, v]) => [v, k])
)

const NUMERIC_FIELDS = new Set([
    'bubbleOpacity', 'accentOpacity', 'fontSizeMsg', 'fontSizeUser',
    'chatWidth', 'msgGap', 'maxMessages',
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

    root.style.setProperty('--text-color', s.textColor)
    root.style.setProperty('--font-size-msg', `${s.fontSizeMsg}px`)
    root.style.setProperty('--font-size-user', `${s.fontSizeUser}px`)
    root.style.setProperty('--chat-width', `${s.chatWidth}px`)
    root.style.setProperty('--msg-gap', `${s.msgGap}px`)

    root.style.setProperty('--color-broadcaster', s.colorBroadcaster)
    root.style.setProperty('--color-moderator', s.colorModerator)
    root.style.setProperty('--color-vip', s.colorVip)
    root.style.setProperty('--color-subscriber', s.colorSubscriber)
    root.style.setProperty('--color-default', s.colorDefault)
}

// ── Encode settings → URL query string ──────────────────────
// badgeImages ไม่ encode ลง URL อีกต่อไป → เก็บใน localStorage แยก (BADGE_KEY)
// เพื่อป้องกัน HTTP 431 Request Header Fields Too Large
export function encodeSettingsToUrl(s: OverlaySettings): string {
    const params = new URLSearchParams()
    for (const [field, key] of Object.entries(PARAM_MAP)) {
        params.set(key, String((s as any)[field]))
    }
    return params.toString()
}

// ── Decode URL query string → settings ──────────────────────
// badge ไม่อยู่ใน URL แล้ว — โหลดแยกผ่าน readBadgeStorage()
export function decodeSettingsFromUrl(search: string): Partial<OverlaySettings> {
    const params = new URLSearchParams(search)
    const result: Partial<OverlaySettings> = {}

    for (const [key, raw] of params.entries()) {
        const field = REVERSE_MAP[key]
        if (!field) continue
            ; (result as any)[field] = NUMERIC_FIELDS.has(field) ? Number(raw) : raw
    }

    return result
}

// ── localStorage ─────────────────────────────────────────────
// แยก key สำหรับ settings (ไม่มี badge) และ badge images
// เพื่อป้องกัน HTTP 431 — badge ไม่ผ่าน URL เด็ดขาด
const STORAGE_KEY = 'twitch-overlay-settings-v3'   // bump version เพื่อ clear cache เก่า
const BADGE_KEY = 'twitch-overlay-badges-v1'
const PREVIEW_BG_KEY = 'twitch-overlay-preview-bg-v1'   // เก็บ base64 image แยก (อาจใหญ่มาก)

/** อ่าน settings (ไม่รวม badge) จาก localStorage */
function readStorage(): Omit<OverlaySettings, 'badgeImages'> | null {
    if (typeof localStorage === 'undefined') return null
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        const { badgeImages: _drop, ...rest } = parsed   // drop badge ถ้าหลงมาจาก version เก่า
        return { ...DEFAULT_SETTINGS, ...rest }
    } catch { return null }
}

/** อ่าน badge images จาก localStorage แยก key
 *  merge กับ getDefaultBadgeImages() เพื่อให้ได้ path ที่มี baseURL ถูกต้อง */
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

/** บันทึก badge images ลง localStorage แยก key
 *  บันทึกเฉพาะ custom badges (base64) — ข้าม default path เพื่อประหยัด space
 *  เปรียบเทียบกับ filename แทน full path เพื่อไม่ให้ baseURL ต่างกันทำให้ custom หาย */
function writeBadgeStorage(bi: BadgeImages) {
    if (typeof localStorage === 'undefined') return
    const custom: Partial<BadgeImages> = {}
    for (const [k, v] of Object.entries(bi) as [keyof BadgeImages, string][]) {
        // เก็บเฉพาะ base64 data URL (custom upload) เท่านั้น
        if (v.startsWith('data:')) custom[k] = v
    }
    if (Object.keys(custom).length > 0) {
        localStorage.setItem(BADGE_KEY, JSON.stringify(custom))
    } else {
        localStorage.removeItem(BADGE_KEY)
    }
}

/** อ่าน preview background image (base64) จาก localStorage */
function readPreviewBgImage(): string {
    if (typeof localStorage === 'undefined') return ''
    try { return localStorage.getItem(PREVIEW_BG_KEY) ?? '' } catch { return '' }
}

/** บันทึก preview background image ลง localStorage แยก key */
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

    /** load() — หน้า /settings: โหลดจาก localStorage (settings + badge แยก key) */
    function load() {
        const stored = readStorage()
        const badges = readBadgeStorage()   // merge default (พร้อม baseURL) + custom จาก localStorage
        settings.value = {
            ...(stored ?? DEFAULT_SETTINGS),
            badgeImages: badges,
        }
        applyCssVars(settings.value)
    }

    /** save() — หน้า /settings: บันทึก settings + badge แยก key */
    function save() {
        if (typeof localStorage !== 'undefined') {
            // บันทึก settings โดยไม่รวม badgeImages
            const { badgeImages, ...rest } = settings.value
            localStorage.setItem(STORAGE_KEY, JSON.stringify(rest))
            writeBadgeStorage(badgeImages)
        }
        applyCssVars(settings.value)
    }

    /**
     * loadFromUrl() — หน้า / (OBS overlay)
     * โหลด settings จาก URL params + badge จาก localStorage
     * badge ไม่ผ่าน URL → ไม่เกิด HTTP 431
     */
    function loadFromUrl() {
        if (typeof window === 'undefined') return
        const fromUrl = decodeSettingsFromUrl(window.location.search)
        const badges = readBadgeStorage()
        settings.value = {
            ...DEFAULT_SETTINGS,
            ...fromUrl,
            badgeImages: badges,   // badge มาจาก localStorage เสมอ
        }
        applyCssVars(settings.value)
    }

    /** buildObsUrl() — URL มีแค่ non-image settings → ปลอดภัย ไม่เกิน header limit */
    function buildObsUrl(base: string): string {
        return `${base}?${encodeSettingsToUrl(settings.value)}`
    }

    function reset() {
        settings.value = { ...DEFAULT_SETTINGS, badgeImages: getDefaultBadgeImages() }
        if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(BADGE_KEY)
        }
        save()
    }

    return { settings, load, save, loadFromUrl, buildObsUrl, reset }
}