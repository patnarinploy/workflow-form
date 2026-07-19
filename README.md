# True CJ Creations — Workflow Mapping

เว็บแอปเก็บข้อมูล workflow แบบ "แต่ละคนกรอกเฉพาะงานของตัวเอง" แล้วระบบเอาคำตอบทุกคนมาต่อกันเป็นผังอัตโนมัติ โดยใช้ "จุดส่งงาน" (ได้มาจากใคร / ส่งให้ใครต่อ) เป็นตัวเชื่อม

หลักการสำคัญ: **ทุกช่องที่อ้างถึงคนเป็น dropdown เลือกจากรายชื่อ 32 คน เก็บเป็น `person_id` เท่านั้น ไม่มี free text** จึงจับคู่การส่งงานสองฝั่งได้

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + RLS) — เขียนผ่าน service role ฝั่ง server, anon อ่านคำตอบคนอื่นไม่ได้
- React Flow + dagre สำหรับผัง swimlane

## หน้า

- `/` — เลือกว่าคุณคือใคร (combobox ค้นหาได้) จำใน localStorage
- `/form/[personId]` — กรอกรายการงานของตัวเอง (autosave, ส่งซ้ำแล้ว upsert)
- `/thanks` — สรุปว่ากรอกไปกี่งาน
- `/admin` — ป้องกันด้วย `ADMIN_PASSWORD` มี 4 แท็บ:
  1. ความคืบหน้า — ใครส่งแล้ว/ยัง
  2. จุดที่ไม่ตรงกัน — reconciliation: จับคู่ได้ / เส้นข้างเดียว (ไม่ตรง vs รออีกฝ่าย) / งานกำพร้า
  3. ผังที่ประกอบได้ — swimlane ตาม group, เส้นทึบ = ยืนยันสองฝั่ง, เส้นประส้ม = ข้างเดียว
  4. ภาระงาน — จำนวนงาน/เส้นเข้า-ออก/จุดอนุมัติ ชี้คอขวด

## Setup

1. `npm install`
2. ตั้งค่า `.env.local` (ดู `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`
3. `npm run dev`

## Database

ตาราง `responses`, `tasks`, `task_links` (person หลายค่าต่อ task เก็บเป็นแถวแยกใน `task_links`, `kind` = from/to/approver/rework) สร้างไว้ใน Supabase project ผ่าน migration แล้ว รายชื่อพนักงาน hardcode ใน `lib/staff.ts` ไม่เก็บใน DB

---

## หน้าผังงาน (Diagram) — 3 โหมด

แท็บ "ผัง" ในหน้า `/admin` มี 3 โหมด สลับได้ด้วยปุ่มด้านบน (จำโหมด/ตัวเลือกไว้ใน URL query แชร์ลิงก์ได้):

- **รายงาน (A)** — swimlane ทีละ 1 งาน (job) โชว์เฉพาะตำแหน่งที่งานนั้นแตะ มีตัวกรองโชว์/ซ่อน lane
- **รายตำแหน่ง (B)** — 3 คอลัมน์ต่อ 1 ตำแหน่ง (component เดิม เก็บใน `components/diagram/legacy/`)
- **ภาพรวม (C)** — แผนที่จุด-เส้น force-directed (component เดิม เก็บใน `components/diagram/legacy/`)

โหมด B/C ถูกย้ายไป `components/diagram/legacy/` เก็บไว้เป็นทางเลือก (ไม่ได้ลบ) ยังกดสลับใช้ได้

### วิธีย้อนกลับหน้าผังไปเวอร์ชันก่อนมีแบบ A
เวอร์ชันก่อนเพิ่มแบบ A (มีแค่ B/C) ถูก tag ไว้ที่ `diagram-bc-stable` และอยู่บน branch `claude/new-session-gg5p9o`

- ย้อนทั้งหมด: `git checkout claude/new-session-gg5p9o` (โหมด B/C ครบเหมือนเดิม)
- กู้เฉพาะไฟล์: `git checkout diagram-bc-stable -- <path>`
- งานแบบ A พัฒนาบน branch `diagram-view-a` — ถ้าผ่านค่อย merge เข้า `claude/new-session-gg5p9o`
