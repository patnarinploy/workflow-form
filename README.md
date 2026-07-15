# Workflow Mapping Form

เว็บแอปเก็บข้อมูล workflow ของแต่ละทีม เพื่อนำไปวาดผัง swimlane ต่อ

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + RLS) สำหรับเก็บข้อมูล
- `/` แบบฟอร์ม 7 ส่วน, autosave ลง localStorage, validate required fields
- `/thanks` หน้าขอบคุณ
- `/admin` หน้าดูผล ป้องกันด้วยรหัสผ่าน (`ADMIN_PASSWORD`)

## Setup

1. ติดตั้ง dependency

   ```bash
   npm install
   ```

2. ตั้งค่า environment variables ใน `.env.local` (ดู `.env.local.example`)

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ADMIN_PASSWORD=
   ```

   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: จากหน้า Supabase Dashboard → Settings → API
   - `SUPABASE_SERVICE_ROLE_KEY`: จากหน้าเดียวกัน (secret key, **ห้าม commit / ห้ามส่งให้ browser**) ใช้ฝั่ง server เท่านั้น (API routes รับ submit และหน้า admin)
   - `ADMIN_PASSWORD`: รหัสผ่านสำหรับเข้าหน้า `/admin`

3. รัน dev server

   ```bash
   npm run dev
   ```

   เปิด [http://localhost:3000](http://localhost:3000)

## Database

Table `submissions` และ `steps` ถูกสร้างไว้แล้วบน Supabase project ผ่าน migration RLS เปิด insert แบบ public (anon) แต่ select ทำได้เฉพาะผ่าน service role key ฝั่ง server เท่านั้น

## Deploy

Deploy ขึ้น [Vercel](https://vercel.com/new) แล้วตั้งค่า environment variables ชุดเดียวกับข้างบนในหน้า Project Settings → Environment Variables
