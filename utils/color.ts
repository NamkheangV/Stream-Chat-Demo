/**
 * utils/color.ts
 * Helper functions สำหรับ color conversion
 */

/** แปลง hex string → "r, g, b" string (สำหรับใช้ใน rgba()) */
export function hexToRgbStr(hex: string): string {
    const clean = hex.replace('#', '')
    const num = parseInt(clean.length === 3
        ? clean.split('').map(c => c + c).join('')
        : clean, 16)
    const r = (num >> 16) & 255
    const g = (num >> 8) & 255
    const b = num & 255
    return `${r}, ${g}, ${b}`
}

/** แปลง hex → { r, g, b } object */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const [r, g, b] = hexToRgbStr(hex).split(', ').map(Number)
    return { r, g, b }
}
