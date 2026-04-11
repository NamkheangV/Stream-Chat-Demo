<script setup lang="ts">
// hexToRgbStr ถูก auto-import จาก utils/color.ts โดย Nuxt
const { settings: s, save, reset, load, buildObsUrl } = useOverlaySettings()

// ── Load settings on mount ─────────────────────────────────
onMounted(() => load())

// ── OBS URL — rebuild ทุกครั้งที่ settings เปลี่ยน ──────────
const obsUrl = computed(() => {
    if (typeof window === 'undefined') return ''
    // ตัด /settings ออกจาก path ให้ถูกต้องทั้ง dev และ GitHub Pages
    // dev:          http://localhost:3000/settings → http://localhost:3000/
    // GitHub Pages: https://user.github.io/repo/settings → https://user.github.io/repo/
    const path = window.location.pathname
    const basePath = path.endsWith('/settings')
        ? path.slice(0, -'/settings'.length) + '/'
        : path.replace(/\/settings\/?$/, '/')
    const base = window.location.origin + basePath
    return buildObsUrl(base)
})

// ── Copy URL ────────────────────────────────────────────────
const copied = ref(false)
let copyTimer: ReturnType<typeof setTimeout>

async function handleCopyUrl() {
    try {
        await navigator.clipboard.writeText(obsUrl.value)
        copied.value = true
        clearTimeout(copyTimer)
        copyTimer = setTimeout(() => { copied.value = false }, 2500)
    } catch {
        // fallback สำหรับ browser ที่ไม่รองรับ clipboard API
        const el = document.createElement('textarea')
        el.value = obsUrl.value
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
        copied.value = true
        copyTimer = setTimeout(() => { copied.value = false }, 2500)
    }
}

// ── Save feedback ──────────────────────────────────────────
const saved = ref(false)
let saveTimer: ReturnType<typeof setTimeout>

function handleSave() {
    save()
    saved.value = true
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { saved.value = false }, 2000)
}

function handleReset() {
    if (confirm('Reset ทุก settings กลับเป็น default?')) {
        reset()
    }
}

// Debounced auto-save เมื่อ slider/input เปลี่ยน
let debounceTimer: ReturnType<typeof setTimeout>
function debouncedSave() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => save(), 300)
}

// ── Computed preview colors ────────────────────────────────
const bubbleBgComputed = computed(() => {
    const rgb = hexToRgbStr(s.value.bubbleBgColor)
    return `rgba(${rgb}, ${s.value.bubbleOpacity / 100})`
})

const accentComputed = computed(() => {
    const rgb = hexToRgbStr(s.value.accentColor)
    return `rgba(${rgb}, ${s.value.accentOpacity / 100})`
})

// ── CSS var for accent preview (logo) ─────────────────────
const accentCssVar = computed(() => s.value.accentColor)

// ── Role fields config ─────────────────────────────────────
const roleFields = [
    { key: 'colorBroadcaster', label: 'Broadcaster' },
    { key: 'colorModerator', label: 'Moderator' },
    { key: 'colorVip', label: 'VIP' },
    { key: 'colorSubscriber', label: 'Subscriber' },
    { key: 'colorDefault', label: 'Viewer' },
]

// ── Preview messages (fake data) ──────────────────────────
const previewMsgs = computed(() => [
    {
        id: 1,
        user: s.value.channel || 'Broadcaster',
        color: s.value.colorBroadcaster,
        badgeSrc: 'https://static-cdn.jtvnw.net/badges/v1/5527c58c-fb7d-422d-b71b-f309dcb85cc1/2',
        text: 'สวัสดีทุกคนนน! ยินดีต้อนรับ 🎉',
    },
    {
        id: 2,
        user: 'ModeratorBot',
        color: s.value.colorModerator,
        badgeSrc: 'https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2',
        text: 'ห้ามสแปมนะครับ ขอบคุณที่ช่วย moderate',
    },
    {
        id: 3,
        user: 'SubFan2000',
        color: s.value.colorSubscriber,
        badgeSrc: 'https://static-cdn.jtvnw.net/badges/v1/0e6c1a38-98a9-4d8a-b8f4-8f6bbf5e09c2/2',
        text: 'โห สตรีมดีมากเลยวันนี้! ข้อความยาวๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆ ทดสอบ long text',
    },
    {
        id: 4,
        user: 'NormalViewer',
        color: s.value.colorDefault,
        badgeSrc: '',
        text: 'ฝนตกอีกแล้ว 🌧️',
    },
])
</script>

