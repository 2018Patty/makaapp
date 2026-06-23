'use client'

import Link from 'next/link'
import Image from 'next/image'

const TECH_STACK = [
  {
    category: 'Frontend',
    items: [
      { name: 'Next.js 15', desc: 'App Router, Server Components, Static Generation' },
      { name: 'React 18', desc: 'UI library with hooks and concurrent features' },
      { name: 'TypeScript', desc: 'Type-safe JavaScript สำหรับ codebase ที่มั่นคง' },
    ],
  },
  {
    category: 'Backend & Database',
    items: [
      { name: 'Supabase', desc: 'PostgreSQL database, Authentication, Realtime subscriptions, Row-Level Security' },
      { name: 'PostgREST', desc: 'Auto-generated REST API จาก PostgreSQL schema' },
    ],
  },
  {
    category: 'AI & Computer Vision',
    items: [
      { name: 'face-api.js', desc: 'Face detection และ 128-D face embedding สำหรับจดจำใบหน้า (ทำงานใน browser ทั้งหมด ไม่ส่งรูปขึ้น server)' },
      { name: 'SSD MobileNet v1', desc: 'Neural network model สำหรับตรวจจับใบหน้า' },
    ],
  },
  {
    category: 'ฟีเจอร์เสริม',
    items: [
      { name: 'Geolocation API', desc: 'ยืนยันตำแหน่ง GPS ของนักศึกษาในรัศมี 10 เมตรจากห้องเรียน' },
      { name: 'XLSX (SheetJS)', desc: 'Export รายงานการเข้าเรียนเป็นไฟล์ Excel (.xlsx)' },
      { name: 'Haversine Formula', desc: 'คำนวณระยะทางจากพิกัด GPS แม่นยำระดับเมตร' },
    ],
  },
  {
    category: 'Design & Deployment',
    items: [
      { name: 'Google Fonts', desc: 'Mitr (Thai UI), Caveat (handwriting accent)' },
      { name: 'Vercel', desc: 'Edge deployment พร้อม CI/CD จาก GitHub อัตโนมัติ' },
      { name: 'Custom CSS', desc: 'Mobile-first design system ที่ออกแบบเฉพาะสำหรับ app นี้' },
    ],
  },
]

const FEATURES = [
  { icon: '😊', title: 'เช็คชื่อด้วยใบหน้า', desc: 'นักศึกษา scan ใบหน้าผ่านกล้องมือถือ ระบบเปรียบเทียบ face embedding แบบ real-time' },
  { icon: '🔢', title: 'เช็คชื่อด้วยรหัสคาบ', desc: 'ทางเลือกสำหรับผู้ที่ไม่มีกล้อง — อาจารย์แสดง PIN 4 หลักบนจอโปรเจกเตอร์' },
  { icon: '📍', title: 'ยืนยันตำแหน่ง GPS', desc: 'ป้องกันการเช็คชื่อจากนอกห้องเรียน — ต้องอยู่ในรัศมี 10 เมตรจากที่อาจารย์เปิดคาบ' },
  { icon: '📊', title: 'รายงานละเอียด', desc: 'ดูสถิติรายคาบและรายบุคคล พร้อม export เป็น Excel (.xlsx) ได้ทันที' },
  { icon: '📋', title: 'อัปโหลดรายชื่อ', desc: 'อาจารย์อัปโหลด roster จาก Excel เพื่อจับคู่กับบัญชีนักศึกษาอัตโนมัติ' },
  { icon: '🔒', title: 'ความเป็นส่วนตัว', desc: 'ไม่เก็บรูปภาพใบหน้า — จัดเก็บเฉพาะ face embedding (ตัวเลข) ตาม PDPA' },
]

