import type { Config } from 'tailwindcss'

export default {
    content: [
        './components/**/*.{vue,ts}',
        './pages/**/*.{vue,ts}',
        './composables/**/*.ts',
        './app.vue',
    ],
    theme: {
        extend: {},
    },
    plugins: [],
} satisfies Config
