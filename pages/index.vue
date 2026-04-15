<script setup lang="ts">
/**
 * pages/loading.vue  (หรือตั้งเป็น default route ถ้าต้องการ)
 *
 * Splash screen — แสดง loading animation แล้ว redirect ไป /settings
 * ใช้เป็น entry point แทน index.vue เมื่อเปิด URL หลัก
 *
 * วิธีใช้: ใส่ใน pages/loading.vue แล้วเพิ่ม redirect ใน nuxt.config
 * หรือเพิ่ม <script> redirect ใน pages/index.vue
 */

const router = useRouter()
const progress = ref(0)
const phase = ref<'boot' | 'load' | 'done'>('boot')

const phaseText = computed(() => {
    if (phase.value === 'boot') return 'กำลังเริ่มต้นระบบ...'
    if (phase.value === 'load') return 'โหลด settings...'
    return 'พร้อมแล้ว! กำลังเข้าสู่ settings...'
})

onMounted(async () => {
    // phase 1: boot 0→55%
    phase.value = 'boot'
    await animateTo(55, 600)

    // phase 2: load settings 55→90%
    phase.value = 'load'
    await animateTo(90, 500)

    // phase 3: done 90→100%
    phase.value = 'done'
    await animateTo(100, 350)

    // รอให้ animation เสร็จแล้ว redirect
    await sleep(400)
    router.push('/settings')
})

function animateTo(target: number, duration: number): Promise<void> {
    return new Promise(resolve => {
        const start = progress.value
        const startTime = performance.now()
        function tick(now: number) {
            const t = Math.min((now - startTime) / duration, 1)
            // easeOutCubic
            progress.value = start + (target - start) * (1 - Math.pow(1 - t, 3))
            if (t < 1) requestAnimationFrame(tick)
            else { progress.value = target; resolve() }
        }
        requestAnimationFrame(tick)
    })
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }
</script>

<template>
    <div class="splash">
        <div class="bg-noise" aria-hidden="true" />

        <!-- orbs -->
        <div class="orb orb-1" aria-hidden="true" />
        <div class="orb orb-2" aria-hidden="true" />
        <div class="orb orb-3" aria-hidden="true" />

        <div class="content">
            <!-- Logo -->
            <div class="logo-wrap">
                <span class="logo-icon">🐺</span>
                <div class="logo-text-wrap">
                    <span class="logo-main">レイヱン Chat<em>Widget</em></span>
                    <span class="logo-sub">OBS Stream Overlay</span>
                </div>
            </div>

            <!-- Progress bar -->
            <div class="progress-track">
                <div class="progress-fill" :style="{ width: progress + '%' }" />
                <div class="progress-glow" :style="{ left: progress + '%' }" />
            </div>

            <!-- Status text -->
            <Transition name="fade-up" mode="out-in">
                <p :key="phase" class="status-text">{{ phaseText }}</p>
            </Transition>

            <span class="progress-pct">{{ Math.round(progress) }}%</span>
        </div>
    </div>
</template>

<style scoped>
.splash {
    min-height: 100dvh;
    background: #09090f;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    font-family: 'Noto Sans Thai Looped', sans-serif;
}

/* ── noise texture ── */
.bg-noise {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
    background-size: 200px 200px;
    pointer-events: none;
    z-index: 0;
}

/* ── glow orbs ── */
.orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
    animation: drift 8s ease-in-out infinite alternate;
}
.orb-1 {
    width: 500px; height: 500px;
    top: -150px; left: -100px;
    background: radial-gradient(circle, rgba(126, 207, 220, 0.12) 0%, transparent 70%);
    animation-duration: 9s;
}
.orb-2 {
    width: 400px; height: 400px;
    bottom: -100px; right: -80px;
    background: radial-gradient(circle, rgba(160, 100, 240, 0.10) 0%, transparent 70%);
    animation-duration: 11s;
    animation-delay: -3s;
}
.orb-3 {
    width: 300px; height: 300px;
    top: 40%; left: 55%;
    background: radial-gradient(circle, rgba(64, 196, 255, 0.07) 0%, transparent 70%);
    animation-duration: 7s;
    animation-delay: -5s;
}

@keyframes drift {
    from { transform: translate(0, 0) scale(1); }
    to   { transform: translate(30px, 20px) scale(1.05); }
}

/* ── main content ── */
.content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    width: 340px;
    max-width: 90vw;
}

/* ── logo ── */
.logo-wrap {
    display: flex;
    align-items: center;
    gap: 14px;
    animation: fadeIn 0.6s ease both;
}

.logo-icon {
    font-size: 48px;
    line-height: 1;
    filter: drop-shadow(0 0 18px rgba(126, 207, 220, 0.4));
    animation: float 3s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-6px); }
}

.logo-text-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.logo-main {
    font-family: 'Noto Serif JP', serif;
    font-size: 22px;
    font-weight: 800;
    color: #e8eaf0;
    letter-spacing: -0.02em;
    line-height: 1;
}

.logo-main em {
    font-style: normal;
    color: #7ecfdc;
}

.logo-sub {
    font-size: 11px;
    font-weight: 500;
    color: #4b5563;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

/* ── progress bar ── */
.progress-track {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 99px;
    position: relative;
    overflow: visible;
    animation: fadeIn 0.4s 0.2s ease both;
}

.progress-fill {
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, #7ecfdc, #40c4ff);
    transition: width 0.08s linear;
    position: relative;
}

.progress-glow {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #7ecfdc;
    filter: blur(10px);
    opacity: 0.6;
    pointer-events: none;
    transition: left 0.08s linear;
}

/* ── status text ── */
.status-text {
    font-size: 13px;
    color: #6b7280;
    letter-spacing: 0.01em;
    text-align: center;
    min-height: 20px;
}

.progress-pct {
    font-family: 'Noto Serif JP', serif;
    font-size: 11px;
    font-weight: 700;
    color: #7ecfdc;
    letter-spacing: 0.08em;
}

/* ── transitions ── */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
}

.fade-up-enter-active,
.fade-up-leave-active {
    transition: opacity 0.2s ease, transform 0.2s ease;
}
.fade-up-enter-from { opacity: 0; transform: translateY(6px); }
.fade-up-leave-to   { opacity: 0; transform: translateY(-4px); }
</style>