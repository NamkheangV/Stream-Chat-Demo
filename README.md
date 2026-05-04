# 🎮 Twitch Chat Overlay — Nuxt 3

Chat Widget สำหรับ Streamer ที่ต้องการแสดง Twitch Chat บนสตรีมแบบง่ายๆ ปรับแต่งได้ตามใจชอบ และเชื่อมต่อกับ Twitch IRC เพื่อดึงข้อมูล chat, emote, badge แบบ real-time
Developed by [ReienOkami](https://x.com/ReienOkami)

## ⚙️ ตั้งค่าใน OBS

1. Add Source → **Browser Source**
2. URL: `https://namkheangv.github.io/stream-chat-demo/`
3. Width: ตามที่ตั้งไว้ใน settings (default: `340`)
4. Height: `700` (หรือตามต้องการ)
5. Custom CSS:
   ```css
   body { background: transparent !important; overflow: hidden; }
   ```
6. ✅ **Shutdown source when not visible** 
7. ✅ **Refresh browser when scene becomes active**
<!-- เมื่อปิด/ซ่อน source จะตัดการเชื่อมต่อ Twitch IRC อัตโนมัติ (ลดโหลด CPU + memory) -->
<!-- รีเฟรชอัตโนมัติเมื่อเปลี่ยนมาใช้ฉากนี้ -->

## 🎨 ปรับแต่ง

เปิด `https://namkheangv.github.io/stream-chat-demo/settings` เพื่อ:
- เปลี่ยนสี bubble + opacity
- เปลี่ยนสี accent bar + opacity  
- ปรับสี text / ขนาด font
- ปรับความกว้าง / ช่องว่างระหว่าง message
- ปรับสี username ตาม role (broadcaster/mod/vip/sub)
- เพิ่ม/ลบ badge ที่จะแสดงใน overlay
- ดู live preview ได้ทันที

Settings จะ save อัตโนมัติใน **localStorage** และ apply ทันทีที่หน้า overlay โหลด

# 🎐 คู่มือสำหรับ Developer
สำหรับใช้งานบน OBS (ยังไม่เคยทดสอบกับโปรแกรมสตรีมอื่น ๆ) สามารถทำตามขั้นตอนนี้ได้เลย:

## โครงสร้าง Project

```
twitch-overlay/
├── pages/
│   ├── index.vue          ← Chat overlay (ใช้ใน OBS Browser Source)
│   └── settings.vue       ← หน้าปรับแต่ง สี/opacity/layout
├── composables/
│   ├── useOverlaySettings.ts  ← จัดการ settings + localStorage
│   └── useTwitchChat.ts       ← เชื่อมต่อ Twitch IRC + parse emote/badge
├── utils/
│   └── color.ts           ← hex → rgb helper
├── assets/css/
│   └── global.css         ← CSS variables (design tokens)
└── nuxt.config.ts
```

## 🚀 Dev การติดตั้ง

```bash
# 1. clone repo
git clone https://github.com/NamkheangV/stream-chat-demo.git
    
# 2. ติดตั้ง dependencies
npm install

# 3. รัน dev server
npm run dev

# 4. เปิด settings → http://localhost:3000/settings
# 5. เปิด overlay → http://localhost:3000/
```

## 🌐 Deploy (ไม่ต้อง run local)

```bash
# Build static files
1. npm run generate
2. type nul > docs/.nojekyll   # (ถ้าใช้ PowerShell) สร้างไฟล์ .nojekyll เพื่อให้ GitHub Pages แสดงไฟล์ในโฟลเดอร์ที่ขึ้นต้นด้วยจุดได้

# Upload โฟลเดอร์ .output/public/ ขึ้น:
# - GitHub Pages
# - Netlify (drag & drop)
# - Vercel
```

แล้วใช้ URL ที่ได้ใน OBS แทน localhost

## 🏷️ Badge รองรับ

| Badge | Key |
|-------|-----|
| Broadcaster | `broadcaster` |
| Moderator | `moderator` |
| VIP | `vip` |
| Subscriber | `subscriber` |
<!-- | Turbo | `turbo` |
| Partner | `partner` |
| Prime Gaming | `prime` |
| Staff | `staff` |
| Gift Sub | `sub-gifter` | -->

## 📌 Feature เพิ่มเติม (กำลังจะทำ...)

— /Settings
- [ ] รองรับ Twitch API v5 (สำหรับ badge/emote ที่ไม่ได้อยู่ใน IRC)
- [ ] เพิ่ม option ปรับ layout (เช่น bubble shape, spacing, animation)
- [ ] เพิ่ม option ปรับ font family + weight
- [✓] เพิ่มการเปลี่ยนพื้นหลัง (background) ของ preview (เช่น gradient, image)
- [ ] เพิ่มการปรับ horizontal/vertical ของ chat bubble (เช่น ให้ bubble เริ่มจากขอบซ้ายหรือขวา)
- [ ] เพิ่มการปรับเอียงของ chat bubble (เช่น ให้ bubble เอียงเล็กน้อยเพื่อความ dynamic)
- [ ] เพิ่มรูปแบบของ chat bubble เป็นตัวเลือกต่าง ๆ ตาม Themes Design หรือปรับให้สามารถแสดงเป็นแชทแนวนอนได้ (เหมาะสำหรับสตรีมที่มีพื้นที่แนวตั้งจำกัด)
- [ ] เพิ่มการรองรับ Youtube Chat (ถ้าใครอยากทำเพิ่มก็ได้)

— UX/UI
- [✓] เพิ่ม loading ก่อนเข้าหน้า settings (ตอนดึงข้อมูลจาก Twitch API)
- [ ] เพิ่ม loading state ในหน้า settings
- [ ] เปลี่ยน background ในหน้า settings ให้เป็น animation หรือ ภาพขยับได้ (ตอนนี้เป็นแค่สีทึบๆ)
- [ ] responsive design สำหรับมือถือ (ถ้าใครอยากปรับจากมือถือก็ได้)
- [ ] เพิ่ม dark mode (อาจจะใช้ prefers-color-scheme หรือ toggle ใน settings)
- [ ] เพิ่ม modal คู่มือการใช้งาน (เช่น วิธีตั้งค่าใน OBS, วิธีใช้ Twitch API)
