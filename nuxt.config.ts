// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  ssr: false,
  nitro: {
    preset: 'static'
  },

  modules: ['@nuxtjs/tailwindcss'],

  // CSS global: ใส่ Google Fonts + base styles
  css: ['~/assets/css/global.css'],

  // app head
  app: {
    baseURL: '/stream-chat-demo/',
    head: {
      link: [
        {
          rel: 'preconnect',
          href: 'https://fonts.googleapis.com',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=Noto+Sans+Thai:wght@300;400;500;700&display=swap',
        },
      ],
    },
  },
})
