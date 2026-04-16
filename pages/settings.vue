<script setup lang="ts">
const { settings: s, save, reset, load, buildObsUrl } = useOverlaySettings()

onMounted(() => load())

// const modal = ref<boolean>(false)

/* OBS URL */
const obsUrl = computed(() => {
    if (typeof window === 'undefined') return ''
    const path = window.location.pathname
    const basePath = path.endsWith('/settings')
        ? path.slice(0, -'/settings'.length) + '/'
        : path.replace(/\/settings\/?$/, '/')
    return buildObsUrl(window.location.origin + basePath + 'chat/')
})

/* Copy URL */
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout>
async function handleCopyUrl() {
    try {
        await navigator.clipboard.writeText(obsUrl.value)
    } catch {
        const el = document.createElement('textarea')
        el.value = obsUrl.value
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
    }
    copied.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => { copied.value = false }, 2500)
}

/* Save / Reset */
const saved = ref(false)
let saveTimer: ReturnType<typeof setTimeout>
function handleSave() {
    save()
    saved.value = true
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { saved.value = false }, 2000)
}
function handleReset() {
    if (confirm('Reset ทุก settings กลับเป็น default?')) reset()
}

let debounceTimer: ReturnType<typeof setTimeout>
function debouncedSave() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => save(), 300)
}

