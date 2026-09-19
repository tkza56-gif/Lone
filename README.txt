FinNote — ชุดไฟล์สำหรับอัปขึ้น GitHub Pages
===========================================
วันที่: 19 ก.ย. 2026   |   SW cache: finnote-v4-20260919

ไฟล์ที่ต้องอัป (วางไว้ที่ "ราก" ของ repo ห้ามอยู่ในโฟลเดอร์ย่อย)
  index.html      ← ตัวแอปทั้งหมด (คอมไพล์แล้ว ไม่มี Babel)
  sw.js           ← Service Worker
  manifest.json
  icon.svg

ขั้นตอนแก้ 404 ของ https://tkza56-gif.github.io/Lone/
  1) เปิด repo "Lone" → ดูว่ามี index.html อยู่ที่รากของ branch หรือไม่
  2) Settings → Pages → Source = Deploy from a branch
     Branch = main (หรือ master) , Folder = / (root) → Save
  3) รอ 1-2 นาที แล้วเปิด https://tkza56-gif.github.io/Lone/index.html
  4) ถ้ายัง 404 ให้ดูแท็บ Actions ว่า deploy ผ่านหรือไม่

หลังอัปเสร็จ (สำคัญ — ไอคอนหน้าจอเดิมชื่อ "เงินกู้" เป็นของเก่า)
  - ลบไอคอน "เงินกู้" ออกจากหน้าจอโฮม
  - เปิดลิงก์ใหม่ในเบราว์เซอร์ → กด "เพิ่มลงหน้าจอโฮม" ใหม่
  - ชื่อที่ถูกต้องคือ "FinNote"
  - ข้อมูลลูกหนี้ไม่หาย (เก็บใน localStorage + IndexedDB ของโดเมนเดิม)

วิธีตรวจว่าได้ไฟล์ใหม่จริง
  เปิด Console แล้วต้อง "ไม่มี" คำเตือน in-browser Babel อีก
  (ไฟล์ใหม่คอมไพล์มาแล้ว ไม่ได้ใช้ Babel ในเบราว์เซอร์)