export default function AboutPage() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)',
      fontFamily: '"Mitr", sans-serif',
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, #c0604a 100%)',
        padding: '48px 24px 40px',
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 20, background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 900, margin: '0 auto 16px',
          border: '2px solid rgba(255,255,255,0.4)',
        }}>
          M
        </div>
        <h1 style={{ margin: '0 0 6px', fontSize: 32, fontWeight: 700, letterSpacing: 1 }}>Maka</h1>
        <p style={{ margin: '0 0 10px', fontSize: 15, opacity: 0.9 }}>
          App เช็คชื่อเข้าเรียนด้วยใบหน้า
        </p>
        <p style={{ margin: 0, opacity: 0.85, fontFamily: 'Caveat, cursive', fontSize: 20 }}>
          Smile in. Learn on.
        </p>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 20px 60px' }}>

        {/* Screenshots */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 14px', color: 'var(--ink)' }}>ตัวอย่างหน้าจอ</h2>
          <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid var(--line)', marginBottom: 12 }}>
            <Image
              src="/DesktopMockUp.png"
              alt="Maka Desktop"
              width={1200}
              height={750}
              style={{ width: '100%', height: 'auto', display: 'block' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ borderRadius: 28, overflow: 'hidden', border: '1.5px solid var(--line)', maxWidth: 280 }}>
              <Image
                src="/MobileMockup.png"
                alt="Maka Mobile"
                width={560}
                height={1120}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          </div>
        </section>

        {/* About */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 14px', color: 'var(--ink)' }}>เกี่ยวกับ Maka</h2>
          <div style={{
            background: '#fff', borderRadius: 18, padding: '20px 22px',
            border: '1.5px solid var(--line)', lineHeight: 1.8,
            fontSize: 14, color: 'var(--ink)',
          }}>
            <p style={{ margin: '0 0 12px' }}>
              <strong>Maka</strong> คือระบบเช็คชื่อเข้าเรียนอัจฉริยะ ออกแบบมาเพื่อ<strong>อำนวยความสะดวกให้อาจารย์</strong>
              ในการบันทึกการเข้าเรียนของนักศึกษาอย่างรวดเร็ว แม่นยำ และปลอดภัย
            </p>
            <p style={{ margin: '0 0 12px' }}>
              อาจารย์เพียงเปิดคาบเรียนบนมือถือ นักศึกษาสามารถ<strong>สแกนใบหน้า</strong>หรือ<strong>ใช้รหัสคาบ</strong>เพื่อเช็คชื่อได้ทันที
              ระบบบันทึกสถานะอัตโนมัติ — ตรงเวลา, มาสาย, ขาด
            </p>
            <p style={{ margin: 0 }}>
              อาจารย์สามารถดูรายงานสรุปการเข้าเรียนรายคาบ รายบุคคล และ<strong>export เป็น Excel</strong>
              เพื่อนำไปใช้ประเมินผลหรือรายงานต่อหน่วยงานได้ทันที
            </p>
          </div>
        </section>

        {/* Features */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 14px', color: 'var(--ink)' }}>ฟีเจอร์หลัก</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: '#fff', borderRadius: 16, padding: '16px 18px',
                border: '1.5px solid var(--line)', display: 'flex', gap: 14, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1.2 }}>{f.icon}</span>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700 }}>{f.title}</h4>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--soft)', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tech Stack */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 14px', color: 'var(--ink)' }}>เทคโนโลยีที่ใช้พัฒนา</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {TECH_STACK.map(cat => (
              <div key={cat.category} style={{
                background: '#fff', borderRadius: 16, overflow: 'hidden',
                border: '1.5px solid var(--line)',
              }}>
                <div style={{
                  background: 'color-mix(in srgb, var(--accent) 8%, #fff)',
                  padding: '10px 18px',
                  borderBottom: '1px solid var(--line)',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{cat.category}</span>
                </div>
                {cat.items.map((item, i) => (
                  <div key={item.name} style={{
                    padding: '12px 18px',
                    borderTop: i > 0 ? '1px solid var(--line)' : 'none',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--accent)', flexShrink: 0, marginTop: 6,
                    }} />
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{item.name}</span>
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--soft)', lineHeight: 1.6 }}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        {/* Developer */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 14px', color: 'var(--ink)' }}>ผู้พัฒนา</h2>
          <div style={{
            background: '#fff', borderRadius: 18, padding: '22px',
            border: '1.5px solid var(--line)',
            display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent) 0%, #c0604a 100%)',
              display: 'grid', placeItems: 'center',
              fontSize: 26, color: '#fff', fontWeight: 700,
            }}>
              P
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>
                Pattaraporn Warintarawej
              </h3>
              <p style={{ margin: '0 0 2px', fontSize: 13, color: 'var(--soft)' }}>
                ภัทราพร วรินทรเวช
              </p>
              <a
                href="mailto:pattaraporn.w@psu.ac.th"
                style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none' }}
              >
                pattaraporn.w@psu.ac.th
              </a>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--soft)' }}>
                มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตสุราษฎร์ธานี (PSU Surat)
              </p>
            </div>
          </div>
        </section>

        {/* Support / Coffee */}
        <section style={{ marginBottom: 36 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 6px', color: 'var(--ink)' }}>สนับสนุนค่ากาแฟ ☕</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--soft)' }}>
            หาก Maka มีประโยชน์สำหรับคุณ สามารถสนับสนุนผู้พัฒนาผ่าน PromptPay ได้เลยครับ/ค่ะ
          </p>
          <div style={{
            background: '#fff', borderRadius: 18, padding: '28px 22px',
            border: '1.5px solid var(--line)', textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-block',
              borderRadius: 16, overflow: 'hidden',
              border: '3px solid var(--line)',
              marginBottom: 16,
            }}>
              <Image
                src="/qr-promptpay.png"
                alt="PromptPay QR Code"
                width={260}
                height={340}
                style={{ display: 'block', width: 260, height: 'auto' }}
              />
            </div>
            <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
              สแกน QR Code ด้วยแอปธนาคาร
            </p>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--soft)' }}>
              PromptPay · Pattaraporn Warintarawej
            </p>
          </div>
        </section>

        {/* Version */}
        <div style={{
          textAlign: 'center', padding: '20px 0 0',
          borderTop: '1px solid var(--line)',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 12, color: 'var(--soft)' }}>
            Maka App v1.0 · © 2026 Pattaraporn Warintarawej
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 11, color: 'var(--soft)', opacity: 0.6 }}>
            Built with Next.js · Supabase · face-api.js
          </p>
          <Link
            href="/auth"
            style={{
              display: 'inline-block',
              padding: '10px 28px', borderRadius: 14,
              background: 'var(--accent)', color: '#fff',
              textDecoration: 'none', fontSize: 14, fontWeight: 600,
            }}
          >
            กลับหน้าหลัก
          </Link>
        </div>

      </div>
    </div>
  )
}