/* ════════════════════════════════════════════
   PREVIEW BACKGROUND
════════════════════════════════════════════ */
const previewBgStyle = computed(() => {
    const m = s.value.previewBgMode
    // if (m === 'none') return { background: 'transparent' }
    if (m === 'solid') return { background: s.value.previewBgColor }
    if (m === 'image' && s.value.previewBgImage)
        return { backgroundImage: `url(${s.value.previewBgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    // gradient (default)
    return {
        background: `linear-gradient(${s.value.previewBgAngle}deg, ${s.value.previewBgColor}, ${s.value.previewBgColor2})`
    }
})

// อัปโหลดรูป preview background (PNG/JPG/WEBP/GIF — ไม่จำกัด pixel เพราะเป็น bg)
async function handlePreviewBgUpload(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { alert('กรุณาเลือกไฟล์รูปภาพเท่านั้น'); return }
    const reader = new FileReader()
    reader.onload = () => {
        s.value.previewBgImage = reader.result as string
        s.value.previewBgMode = 'image'
        save()
    }
    reader.readAsDataURL(file)
}

function clearPreviewBgImage() {
    s.value.previewBgImage = ''
    s.value.previewBgMode = 'gradient'
    save()
}

/* Preview colors */
const bubbleBgComputed = computed(() => {
    const rgb = hexToRgbStr(s.value.bubbleBgColor)
    return `rgba(${rgb}, ${s.value.bubbleOpacity / 100})`
})
const accentComputed = computed(() => {
    const rgb = hexToRgbStr(s.value.accentColor)
    return `rgba(${rgb}, ${s.value.accentOpacity / 100})`
})
const accentCssVar = computed(() => s.value.accentColor)

/* Role fields */
const roleFields = [
    { key: 'colorBroadcaster', label: 'Broadcaster' },
    { key: 'colorModerator', label: 'Moderator' },
    { key: 'colorVip', label: 'VIP' },
    { key: 'colorSubscriber', label: 'Subscriber' },
    { key: 'colorDefault', label: 'Viewer' },
]

/* ════════════════════════════════════════════
   BADGE IMAGE UPLOAD
   แต่ละ badge มี input[type=file] ของตัวเอง
   เมื่อเลือกไฟล์ → แปลงเป็น Base64 data URL
   → บันทึกใน settings.badgeImages[key]
   → encode ลงใน OBS URL อัตโนมัติ
════════════════════════════════════════════ */
const badgeFields = [
    { key: 'broadcaster', label: 'Broadcaster', tier: '' },
    { key: 'moderator', label: 'Moderator', tier: '' },
    { key: 'vip', label: 'VIP', tier: '' },
    // { key: 'subscriber', label: 'Sub Tier 1', tier: '1' },
    // { key: 'sub2', label: 'Sub Tier 2', tier: '2' },
    // { key: 'sub3', label: 'Sub Tier 3', tier: '3' },
    { key: 'sub_1month', label: 'SUBSCRIBER', tier: '1 Month' },
    { key: 'sub_2month', label: 'SUBSCRIBER', tier: '2 Month' },
    { key: 'sub_3month', label: 'SUBSCRIBER', tier: '3 Month' },
    { key: 'sub_6month', label: 'SUBSCRIBER', tier: '6 Month' },
    { key: 'sub_9month', label: 'SUBSCRIBER', tier: '9 Month' },
    { key: 'sub_1year', label: 'SUBSCRIBER', tier: '1 Year' },
    // { key: 'prime', label: 'Prime', tier: '' },
    // { key: 'turbo', label: 'Turbo', tier: '' },
    // { key: 'partner', label: 'Partner', tier: '' },
    // { key: 'sub-gifter', label: 'Gift Sub', tier: '' },
]

// แปลง File → base64 data URL
function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

// ตรวจ pixel dimension ของ PNG ผ่าน Image object
function checkImageDimension(dataUrl: string, maxPx = 72): Promise<boolean> {
    return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img.naturalWidth <= maxPx && img.naturalHeight <= maxPx)
        img.onerror = () => resolve(false)
        img.src = dataUrl
    })
}

const ALLOWED_MIME: Record<string, string> = {
    'image/png': 'PNG',
    'image/svg+xml': 'SVG',
}
const MAX_BADGE_PX = 72

async function handleBadgeUpload(key: string, event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    // reset input เพื่อให้ onchange ยิงซ้ำได้ถ้า user เลือกไฟล์เดิม
    input.value = ''

    // validate ประเภทไฟล์: รองรับแค่ PNG และ SVG
    if (!ALLOWED_MIME[file.type]) {
        alert('รองรับเฉพาะไฟล์ PNG และ SVG เท่านั้น')
        return
    }

    const base64 = await fileToBase64(file)

    // SVG เป็น vector ไม่มี pixel dimension จริง → ข้ามการตรวจขนาด
    if (file.type === 'image/png') {
        const ok = await checkImageDimension(base64, MAX_BADGE_PX)
        if (!ok) {
            alert(`PNG ต้องมีขนาดไม่เกิน ${MAX_BADGE_PX}×${MAX_BADGE_PX} pixel`)
            return
        }
    }

    ; (s.value.badgeImages as any)[key] = base64
    save()
}

function resetBadge(key: string) {
    ; (s.value.badgeImages as any)[key] = (DEFAULT_BADGE_IMAGES as any)[key]
    save()
}

// Preview feed — mix of chat and alerts
type PreviewKind = 'chat' | 'follow' | 'raid' | 'sub' | 'resub' | 'subgift' | 'bits'
const previewFeed = computed((): Array<{ id: number; kind: PreviewKind; [k: string]: any }> => [
    {
        id: 1, kind: 'chat',
        user: s.value.channel || 'Broadcaster',
        color: s.value.colorBroadcaster,
        badgeSrc: s.value.badgeImages.broadcaster,
        text: 'สวัสดีทุกคนนน! หมาป่าสุดหล่อมาแล้ววว! 🐺✨',
    },
    {
        id: 2, kind: 'follow',
        user: 'NewFollower007',
    },
    {
        id: 3, kind: 'chat',
        user: 'ModeratorBot',
        color: s.value.colorModerator,
        badgeSrc: s.value.badgeImages.moderator,
        text: 'ห้ามสแปมนะครับ ไม่งั้นจะโดนปิ้ว ๆ 🔫',
    },
    {
        id: 4, kind: 'sub',
        user: 'NewSubUser',
        tier: '1000',
        message: 'ดูนานมากแล้ว ตัดสินใจซับซะที! 🎉',
    },
    {
        id: 5, kind: 'chat',
        user: 'Subscriber123',
        color: s.value.colorSubscriber,
        badgeSrc: s.value.badgeImages.sub_1month,
        text: 'พี่เรย์วันนี้ก็หล่อเหมือนเคยเลยครับ! 😍',
    },
    {
        id: 6, kind: 'resub',
        user: 'LoyalFan888',
        months: 6,
        tier: '1000',
        message: 'ซับมาครึ่งปีแล้ว ❤️',
    },
    {
        id: 7, kind: 'subgift',
        user: 'GenerousViewer',
        recipient: 'LuckyViewer99',
        tier: '1000',
    },
    {
        id: 8, kind: 'raid',
        user: 'RaiderChannel',
        viewerCount: 42,
    },
    {
        id: 9, kind: 'bits',
        user: 'CheerLeader',
        bits: 500,
        message: 'สู้ ๆ นะครับพี่! 💪',
    },
    {
        id: 10, kind: 'chat',
        user: 'Viewer007',
        color: s.value.colorDefault,
        badgeSrc: '',
        text: 'สวัสดีครับ 🖖',
    },
])

function tierLabelPreview(tier?: string) {
    if (tier === '2000') return 'Tier 2'
    if (tier === '3000') return 'Tier 3'
    return 'Tier 1'
}
function monthsLabelPreview(months: number) {
    if (months >= 12 && months % 12 === 0) return `${months / 12} ปี`
    return `${months} เดือน`
}
function bitsEmojiPreview(bits: number) {
    if (bits >= 10000) return '💎'
    if (bits >= 5000)  return '🔴'
    if (bits >= 1000)  return '🟣'
    if (bits >= 100)   return '🔵'
    if (bits >= 10)    return '🟢'
    return '⬜'
}
</script>

<template>
    <div class="settings-root">
        <div class="bg-grid" aria-hidden="true" />
        <div class="bg-glow" aria-hidden="true" />

        <!-- HEADER -->
        <header class="page-header">
            <div class="header-inner">
                <div class="logo-mark">
                    <p class="logo-text">🐺 レイヱン Chat<em>Widget</em></p>
                    <span class="logo-demo">Demo</span>
                </div>

                <div class="">
                    <a href="https://x.com/ReienOkami" target="_blank" rel="noopener noreferrer" class="logo-credit">
                        by @Okamitani Reien
                    </a>
                </div>
            </div>
        </header>

        <!--  MAIN -->
        <main class="main-layout">
            <!-- PREVIEW -->
            <div class="preview-col">
                <div class="preview-header">
                    <div class="w-full flex items-baseline gap-[10px]">
                        <span class="preview-label"><span class="panel-icon">💐 </span> Chat Preview</span>
                        <span class="preview-hint">ปรับแต่งเพื่อดูผลลัพธ์</span>
                    </div>

                    <div class="flex items-center gap-2">
                        <div class="obs-url-box">
                            <code class="obs-url-text">{{ obsUrl }}</code>
                        </div>

                        <button class="p-2 rounded-md" @click="handleCopyUrl">
                            <svg v-if="copied === false" width="15" height="15" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2.5">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                            </svg>
                            <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2.5">
                                <polyline points="20,6 9,17 4,12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="preview-stage">
                    <div class="stream-bg" :style="previewBgStyle" />
                    <div class="preview-overlay" :style="{ width: s.chatWidth + 'px', gap: s.msgGap + 'px' }">
                        <template v-for="item in previewFeed" :key="item.id">

                            <!-- chat -->
                            <div v-if="item.kind === 'chat'" class="preview-item">
                                <div class="preview-header-row">
                                    <img v-if="item.badgeSrc" :src="item.badgeSrc" class="preview-badge" />
                                    <span class="preview-username" :style="{ color: item.color, fontSize: s.fontSizeUser + 'px' }">
                                        {{ item.user }}
                                    </span>
                                </div>
                                <div class="preview-bubble" :style="{
                                    background: bubbleBgComputed,
                                    borderLeftColor: accentComputed,
                                    fontSize: s.fontSizeMsg + 'px',
                                    color: s.textColor,
                                }">{{ item.text }}</div>
                            </div>

                            <!-- follow -->
                            <div v-else-if="item.kind === 'follow'" class="pv-alert pv-follow">
                                <span class="pv-icon">🌸</span>
                                <div class="pv-body">
                                    <span class="pv-user" :style="{ fontSize: s.fontSizeUser + 'px' }">{{ item.user }}</span>
                                    <span class="pv-msg" :style="{ fontSize: (s.fontSizeMsg - 1) + 'px', color: s.textColor }">ติดตามช่องแล้ว!</span>
                                </div>
                                <span class="pv-badge">FOLLOW</span>
                            </div>

                            <!-- raid -->
                            <div v-else-if="item.kind === 'raid'" class="pv-alert pv-raid">
                                <span class="pv-icon">⚔️</span>
                                <div class="pv-body">
                                    <span class="pv-user" :style="{ fontSize: s.fontSizeUser + 'px' }">{{ item.user }}</span>
                                    <span class="pv-msg" :style="{ fontSize: (s.fontSizeMsg - 1) + 'px', color: s.textColor }">
                                        Raid มา {{ item.viewerCount?.toLocaleString() }} คน!
                                    </span>
                                </div>
                                <span class="pv-badge">RAID</span>
                            </div>

                            <!-- sub -->
                            <div v-else-if="item.kind === 'sub'" class="pv-alert pv-sub">
                                <span class="pv-icon">⭐</span>
                                <div class="pv-body">
                                    <span class="pv-user" :style="{ fontSize: s.fontSizeUser + 'px' }">{{ item.user }}</span>
                                    <span class="pv-msg" :style="{ fontSize: (s.fontSizeMsg - 1) + 'px', color: s.textColor }">
                                        สมัครสมาชิกใหม่ {{ tierLabelPreview(item.tier) }}!
                                    </span>
                                    <span v-if="item.message" class="pv-submsg" :style="{ fontSize: (s.fontSizeMsg - 2) + 'px', color: s.textColor }">"{{ item.message }}"</span>
                                </div>
                                <span class="pv-badge pv-sub-badge">NEW SUB</span>
                            </div>

                            <!-- resub -->
                            <div v-else-if="item.kind === 'resub'" class="pv-alert pv-sub">
                                <span class="pv-icon">💫</span>
                                <div class="pv-body">
                                    <span class="pv-user" :style="{ fontSize: s.fontSizeUser + 'px' }">{{ item.user }}</span>
                                    <span class="pv-msg" :style="{ fontSize: (s.fontSizeMsg - 1) + 'px', color: s.textColor }">
                                        ต่ออายุ {{ tierLabelPreview(item.tier) }} ครบ {{ monthsLabelPreview(item.months ?? 0) }}!
                                    </span>
                                    <span v-if="item.message" class="pv-submsg" :style="{ fontSize: (s.fontSizeMsg - 2) + 'px', color: s.textColor }">"{{ item.message }}"</span>
                                </div>
                                <span class="pv-badge pv-sub-badge">RESUB</span>
                            </div>

                            <!-- subgift -->
                            <div v-else-if="item.kind === 'subgift'" class="pv-alert pv-gift">
                                <span class="pv-icon">🎁</span>
                                <div class="pv-body">
                                    <span class="pv-user" :style="{ fontSize: s.fontSizeUser + 'px' }">{{ item.user }}</span>
                                    <span class="pv-msg" :style="{ fontSize: (s.fontSizeMsg - 1) + 'px', color: s.textColor }">
                                        Gift Sub {{ tierLabelPreview(item.tier) }} แก่ {{ item.recipient }}!
                                    </span>
                                </div>
                                <span class="pv-badge pv-gift-badge">GIFT</span>
                            </div>

                            <!-- bits -->
                            <div v-else-if="item.kind === 'bits'" class="pv-alert pv-bits">
                                <span class="pv-icon">{{ bitsEmojiPreview(item.bits ?? 0) }}</span>
                                <div class="pv-body">
                                    <span class="pv-user" :style="{ fontSize: s.fontSizeUser + 'px' }">{{ item.user }}</span>
                                    <span class="pv-msg" :style="{ fontSize: (s.fontSizeMsg - 1) + 'px', color: s.textColor }">
                                        Cheer {{ item.bits?.toLocaleString() }} Bits!
                                    </span>
                                    <span v-if="item.message" class="pv-submsg" :style="{ fontSize: (s.fontSizeMsg - 2) + 'px', color: s.textColor }">"{{ item.message }}"</span>
                                </div>
                                <span class="pv-badge pv-bits-badge">BITS</span>
                            </div>
                        </template>
                    </div>
                </div>
            </div>

            <div class="flex flex-col gap-4">
                <div class="actions-row">
                    <button class="btn btn-ghost" @click="handleReset">Reset to default</button>
                    <button class="btn btn-primary" @click="handleSave">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5">
                            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                            <polyline points="17,21 17,13 7,13 7,21" />
                            <polyline points="7,3 7,8 15,8" />
                        </svg>
                        {{ saved ? '✓ Saved!' : 'Save & Preview' }}
                    </button>
                </div>

                <div class="settings-col">
                    <!-- Twitch -->
                    <section class="panel">
                        <h2 class="panel-title"><span class="panel-icon">🎮</span> Twitch</h2>
                        <div class="field">
                            <label class="field-label">Channel name</label>
                            <input v-model="s.channel" class="input" placeholder="your_channel"
                                @input="debouncedSave" />
                        </div>
                        <div class="field">
                            <label class="field-label">Max messages shown</label>
                            <div class="slider-row">
                                <input type="range" v-model.number="s.maxMessages" min="1" max="20" class="slider"
                                    @input="debouncedSave" />
                                <span class="slider-val">{{ s.maxMessages }}</span>
                            </div>
                        </div>
                    </section>

                    <!-- Chat Bubble -->
                    <section class="panel">
                        <h2 class="panel-title"><span class="panel-icon">💬</span> Chat Bubble</h2>
                        <div class="field-row">
                            <div class="field">
                                <label class="field-label">Background color</label>
                                <div class="color-row">
                                    <input type="color" v-model="s.bubbleBgColor" class="color-swatch"
                                        @input="debouncedSave" />
                                    <input v-model="s.bubbleBgColor" class="input input-sm" @input="debouncedSave" />
                                </div>
                            </div>
                            <div class="field">
                                <label class="field-label">Opacity {{ s.bubbleOpacity }}%</label>
                                <input type="range" v-model.number="s.bubbleOpacity" min="0" max="100" class="slider"
                                    @input="debouncedSave" />
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field">
                                <label class="field-label">Accent bar color</label>
                                <div class="color-row">
                                    <input type="color" v-model="s.accentColor" class="color-swatch"
                                        @input="debouncedSave" />
                                    <input v-model="s.accentColor" class="input input-sm" @input="debouncedSave" />
                                </div>
                            </div>
                            <div class="field">
                                <label class="field-label">Accent opacity {{ s.accentOpacity }}%</label>
                                <input type="range" v-model.number="s.accentOpacity" min="0" max="100" class="slider"
                                    @input="debouncedSave" />
                            </div>
                        </div>
                    </section>

                    <!-- Typography -->
                    <section class="panel">
                        <h2 class="panel-title"><span class="panel-icon">✏️</span> Typography</h2>
                        <div class="field-row">
                            <div class="field">
                                <label class="field-label">Text color</label>
                                <div class="color-row">
                                    <input type="color" v-model="s.textColor" class="color-swatch"
                                        @input="debouncedSave" />
                                    <input v-model="s.textColor" class="input input-sm" @input="debouncedSave" />
                                </div>
                            </div>
                        </div>
                        <div class="field-row">
                            <div class="field">
                                <label class="field-label">Message size {{ s.fontSizeMsg }}px</label>
                                <input type="range" v-model.number="s.fontSizeMsg" min="10" max="24" class="slider"
                                    @input="debouncedSave" />
                            </div>
                            <div class="field">
                                <label class="field-label">Username size {{ s.fontSizeUser }}px</label>
                                <input type="range" v-model.number="s.fontSizeUser" min="10" max="22" class="slider"
                                    @input="debouncedSave" />
                            </div>
                        </div>
                    </section>

                    <!-- Layout -->
                    <section class="panel">
                        <h2 class="panel-title"><span class="panel-icon">📐</span> Layout</h2>
                        <div class="field-row">
                            <div class="field">
                                <label class="field-label">Width {{ s.chatWidth }}px</label>
                                <input type="range" v-model.number="s.chatWidth" min="200" max="600" class="slider"
                                    @input="debouncedSave" />
                            </div>
                            <div class="field">
                                <label class="field-label">Gap between msgs {{ s.msgGap }}px</label>
                                <input type="range" v-model.number="s.msgGap" min="4" max="32" class="slider"
                                    @input="debouncedSave" />
                            </div>
                        </div>
                    </section>

                    <!-- Preview Background -->
                     <section class="panel">
                    <h2 class="panel-title"><span class="panel-icon">🖼️</span> Preview Background</h2>

                    <!-- Mode tabs -->
                    <div class="bg-mode-tabs">
                        <button v-for="m in (['solid', 'gradient', 'image'] as const)" :key="m"
                            class="bg-mode-tab" :class="{ active: s.previewBgMode === m }"
                            @click="s.previewBgMode = m; debouncedSave()">
                              {{  m === 'solid' ? '🟦 Solid' : m === 'gradient' ? '🌈 Gradient' : m === 'image' ? '🍉 Image' : 'None' }}
                        </button>
                    </div>

                    <!-- Gradient controls -->
                    <template v-if="s.previewBgMode === 'gradient'">
                        <div class="field-row">
                            <div class="field">
                                <label class="field-label">Color 1</label>
                                <div class="color-row">
                                    <input type="color" v-model="s.previewBgColor" class="color-swatch" @input="debouncedSave" />
                                    <input v-model="s.previewBgColor" class="input input-sm" @input="debouncedSave" />
                                </div>
                            </div>
                            <div class="field">
                                <label class="field-label">Color 2</label>
                                <div class="color-row">
                                    <input type="color" v-model="s.previewBgColor2" class="color-swatch" @input="debouncedSave" />
                                    <input v-model="s.previewBgColor2" class="input input-sm" @input="debouncedSave" />
                                </div>
                            </div>
                        </div>
                        <div class="field">
                            <label class="field-label">Angle {{ s.previewBgAngle }}°</label>
                            <input type="range" v-model.number="s.previewBgAngle" min="0" max="360" class="slider" @input="debouncedSave" />
                        </div>
                    </template>

                    <!-- Solid controls -->
                    <template v-if="s.previewBgMode === 'solid'">
                        <div class="field">
                            <label class="field-label">Color</label>
                            <div class="color-row">
                                <input type="color" v-model="s.previewBgColor" class="color-swatch" @input="debouncedSave" />
                                <input v-model="s.previewBgColor" class="input input-sm" @input="debouncedSave" />
                            </div>
                        </div>
                    </template>

                    <!-- Image upload controls -->
                    <template v-if="s.previewBgMode === 'image'">
                        <div class="bg-upload-area">
                            <img v-if="s.previewBgImage" :src="s.previewBgImage" class="bg-upload-preview" alt="preview bg" />
                            <div v-else class="bg-upload-placeholder">
                                <span>ยังไม่มีรูป</span>
                            </div>
                            <div class="bg-upload-actions">
                                <label class="badge-upload-btn" style="width:auto; padding: 7px 14px;">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    Upload Image
                                    <input type="file" accept="image/*" class="badge-file-input" @change="handlePreviewBgUpload" />
                                </label>
                                <button v-if="s.previewBgImage" class="btn btn-ghost" style="padding:7px 12px; font-size:12px;" @click="clearPreviewBgImage">✕ ลบรูป</button>
                            </div>
                        </div>
                    </template>
                </section>

                    <!-- Username colors -->
                    <section class="panel">
                        <h2 class="panel-title"><span class="panel-icon">⚙️</span> Username colors</h2>
                        <div class="role-grid">
                            <div v-for="role in roleFields" :key="role.key" class="field">
                                <label class="field-label">{{ role.label }}</label>
                                <div class="color-row">
                                    <input type="color" v-model="(s as any)[role.key]" class="color-swatch"
                                        @input="debouncedSave" />
                                    <span class="role-preview" :style="{ color: (s as any)[role.key] }">{{ role.label
                                    }}</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    <!-- ══════════════════════════════════════
             BADGE Custom — section ใหม่
             อัปโหลดรูป badge แทน Twitch CDN
             รูปจะถูกแปลงเป็น Base64 และ encode
             ลง URL พร้อมกับ settings อื่น ๆ
        ══════════════════════════════════════ -->
                    <section class="panel">
                        <h2 class="panel-title"><span class="panel-icon">🏷️</span> Badge Custom</h2>
                        <p class="panel-desc">
                            รองรับ .png และ .svg ขนาดไม่เกิน 72×72 pixel
                        </p>

                        <div class="badge-grid">
                            <div v-for="bf in badgeFields" :key="bf.key" class="badge-item">
                                <!-- Preview รูปปัจจุบัน -->
                                <div class="badge-preview-wrap">
                                    <img :src="(s.badgeImages as any)[bf.key]" class="badge-preview-img" :alt="bf.label"
                                        @error="(e) => (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'32\' height=\'32\'><rect width=\'32\' height=\'32\' fill=\'%23333\' rx=\'6\'/><text x=\'50%25\' y=\'55%25\' text-anchor=\'middle\' dominant-baseline=\'middle\' font-size=\'14\' fill=\'%23666\'>?</text></svg>'" />
                                    <!-- indicator ว่าเป็น custom หรือ default -->
                                    <span class="badge-source-tag"
                                        :class="(s.badgeImages as any)[bf.key].startsWith('data:') ? 'custom' : 'default'">
                                        {{ (s.badgeImages as any)[bf.key].startsWith('data:') ? 'custom' : 'default' }}
                                    </span>
                                </div>

                                <div class="badge-info">
                                    <span class="badge-label">{{ bf.label }}</span>
                                    <span v-if="bf.tier" class="badge-tier">{{ bf.tier }}</span>
                                </div>

                                <!-- Upload button -->
                                <label class="badge-upload-btn">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                        stroke-width="2.5">
                                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    Upload
                                    <input type="file" accept="image/png,image/svg+xml" class="badge-file-input"
                                        @change="handleBadgeUpload(bf.key, $event)" />
                                </label>

                                <!-- Reset กลับ default -->
                                <button v-if="(s.badgeImages as any)[bf.key].startsWith('data:')"
                                    class="badge-reset-btn" @click="resetBadge(bf.key)"
                                    title="Reset กลับ default">✕</button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    </div>

    <!-- <Modal v-model:open="modal">
        <template v-if="s.previewBgMode === 'image'">
            <div class="bg-upload-area">
                <img v-if="s.previewBgImage" :src="s.previewBgImage" class="bg-upload-preview" alt="preview bg" />
                <div v-else class="bg-upload-placeholder">
                    <span>ยังไม่มีรูป</span>
                </div>
                <div class="bg-upload-actions">
                    <label class="badge-upload-btn" style="width:auto; padding: 7px 14px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Upload Image
                        <input type="file" accept="image/*" class="badge-file-input" @change="handlePreviewBgUpload" />
                    </label>
                    <button v-if="s.previewBgImage" class="btn btn-ghost" style="padding:7px 12px; font-size:12px;"
                        @click="clearPreviewBgImage">✕ ลบรูป</button>
                </div>
            </div>
        </template>
    </Modal> -->
</template>

<style scoped>
.settings-root {
    --bg: #09090f;
    --surface: #111118;
    --surface-2: #16161f;
    --border: rgba(255, 255, 255, 0.07);
    --border-hover: rgba(255, 255, 255, 0.14);
    --text-primary: #e8eaf0;
    --text-muted: #6b7280;
    --text-subtle: #374151;
    --accent-preview: v-bind(accentCssVar);
    --radius: 14px;
    --radius-sm: 8px;
    --font-ui: 'Noto Serif JP', serif;
    --font-body-ui: 'Noto Sans Thai Looped', sans-serif;
    min-height: 100vh;
    max-height: 100dvh;
    background: var(--bg);
    color: var(--text-primary);
    font-family: var(--font-body-ui);
    position: relative;
    overflow: hidden;
}

.bg-grid {
    position: fixed;
    inset: 0;
    background-image: linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
}

.bg-glow {
    position: fixed;
    top: -200px;
    right: -200px;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, v-bind(accentCssVar) 0%, transparent 65%);
    opacity: 0.06;
    pointer-events: none;
    z-index: 0;
    filter: blur(40px);
}

.page-header {
    position: sticky;
    top: 0;
    z-index: 50;
    min-height: 60px;
    max-height: 60px;
    background: rgba(9, 9, 15, 0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
}

.header-inner {
    margin: 0 auto;
    padding: 0 24px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.logo-mark {
    display: flex;
    align-items: baseline;
    gap: 6px;
}

.logo-text {
    font-family: var(--font-ui);
    font-weight: 800;
    font-size: 18px;
    color: var(--text-primary);
    letter-spacing: 0.02em;
}

.logo-text em {
    font-style: normal;
    color: v-bind(accentCssVar);
}

.logo-demo {
    font-family: var(--font-ui);
    font-weight: 600;
    font-size: 10px;
    color: var(--text-muted);
}

.logo-credit {
    font-family: var(--font-ui);
    font-size: 11px;
    color: var(--text-muted);
}

.main-layout {
    position: relative;
    z-index: 1;
    margin: 0 auto;
    padding: 32px 24px 60px;
    display: flex;
    justify-content: center;

    gap: 32px;
    overflow: hidden;
}

@media (max-width: 860px) {
    .main-layout {
        grid-template-columns: 1fr;
    }
}

.settings-col {
    max-height: calc(100vh - 120px);
    padding: 0 0 40px 0;
    flex-direction: column;
    display: flex;
    gap: 16px;
    overflow-y: auto;

    scrollbar-width: none;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
        display: none;
    }
}

.panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition: border-color 0.2s;
}

.panel:hover {
    border-color: var(--border-hover);
}

.panel-title {
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 8px;
}

.panel-icon {
    font-size: 15px;
}

.panel-desc {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.6;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
}

.field-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.01em;
}

.input {
    width: 100%;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 9px 12px;
    color: var(--text-primary);
    font-size: 14px;
    font-family: var(--font-body-ui);
    outline: none;
    transition: border-color 0.15s;
}

.input:focus {
    border-color: v-bind(accentCssVar);
}

.input-sm {
    padding: 7px 10px;
    font-size: 12px;
}

.color-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.color-swatch {
    width: 36px;
    height: 36px;
    padding: 2px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    cursor: pointer;
    flex-shrink: 0;
    transition: border-color 0.15s;
}

.color-swatch:hover {
    border-color: var(--border-hover);
}

.slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
}

.slider-val {
    font-size: 13px;
    font-weight: 600;
    color: v-bind(accentCssVar);
    min-width: 28px;
    text-align: right;
}

.slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background: var(--surface-2);
    outline: none;
    cursor: pointer;
    accent-color: v-bind(accentCssVar);
}

.role-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.role-preview {
    font-family: var(--font-ui);
    font-weight: 700;
    font-size: 13px;
}

/* ════════════════════════════════════════════
   BADGE GRID
════════════════════════════════════════════ */
.badge-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 10px;
}

.badge-item {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 12px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    position: relative;
    transition: border-color 0.15s;
}

.badge-item:hover {
    border-color: var(--border-hover);
}

.badge-preview-wrap {
    position: relative;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.badge-preview-img {
    width: 32px;
    height: 32px;
    object-fit: contain;
    image-rendering: pixelated;
    /* badge เล็กต้องชัด */
    border-radius: 4px;
}

/* tag บอก source ของรูป */
.badge-source-tag {
    position: absolute;
    bottom: -4px;
    right: -4px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.03em;
    padding: 1px 4px;
    border-radius: 3px;
    text-transform: uppercase;
}

.badge-source-tag.default {
    background: rgba(100, 100, 120, 0.8);
    color: #999;
}

.badge-source-tag.custom {
    background: v-bind(accentCssVar);
    color: #000;
}

.badge-info {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
}

.badge-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
    text-align: center;
}

.badge-tier {
    font-size: 10px;
    color: var(--text-muted);
}

/* Upload button — label ครอบ input[file] ซ่อนอยู่ */
.badge-upload-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-body-ui);
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text-muted);
    transition: border-color 0.15s, color 0.15s;
    width: 100%;
    justify-content: center;
}

.badge-upload-btn:hover {
    border-color: v-bind(accentCssVar);
    color: var(--text-primary);
}

/* ซ่อน native file input */
.badge-file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}

/* Reset badge button */
.badge-reset-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    background: rgba(248, 113, 113, 0.2);
    color: #f87171;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
}

.badge-reset-btn:hover {
    background: rgba(248, 113, 113, 0.4);
}

/* ════════════════════════════════════════════
   OBS URL CARD
════════════════════════════════════════════ */
.obs-url-card {
    background: var(--surface);
    border: 1px solid v-bind(accentCssVar);
    border-radius: var(--radius);
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
    overflow: hidden;
}

.obs-url-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse at top left, v-bind(accentCssVar), transparent 70%);
    opacity: 0.07;
    pointer-events: none;
}

.obs-url-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.obs-url-title {
    display: flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: v-bind(accentCssVar);
}

.obs-url-badge {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-muted);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 3px 10px;
}

.obs-url-box {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 4px 12px;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
    max-width: 380px;
    overflow-x: auto;
}

.obs-url-text {
    font-family: monospace;
    font-size: 10px;
    color: var(--text-muted);
    white-space: nowrap;
    display: block;
    line-height: 1.5;
}

/* Actions */
.actions-row {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
}

.btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: var(--font-body-ui);
    font-weight: 500;
    cursor: pointer;
    border: none;
    transition: opacity 0.15s, transform 0.1s;
}

.btn:active {
    transform: scale(0.97);
}

.btn-ghost {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
}

.btn-ghost:hover {
    border-color: var(--border-hover);
    color: var(--text-primary);
}

.btn-primary {
    background: v-bind(accentCssVar);
    color: #000;
    font-weight: 700;
}

.btn-primary:hover {
    opacity: 0.88;
}

.btn-obs {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    padding: 11px 18px;
    border-radius: var(--radius-sm);
    font-size: 14px;
    font-family: var(--font-body-ui);
    font-weight: 700;
    cursor: pointer;
    border: none;
    background: v-bind(accentCssVar);
    color: #000;
    letter-spacing: 0.02em;
    transition: opacity 0.15s, transform 0.1s, box-shadow 0.2s;
    box-shadow: 0 0 20px color-mix(in srgb, v-bind(accentCssVar) 40%, transparent);
}

.btn-obs:hover {
    opacity: 0.88;
    box-shadow: 0 0 28px color-mix(in srgb, v-bind(accentCssVar) 55%, transparent);
}

.btn-obs:active {
    transform: scale(0.97);
}

/* #region: PREVIEW */
.preview-col {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: calc(100dvw - 650px);
}

.preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.preview-label {
    font-family: var(--font-ui);
    font-size: 18px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.preview-hint {
    font-size: 12px;
    color: var(--text-subtle);
}

.preview-stage {
    border-radius: var(--radius);
    border: 1px solid var(--border);
    overflow: hidden;
    min-height: 540px;
    position: relative;
    background: #0f0f0f;
}

.stream-bg {
    position: absolute;
    inset: 0;
    background:
        radial-gradient(ellipse at 30% 60%, rgba(60, 100, 150, 0.3) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 20%, rgba(100, 60, 150, 0.2) 0%, transparent 50%),
        repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.01) 0px, rgba(255, 255, 255, 0.01) 1px, transparent 1px, transparent 16px);
}

.preview-overlay {
    position: absolute;
    bottom: 12px;
    left: 12px;
    display: flex;
    flex-direction: column;
    max-width: calc(100% - 24px);
    overflow: hidden;
    /* max-height: calc(100% - 80px);
    overflow: auto; */
    transition: width 0.2s;
}

.preview-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-bottom: 8px;
}

.preview-header-row {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 4px;
}

.preview-badge {
    width: 16px;
    height: 16px;
    object-fit: contain;
}

.preview-username {
    font-family: var(--font-ui);
    font-weight: 700;
    line-height: 1;
    transition: color 0.2s, font-size 0.2s;
}

.preview-bubble {
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-left-width: 3px;
    border-radius: 16px;
    padding: 10px 14px;
    line-height: 1.6;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(14px);
    overflow-wrap: anywhere;
    word-break: break-word;
    font-family: var(--font-body-ui);
    transition: background 0.15s, border-color 0.15s, color 0.15s, font-size 0.2s;
}
/* #endregion */

/* #region: Preview Background Controls */
.bg-mode-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.bg-mode-tab {
    flex: 1;
    min-width: 72px;
    padding: 7px 10px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface-2);
    color: var(--text-muted);
    font-size: 12px;
    font-family: var(--font-body-ui);
    font-weight: 500;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
    white-space: nowrap;
}

.bg-mode-tab:hover {
    border-color: var(--border-hover);
    color: var(--text-primary);
}

.bg-mode-tab.active {
    border-color: v-bind(accentCssVar);
    color: v-bind(accentCssVar);
    background: color-mix(in srgb, v-bind(accentCssVar) 10%, transparent);
}

.bg-upload-area {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.bg-upload-preview {
    width: 100%;
    height: 100px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
}

.bg-upload-placeholder {
    width: 100%;
    height: 80px;
    border-radius: var(--radius-sm);
    border: 1px dashed var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-subtle);
    font-size: 12px;
}

.bg-upload-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}
/* #endregion */

/* #region: Preview Alert Cards */
.pv-alert {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.08);
    backdrop-filter: blur(14px);
    position: relative;
    overflow: hidden;
}
.pv-alert::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.05) 50%, transparent 60%);
    background-size: 200% 100%;
    animation: pv-shimmer 2.2s ease-in-out infinite;
    pointer-events: none;
}
@keyframes pv-shimmer {
    0%   { background-position: 200% center; }
    100% { background-position: -200% center; }
}
.pv-icon { font-size: 18px; flex-shrink: 0; line-height: 1; }
.pv-body { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.pv-user { font-family: var(--font-ui); font-weight: 800; line-height: 1.1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pv-msg  { line-height: 1.3; font-family: var(--font-body-ui); }
.pv-submsg { opacity: 0.6; font-family: var(--font-body-ui); line-height: 1.3; }
.pv-badge {
    font-size: 8px; font-weight: 800; letter-spacing: 0.1em;
    padding: 2px 6px; border-radius: 5px; flex-shrink: 0; align-self: flex-start;
}

.pv-follow { background: rgba(244,63,94,0.14); border-color: rgba(244,63,94,0.3); border-left: 3px solid #f43f5e; }
.pv-follow .pv-user { color: #fb7185; }
.pv-follow .pv-badge { background: rgba(244,63,94,0.25); color: #fb7185; }

.pv-raid { background: rgba(245,158,11,0.14); border-color: rgba(245,158,11,0.3); border-left: 3px solid #f59e0b; }
.pv-raid .pv-user { color: #fbbf24; }
.pv-raid .pv-badge { background: rgba(245,158,11,0.25); color: #fbbf24; }

.pv-sub { background: rgba(126,207,220,0.12); border-color: rgba(126,207,220,0.28); border-left: 3px solid var(--accent-color, #7ecfdc); }
.pv-sub .pv-user { color: v-bind(accentCssVar); }
.pv-sub-badge { background: rgba(126,207,220,0.2); color: #7ecfdc; }

.pv-gift { background: rgba(168,85,247,0.14); border-color: rgba(168,85,247,0.3); border-left: 3px solid #a855f7; }
.pv-gift .pv-user { color: #c084fc; }
.pv-gift-badge { background: rgba(168,85,247,0.25); color: #c084fc; }

.pv-bits { background: rgba(250,204,21,0.12); border-color: rgba(250,204,21,0.28); border-left: 3px solid #facc15; }
.pv-bits .pv-user { color: #facc15; }
.pv-bits-badge { background: rgba(250,204,21,0.22); color: #facc15; }
/* #endregion */
</style>