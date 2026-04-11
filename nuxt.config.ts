export default defineNuxtConfig({
    compatibilityDate: '2024-11-01',
    devtools: { enabled: false },

    // ── GitHub Pages via /docs folder ────────────────────────
    // เปลี่ยน '/twitch-overlay/' ให้ตรงกับชื่อ repo ของคุณ
    app: {
        baseURL: '/twitch-overlay/',

        head: {
            link: [
                { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=Noto+Sans+Thai:wght@300;400;500;700&display=swap',
                },
            ],
        },
    },

    // SPA mode — static HTML
    ssr: false,

    modules: ['@nuxtjs/tailwindcss'],
    css: ['~/assets/css/global.css'],

    // output ไปที่ docs/ แทน .output/public/
    nitro: {
        output: {
            publicDir: 'docs',
        },
    },
})