<template>
    <div class="settings-root">

        <!-- ════ BACKGROUND DECORATION ════ -->
        <div class="bg-grid" aria-hidden="true" />
        <div class="bg-glow" aria-hidden="true" />

        <!-- ════ PAGE HEADER ════ -->
        <header class="page-header">
            <div class="header-inner">
                <div class="logo-mark">
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                        <rect x="0" y="0" width="12" height="12" rx="3" fill="var(--accent-preview)" />
                        <rect x="16" y="0" width="12" height="12" rx="3" fill="var(--accent-preview)" opacity="0.5" />
                        <rect x="0" y="16" width="12" height="12" rx="3" fill="var(--accent-preview)" opacity="0.5" />
                        <rect x="16" y="16" width="12" height="12" rx="3" fill="var(--accent-preview)" />
                    </svg>
                    <span class="logo-text">Overlay<em>Studio</em></span>
                </div>

                <nav class="header-nav">
                    <NuxtLink to="/" class="nav-btn" target="_blank">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                            <polyline points="15,3 21,3 21,9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        เปิด Overlay
                    </NuxtLink>
                </nav>
            </div>
        </header>

        <!-- ════ MAIN LAYOUT: settings left + preview right ════ -->
        <main class="main-layout">

            <!-- ── LEFT: Settings Panels ─────────────────────────── -->
            <aside class="settings-col">

                <!-- ── SECTION: Twitch ── -->
                <section class="panel">
                    <h2 class="panel-title">
                        <span class="panel-icon">📡</span> Twitch
                    </h2>
                    <div class="field">
                        <label class="field-label">Channel name</label>
                        <input v-model="s.channel" class="input" placeholder="your_channel" @input="debouncedSave" />
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

                <!-- ── SECTION: Bubble ── -->
                <section class="panel">
                    <h2 class="panel-title">
                        <span class="panel-icon">💬</span> Chat Bubble
                    </h2>

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

                <!-- ── SECTION: Typography ── -->
                <section class="panel">
                    <h2 class="panel-title">
                        <span class="panel-icon">✏️</span> Typography
                    </h2>

                    <div class="field-row">
                        <div class="field">
                            <label class="field-label">Text color</label>
                            <div class="color-row">
                                <input type="color" v-model="s.textColor" class="color-swatch" @input="debouncedSave" />
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

                <!-- ── SECTION: Layout ── -->
                <section class="panel">
                    <h2 class="panel-title">
                        <span class="panel-icon">📐</span> Layout
                    </h2>

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

                <!-- ── SECTION: Role colors ── -->
                <section class="panel">
                    <h2 class="panel-title">
                        <span class="panel-icon">🎭</span> Username colors
                    </h2>
                    <div class="role-grid">
                        <div v-for="role in roleFields" :key="role.key" class="field">
                            <label class="field-label">{{ role.label }}</label>
                            <div class="color-row">
                                <input type="color" v-model="(s as any)[role.key]" class="color-swatch"
                                    @input="debouncedSave" />
                                <span class="role-preview" :style="{ color: (s as any)[role.key] }">
                                    {{ role.label }}
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- ── OBS URL CARD ── -->
                <div class="obs-url-card">
                    <div class="obs-url-header">
                        <span class="obs-url-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2">
                                <rect x="2" y="3" width="20" height="14" rx="2" />
                                <line x1="8" y1="21" x2="16" y2="21" />
                                <line x1="12" y1="17" x2="12" y2="21" />
                            </svg>
                            OBS Browser Source URL
                        </span>
                        <span class="obs-url-badge">copy แล้ววางใน OBS</span>
                    </div>
                    <div class="obs-url-box">
                        <code class="obs-url-text">{{ obsUrl }}</code>
                    </div>
                    <button class="btn btn-obs" @click="handleCopyUrl">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                            stroke-width="2.5">
                            <rect x="9" y="9" width="13" height="13" rx="2" />
                            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                        {{ copied ? '✓ Copied!' : 'Copy URL' }}
                    </button>
                </div>

                <!-- ── ACTIONS ── -->
                <div class="actions-row">
                    <button class="btn btn-ghost" @click="handleReset">
                        Reset to default
                    </button>
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

            </aside>

            <!-- ── RIGHT: Live Preview ─────────────────────────────── -->
            <div class="preview-col">
                <div class="preview-header">
                    <span class="preview-label">Live Preview</span>
                    <span class="preview-hint">ปรับ slider ซ้ายเพื่อดูผล real-time</span>
                </div>

                <!-- Preview container ขนาด simulate OBS -->
                <div class="preview-stage">
                    <!-- Dark stream BG for reference -->
                    <div class="stream-bg" />

                    <!-- Chat overlay preview — apply inline styles โดยตรง -->
                    <div class="preview-overlay" :style="{
                        width: s.chatWidth + 'px',
                        gap: s.msgGap + 'px',
                    }">
                        <div v-for="msg in previewMsgs" :key="msg.id" class="preview-item">
                            <!-- Header -->
                            <div class="preview-header-row">
                                <img v-if="msg.badgeSrc" :src="msg.badgeSrc" class="preview-badge" />
                                <span class="preview-username"
                                    :style="{ color: msg.color, fontSize: s.fontSizeUser + 'px' }">
                                    {{ msg.user }}
                                </span>
                            </div>
                            <!-- Bubble -->
                            <div class="preview-bubble" :style="{
                                background: bubbleBgComputed,
                                borderLeftColor: accentComputed,
                                fontSize: s.fontSizeMsg + 'px',
                                color: s.textColor,
                            }">
                                {{ msg.text }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </main>
    </div>
</template>

<style scoped>
/* ════════════════════════════════════════════════════════════
   CSS Variables — Settings page theming
════════════════════════════════════════════════════════════ */
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
    --font-ui: 'Syne', system-ui, sans-serif;
    --font-body-ui: 'DM Sans', system-ui, sans-serif;

    min-height: 100vh;
    background: var(--bg);
    color: var(--text-primary);
    font-family: var(--font-body-ui);
    position: relative;
    overflow-x: hidden;
}

