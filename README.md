# Maka — ระบบเช็คชื่อเข้าเรียนด้วยใบหน้า

> **"มาค่ะ"** — App เช็คชื่อเข้าเรียนด้วยใบหน้า สำหรับสถาบันการศึกษา

Maka เป็นระบบบันทึกการเข้าเรียนอัจฉริยะที่สร้างด้วย **Next.js 15** และ **Supabase** ใช้เทคโนโลยี Face Recognition ทำงานใน browser โดยตรง ไม่ส่งรูปภาพขึ้น server — ปลอดภัยและเป็นส่วนตัวตาม PDPA

---

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---|---|
| 😊 สแกนใบหน้า | นักศึกษา scan ใบหน้าผ่านกล้องมือถือ เปรียบเทียบ face embedding แบบ real-time |
| 🔢 รหัสคาบ (PIN) | ทางเลือกสำหรับผู้ที่ไม่มีกล้อง — อาจารย์แสดง PIN 4 หลักบนจอ |
| 📍 ตรวจสอบ GPS | ยืนยันว่านักศึกษาอยู่ในรัศมี 10 เมตรจากห้องเรียนจริง |
| 📊 รายงานละเอียด | สถิติรายคาบ/รายบุคคล พร้อม Export เป็น Excel (.xlsx) |
| 📋 อัปโหลด Roster | อาจารย์อัปโหลดรายชื่อจาก Excel เพื่อจับคู่กับบัญชีนักศึกษา |
| 🔒 ความเป็นส่วนตัว | ไม่เก็บรูปภาพ — จัดเก็บเฉพาะ face embedding (ตัวเลข 128 มิติ) |
| ⏱️ สถานะอัตโนมัติ | ตรงเวลา / มาสาย / ขาด — คำนวณจาก threshold ที่ตั้งไว้ต่อคาบ |

---

