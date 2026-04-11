/**
 * composables/useOverlaySettings.ts
 *
 * ── วิธี sync settings → OBS ──
 *
 * OBS Browser Source คือ Chromium แยก instance
 * ไม่สามารถ share localStorage กับ browser ที่เปิดหน้า /settings ได้
 *
 * วิธีที่ใช้: URL Query Params
 * Settings page encode ทุก setting ลงใน URL → user copy ไปวางใน OBS
 * Overlay page decode URL params → apply CSS vars ทันที
 *
 * ตัวอย่าง URL:
 * https://site.com/?channel=ReienOkami&bb=%230a0c16&bo=82&ac=%237ecfdc&ao=55&tc=%23dde3ee&fm=14&fu=13&cw=340&mg=10&mm=8&cbr=%23FFD700&cmo=%2300E676&cv=%23E040FB&cs=%2340C4FF&cd=%23FFFFFF
 */

export interface OverlaySettings {
    channel: string

    bubbleBgColor: string   // hex
    bubbleOpacity: number   // 0-100

    accentColor: string
    accentOpacity: number

    textColor: string
    fontSizeMsg: number
    fontSizeUser: number

    chatWidth: number
    msgGap: number
    maxMessages: number

    colorBroadcaster: string
    colorModerator: string
    colorVip: string
    colorSubscriber: string
    colorDefault: string
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
}

// ── Short param keys (ทำให้ URL สั้นลง) ─────────────────────
// key = field ใน OverlaySettings, value = query param name
const PARAM_MAP: Record<keyof OverlaySettings, string> = {
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
}

// reverse map สำหรับ decode
const REVERSE_MAP = Object.fromEntries(
    Object.entries(PARAM_MAP).map(([k, v]) => [v, k])
) as Record<string, keyof OverlaySettings>

// ── numeric fields สำหรับ parse ถูก type ─────────────────────
const NUMERIC_FIELDS = new Set<keyof OverlaySettings>([
    'bubbleOpacity', 'accentOpacity', 'fontSizeMsg', 'fontSizeUser',
    'chatWidth', 'msgGap', 'maxMessages',
])

// ── hex → rgba ───────────────────────────────────────────────
function hexToRgb(hex: string) {
    const c = hex.replace('#', '')
    const n = parseInt(c, 16)
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

// ── Apply settings → CSS variables ───────────────────────────
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

// ── Encode settings → URLSearchParams string ─────────────────
export function encodeSettingsToUrl(s: OverlaySettings): string {
    const params = new URLSearchParams()
    for (const [field, paramKey] of Object.entries(PARAM_MAP)) {
        const val = (s as any)[field]
        params.set(paramKey, String(val))
    }
    return params.toString()
}

// ── Decode URLSearchParams → OverlaySettings ─────────────────
export function decodeSettingsFromUrl(search: string): Partial<OverlaySettings> {
    const params = new URLSearchParams(search)
    const result: Partial<OverlaySettings> = {}

    for (const [paramKey, rawVal] of params.entries()) {
        const field = REVERSE_MAP[paramKey]
        if (!field) continue
            // cast ให้ถูก type
            ; (result as any)[field] = NUMERIC_FIELDS.has(field) ? Number(rawVal) : rawVal
    }
    return result
}

// ── localStorage helpers (ใช้กับ settings page เท่านั้น) ─────
const STORAGE_KEY = 'twitch-overlay-settings'

function readStorage(): OverlaySettings | null {
    if (typeof localStorage === 'undefined') return null
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : null
    } catch { return null }
}

// ── Composable ────────────────────────────────────────────────
export function useOverlaySettings() {
    const settings = useState<OverlaySettings>('overlay-settings', () => ({ ...DEFAULT_SETTINGS }))

    /**
     * load() — ใช้สำหรับหน้า /settings
     * โหลดจาก localStorage เพื่อให้ settings ยังจำค่าเดิมได้
     */
    function load() {
        const stored = readStorage()
        if (stored) settings.value = stored
        applyCssVars(settings.value)
    }

    /**
     * save() — ใช้สำหรับหน้า /settings
     * บันทึกลง localStorage (สำหรับจำค่าใน settings page)
     * + apply CSS vars สำหรับ preview
     */
    function save() {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
        }
        applyCssVars(settings.value)
    }

    /**
     * loadFromUrl() — ใช้สำหรับหน้า / (overlay)
     * อ่าน query params จาก URL แล้ว merge กับ default
     * วิธีนี้ทำให้ OBS รับ settings ได้โดยตรงจาก URL ที่ paste เข้าไป
     */
    function loadFromUrl() {
        if (typeof window === 'undefined') return
        const fromUrl = decodeSettingsFromUrl(window.location.search)
        settings.value = { ...DEFAULT_SETTINGS, ...fromUrl }
        applyCssVars(settings.value)
    }

    /**
     * buildObsUrl() — ใช้สำหรับหน้า /settings
     * สร้าง URL พร้อม params ทุกอย่าง → user copy ไปวางใน OBS
     */
    function buildObsUrl(baseUrl: string): string {
        const params = encodeSettingsToUrl(settings.value)
        return `${baseUrl}?${params}`
    }

    function reset() {
        settings.value = { ...DEFAULT_SETTINGS }
        save()
    }

    return { settings, load, save, loadFromUrl, buildObsUrl, reset }
}