/* ── Background decorations ────────────────────────────── */
.bg-grid {
    position: fixed;
    inset: 0;
    background-image:
        linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
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

/* ── Header ─────────────────────────────────────────────── */
.page-header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(9, 9, 15, 0.85);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid var(--border);
}

.header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.logo-mark {
    display: flex;
    align-items: center;
    gap: 10px;
}

.logo-text {
    font-family: var(--font-ui);
    font-weight: 800;
    font-size: 18px;
    color: var(--text-primary);
    letter-spacing: -0.02em;
}

.logo-text em {
    font-style: normal;
    color: v-bind(accentCssVar);
}

.header-nav {
    display: flex;
    gap: 8px;
}

.nav-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-primary);
    font-size: 13px;
    font-family: var(--font-body-ui);
    text-decoration: none;
    transition: border-color 0.15s, background 0.15s;
    cursor: pointer;
}

.nav-btn:hover {
    border-color: var(--border-hover);
    background: var(--surface-2);
}

/* ── Main layout (2 columns) ─────────────────────────────── */
.main-layout {
    position: relative;
    z-index: 1;
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px 24px 60px;
    display: grid;
    grid-template-columns: 440px 1fr;
    gap: 32px;
    align-items: start;
}

@media (max-width: 860px) {
    .main-layout {
        grid-template-columns: 1fr;
    }
}

/* ── Settings column ─────────────────────────────────────── */
.settings-col {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

/* ── Panel card ──────────────────────────────────────────── */
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

/* ── Field ───────────────────────────────────────────────── */
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

/* ── Input ───────────────────────────────────────────────── */
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
    font-family: 'Courier New', monospace;
}

/* ── Color swatch ────────────────────────────────────────── */
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

/* ── Slider ──────────────────────────────────────────────── */
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

/* ── Role grid ───────────────────────────────────────────── */
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

/* ── Action buttons ──────────────────────────────────────── */
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

/* ════════════════════════════════════════════════════════════
   PREVIEW COLUMN
════════════════════════════════════════════════════════════ */
.preview-col {
    position: sticky;
    top: 80px;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.preview-header {
    display: flex;
    align-items: baseline;
    gap: 10px;
}

.preview-label {
    font-family: var(--font-ui);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
}

.preview-hint {
    font-size: 12px;
    color: var(--text-subtle);
}

/* Preview stage — simulate OBS scene */
.preview-stage {
    border-radius: var(--radius);
    border: 1px solid var(--border);
    overflow: hidden;
    min-height: 420px;
    position: relative;
    background: #0f0f0f;
}

/* Fake stream gameplay background */
.stream-bg {
    position: absolute;
    inset: 0;
    background:
        radial-gradient(ellipse at 30% 60%, rgba(60, 100, 150, 0.3) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 20%, rgba(100, 60, 150, 0.2) 0%, transparent 50%),
        repeating-linear-gradient(45deg,
            rgba(255, 255, 255, 0.01) 0px,
            rgba(255, 255, 255, 0.01) 1px,
            transparent 1px,
            transparent 16px);
}

/* The actual chat preview */
.preview-overlay {
    position: absolute;
    bottom: 12px;
    left: 12px;
    display: flex;
    flex-direction: column;
    max-width: calc(100% - 24px);
    overflow: hidden;
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
</style>

<style scoped>
/* ── OBS URL Card ─────────────────────────────────────────── */
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

/* glow effect บน card */
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

/* URL text box */
.obs-url-box {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 12px;
    overflow-x: auto;
    scrollbar-width: thin;
    scrollbar-color: var(--border) transparent;
}

.obs-url-text {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    display: block;
    line-height: 1.5;
}

/* Copy button — เด่นกว่าปุ่มทั่วไป */
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
</style>