## 🛠 Tech Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript
- **Backend/Database:** Supabase (PostgreSQL, Auth, Row-Level Security)
- **AI:** [@vladmandic/face-api](https://github.com/vladmandic/face-api) — SSD MobileNet V1, Face Landmark, Face Recognition (ทำงานใน browser ทั้งหมด)
- **Geolocation:** Browser Geolocation API + Haversine Formula
- **Export:** SheetJS (xlsx)
- **Fonts:** Mitr (Thai UI), Caveat (accent)
- **Deployment:** Vercel

---

## 📋 ความต้องการเบื้องต้น

- **Node.js** v18 หรือสูงกว่า
- **npm** v9 หรือสูงกว่า
- บัญชี **Supabase** (ฟรี) — [supabase.com](https://supabase.com)
- บัญชี **Vercel** (ฟรี) สำหรับ deploy — [vercel.com](https://vercel.com)

---

## 🚀 ติดตั้งและรันบนเครื่อง (Local Development)

### 1. Clone โปรเจกต์

```bash
git clone https://github.com/<your-username>/maka-app.git
cd maka-app
```

### 2. ติดตั้ง dependencies

```bash
npm install
```

> `postinstall` จะ copy โมเดล face-api ไปไว้ที่ `public/models/` อัตโนมัติ

### 3. ตั้งค่า Supabase

#### 3.1 สร้าง Supabase Project

1. ไปที่ [app.supabase.com](https://app.supabase.com) → **New project**
2. ตั้งชื่อ project และ database password
3. รอให้ project พร้อม (ประมาณ 1–2 นาที)

#### 3.2 รัน Migrations

ไปที่ **SQL Editor** ใน Supabase Dashboard แล้วรัน SQL ไฟล์ตามลำดับ:

```
supabase/migrations/20260620_0001_initial_schema.sql
supabase/migrations/20260621_0002_policies_and_vector128.sql
supabase/migrations/20260622_0003_student_write_policies.sql
supabase/migrations/20260622_0004_course_schedule.sql
supabase/migrations/20260622_0005_student_roster.sql
supabase/migrations/20260622_0006_delete_features.sql
supabase/migrations/20260622_0007_session_geolocation.sql
supabase/migrations/20260623_0008_session_pin.sql
```

> วิธีง่ายสุด: เปิดแต่ละไฟล์ → copy ทั้งหมด → วางใน SQL Editor → กด **Run**

#### 3.3 เปิดใช้ pgvector Extension

ไปที่ **Database → Extensions** → ค้นหา `vector` → เปิดใช้งาน

### 4. สร้างไฟล์ `.env.local`

```bash
cp .env.example .env.local
```

เปิด `.env.local` และใส่ค่าจาก Supabase Dashboard (**Settings → API**):

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. รันโปรเจกต์

```bash
npm run dev
```

เปิดเบราว์เซอร์ที่ [http://localhost:3000](http://localhost:3000)

---

## 👤 ตั้งค่าครั้งแรก (First-time Setup)

### 1. สมัครบัญชีผ่านแอป

ไปที่ `/auth` → ลงทะเบียนบัญชีอาจารย์และนักศึกษา (อย่างน้อย 1 อาจารย์)

### 2. ตั้งค่า role อาจารย์

เปิด `supabase/seed.sql` แก้ไข email ให้ตรงกับที่สมัครไว้:

```sql
c_teacher_email  constant text := 'your-teacher@email.com';
c_student1_email constant text := 'student1@example.com';  -- ถ้ามี
```

จากนั้นรัน SQL นี้ใน **Supabase SQL Editor**

> ⚠️ ขั้นตอนนี้สำคัญ — บัญชีที่เพิ่งสมัครจะเป็น `student` ทั้งหมด ต้องรัน seed เพื่อเปลี่ยน role เป็น `teacher`

---

## 🌐 Deploy บน Vercel

### 1. Push โค้ดขึ้น GitHub

```bash
git add .
git commit -m "initial commit"
git push origin main
```

### 2. Import โปรเจกต์ใน Vercel

1. ไปที่ [vercel.com](https://vercel.com) → **Add New Project**
2. เลือก repository จาก GitHub
3. ตั้งค่า **Framework Preset** เป็น **Next.js**
4. ใส่ Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. กด **Deploy**

### 3. อัปเดต Supabase Auth Settings

ไปที่ Supabase → **Authentication → URL Configuration**:
- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** `https://your-app.vercel.app/**`

---

## 📱 วิธีใช้งาน

### สำหรับอาจารย์

1. **เข้าสู่ระบบ** ด้วยบัญชีที่มี role = teacher
2. **สร้างรายวิชา** — ใส่รหัสวิชา, ชื่อวิชา, ห้องเรียน
3. **อัปโหลด Roster** — upload ไฟล์ Excel รายชื่อนักศึกษา (คอลัมน์ `email` หรือ `student_id`)
4. **เปิดคาบ** — ระบบบันทึก GPS ของอาจารย์ และสุ่ม PIN 4 หลัก แสดงบนหน้าจอ
5. **ดูรายงาน** — ดูสถิติรายคาบ และ Export เป็น Excel ได้

### สำหรับนักศึกษา

1. **ลงทะเบียน** — สมัครบัญชีด้วยอีเมลมหาวิทยาลัย
2. **ลงทะเบียนใบหน้า** — ถ่ายรูปใบหน้า 1 ครั้งเพื่อ enroll
3. **เช็คชื่อ** (เลือกวิธี):
   - **สแกนใบหน้า** — เปิดกล้อง → ระบบ verify อัตโนมัติ
   - **รหัสคาบ** — กรอก PIN 4 หลักที่อาจารย์แสดง
4. ทั้ง 2 วิธีต้องอยู่ในรัศมี **10 เมตร** จากห้องเรียน

---

## 🗄 Database Schema (สรุป)

```
profiles          — ข้อมูลผู้ใช้ (role: student | teacher | admin)
courses           — รายวิชา
course_members    — ความสัมพันธ์ นักศึกษา ↔ วิชา
sessions          — คาบเรียน (open/closed, GPS, PIN)
face_templates    — face embedding 128 มิติ (ไม่เก็บรูป)
attendance        — บันทึกการเข้าเรียน (on-time | late | absent)
audit_logs        — log การกระทำสำคัญ
```

---

## 📁 โครงสร้างโปรเจกต์

```
maka-app/
├── app/
│   ├── auth/               — หน้า Login / Register
│   │   ├── page.tsx
│   │   └── register/
│   │       ├── student/
│   │       └── teacher/
│   ├── teacher/            — dashboard อาจารย์
│   ├── student/            — dashboard นักศึกษา
│   ├── about/              — หน้าเกี่ยวกับแอป
│   ├── globals.css
│   └── layout.tsx
├── lib/
│   └── supabase.ts         — Supabase client
├── public/
│   ├── models/             — face-api.js models (auto-copied)
│   └── *.png               — รูปภาพ
├── supabase/
│   ├── migrations/         — SQL migrations (รันตามลำดับ)
│   └── seed.sql            — initial data setup
└── .env.example
```

---

## 🔧 Scripts

```bash
npm run dev       # รัน development server
npm run build     # build สำหรับ production
npm run start     # รัน production server
npm run lint      # ตรวจสอบ code style
```

---

## 🙋 ปัญหาที่พบบ่อย

**Q: หน้าจอขึ้น "Supabase ยังไม่ได้ตั้งค่า"**  
A: ตรวจสอบว่ามีไฟล์ `.env.local` และค่า `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` ถูกต้อง

**Q: Build error — `Cannot find module './833.js'` หรือ face-api chunk error**  
A: ลบ cache แล้วรันใหม่:
```bash
rm -rf .next
npm run dev
```

**Q: เข้าสู่ระบบแล้วถูก redirect ไปหน้านักศึกษาแทนที่จะเป็นอาจารย์**  
A: ต้องรัน `supabase/seed.sql` เพื่อเปลี่ยน role ของบัญชีเป็น `teacher`

**Q: สแกนใบหน้าไม่ผ่าน (similarity ต่ำ)**  
A: ให้ลอง enroll ใบหน้าใหม่ในที่ที่มีแสงสว่างเพียงพอ และมองตรงเข้ากล้อง

**Q: GPS ไม่ผ่าน (อยู่ในห้องเรียนแต่ยังบอกว่าไกลเกิน)**  
A: ให้อาจารย์ลองปิด-เปิดคาบใหม่ใน จุดที่ GPS signal ชัดเจน เช่น ใกล้หน้าต่าง

---

## 👩‍💻 ผู้พัฒนา

**Pattaraporn Warintarawej (ปัฏฐาภรณ์ วารินทราเวช)**  
มหาวิทยาลัยสงขลานครินทร์ (PSU)  
📧 [pattaraporn.w@psu.ac.th](mailto:pattaraporn.w@psu.ac.th)

---

## ☕ สนับสนุนค่ากาแฟ

หาก Maka มีประโยชน์สำหรับคุณ สามารถสนับสนุนผู้พัฒนาผ่าน **PromptPay** ได้เลย  
สแกน QR Code ในหน้า [/about](./app/about/page.tsx) ของแอป

---

## 📄 License

MIT License — ใช้และดัดแปลงได้อย่างอิสระ
