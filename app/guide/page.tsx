'use client'

import Link from 'next/link'
import { useState } from 'react'

type Tab = 'student' | 'teacher'

const STUDENT_STEPS = [
  {
    step: 1,
    icon: '📝',
    title: 'ลงทะเบียนสมัครบัญชี',
    desc: 'ไปที่หน้าหลัก กด "ลงทะเบียนนักศึกษา" แล้วกรอก ชื่อ-นามสกุล, รหัสนักศึกษา, คณะ, อีเมล และรหัสผ่าน จากนั้นยอมรับนโยบาย PDPA และกด "สมัครสมาชิก"',
    note: null,
  },
  {
    step: 2,
    icon: '😊',
    title: 'บันทึกใบหน้า',
    desc: 'เมื่อเข้าสู่ระบบครั้งแรก ระบบจะให้บันทึกใบหน้า กด "เปิดกล้อง" แล้วมองตรงเข้ากล้องในที่ที่มีแสงสว่างเพียงพอ กด "บันทึกใบหน้า" เมื่อระบบตรวจจับใบหน้าได้',
    note: 'ทำเพียงครั้งเดียว ไม่มีการเก็บรูปภาพ — บันทึกเฉพาะ face embedding',
  },
  {
    step: 3,
    icon: '📋',
    title: 'เข้าร่วมรายวิชา',
    desc: 'รายวิชาจะปรากฏอัตโนมัติเมื่ออาจารย์อัปโหลดรายชื่อ (roster) และจับคู่ email กับบัญชีของคุณแล้ว ถ้ายังไม่เห็นวิชา ให้แจ้งอาจารย์ผู้สอนค่ะ',
    note: null,
  },
  {
    step: 4,
    icon: '📷',
    title: 'เช็คชื่อด้วยการสแกนใบหน้า',
    desc: 'เมื่ออาจารย์เปิดคาบ กดปุ่ม "📷 สแกนหน้า" บนการ์ดวิชา กด "เปิดกล้อง" แล้วมองตรงเข้ากล้อง ระบบจะเปรียบเทียบใบหน้าและบันทึกเข้าเรียนอัตโนมัติ',
    note: 'ต้องอยู่ในรัศมี 10 เมตรจากห้องเรียน (GPS ยืนยัน)',
  },
  {
    step: 5,
    icon: '🔢',
    title: 'เช็คชื่อด้วยรหัสคาบ (ไม่มีกล้อง)',
    desc: 'ถ้าไม่มีกล้อง กดปุ่ม "🔢 รหัสคาบ" แล้วกรอกรหัส 4 หลักที่อาจารย์แสดงบนจอโปรเจกเตอร์ กด "ยืนยัน" เพื่อเช็คชื่อ',
    note: 'ต้องอยู่ในรัศมี 10 เมตรจากห้องเรียนเช่นกัน',
  },
  {
    step: 6,
    icon: '📊',
    title: 'ดูประวัติการเข้าเรียน',
    desc: 'กดแท็บ "ประวัติ" ที่เมนูด้านล่าง เพื่อดูสถิติการเข้าเรียนของตัวเองในแต่ละวิชา แสดงสถานะ ตรงเวลา / มาสาย / ขาด',
    note: null,
  },
]

const TEACHER_STEPS = [
  {
    step: 1,
    icon: '📝',
    title: 'ลงทะเบียนและตั้งค่า role อาจารย์',
    desc: 'สมัครบัญชีผ่านหน้า "ลงทะเบียนอาจารย์" จากนั้นแอดมินต้องเปลี่ยน role ของบัญชีเป็น "teacher" ใน Supabase SQL Editor โดยรัน seed.sql',
    note: 'บัญชีที่เพิ่งสมัครจะเป็น student ทั้งหมด ต้องเปลี่ยน role ก่อนใช้งาน',
  },
  {
    step: 2,
    icon: '📚',
    title: 'สร้างรายวิชา',
    desc: 'กดปุ่ม "+" (เพิ่มวิชา) กรอกรหัสวิชา ชื่อวิชา และห้องเรียน กด "บันทึก" รายวิชาจะปรากฏในหน้าหลัก',
    note: null,
  },
  {
    step: 3,
    icon: '📋',
    title: 'อัปโหลดรายชื่อนักศึกษา (Roster)',
    desc: 'กดไอคอน Excel บนการ์ดวิชา เลือกไฟล์ .xlsx ที่มีคอลัมน์ email หรือ student_id ระบบจะจับคู่กับบัญชีนักศึกษาที่มีอยู่อัตโนมัติ',
    note: 'ไฟล์ Excel ต้องมีคอลัมน์ "email" หรือ "student_id" อย่างน้อยหนึ่งอย่าง',
  },
  {
    step: 4,
    icon: '▶️',
    title: 'เปิดคาบเรียน',
    desc: 'กดปุ่ม "เปิดคาบ" บนการ์ดวิชา ตั้งค่าเวลาเริ่มเรียนและจำนวนนาทีที่ถือว่า "มาสาย" กด "เปิดคาบ" ระบบจะบันทึก GPS ของคุณและสุ่มรหัส PIN 4 หลัก',
    note: 'แสดง PIN บนโปรเจกเตอร์เพื่อให้นักศึกษาที่ไม่มีกล้องใช้',
  },
  {
    step: 5,
    icon: '⏹️',
    title: 'ปิดคาบเรียน',
    desc: 'กดปุ่ม "ปิดคาบ" เมื่อเลิกเรียน ระบบจะบันทึกสถานะ "ขาด" ให้กับนักศึกษาที่ยังไม่ได้เช็คชื่อโดยอัตโนมัติ',
    note: null,
  },
  {
    step: 6,
    icon: '📊',
    title: 'ดูรายงานและ Export',
    desc: 'กดแท็บ "รายงาน" เพื่อดูสถิติรายคาบและรายบุคคล กดปุ่ม Export เพื่อดาวน์โหลดไฟล์ Excel (.xlsx) สำหรับนำไปประเมินผล',
    note: null,
  },
  {
    step: 7,
    icon: '🔄',
    title: 'ล้างข้อมูลการเข้าเรียน (Reset)',
    desc: 'กดไอคอน Reset (วงกลมลูกศร) บนการ์ดวิชา เพื่อลบข้อมูล session และการเข้าเรียนทั้งหมดในวิชานั้น โดยไม่ลบรายชื่อนักศึกษา',
    note: 'ไม่สามารถกู้คืนได้ — ทำเมื่อต้องการเริ่มต้นใหม่สำหรับภาคการศึกษาใหม่',
  },
]

export default function GuidePage() {
  const [tab, setTab] = useState<Tab>('student')
  const steps = tab === 'student' ? STUDENT_STEPS : TEACHER_STEPS

  return (
    <div className="about-page">

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, #c0604a 100%)',
        padding: '48px 24px 40px',
        textAlign: 'center',
        color: '#fff',
      }}>
        <img src="/brand/maka-logo-mono.svg" alt="Maka" width={64} height={64}
          style={{ display: 'block', margin: '0 auto 14px' }} />
        <h1 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 700 }}>คู่มือการใช้งาน</h1>
        <p style={{ margin: 0, fontSize: 15, opacity: 0.9, fontFamily: '"Mitr", sans-serif' }}>
          Maka — ระบบเช็คชื่อเข้าเรียนด้วยใบหน้า
        </p>
      </div>

      <div className="about-content">

        {/* Tab switcher */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 28,
          background: '#fff', borderRadius: 16, padding: 6,
          border: '1.5px solid var(--line)',
        }}>
          {(['student', 'teacher'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 12, border: 'none',
                cursor: 'pointer', fontFamily: '"Mitr", sans-serif', fontSize: 15, fontWeight: 600,
                background: tab === t ? 'var(--accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--soft)',
                transition: 'all 0.18s',
              }}
            >
              {t === 'student' ? '🎓 นักศึกษา' : '👩‍🏫 อาจารย์'}
            </button>
          ))}
        </div>

        {/* Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 40 }}>
          {steps.map(s => (
            <div key={s.step} style={{
              background: '#fff', borderRadius: 18,
              border: '1.5px solid var(--line)',
              padding: '18px 20px',
              display: 'flex', gap: 16, alignItems: 'flex-start',
            }}>
              {/* Step number */}
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: 'color-mix(in srgb, var(--accent) 12%, #fff)',
                border: '2px solid color-mix(in srgb, var(--accent) 25%, transparent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'var(--accent)',
              }}>
                {s.step}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 20 }}>{s.icon}</span>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{s.title}</h3>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)', lineHeight: 1.7 }}>{s.desc}</p>
                {s.note && (
                  <div style={{
                    marginTop: 10, padding: '8px 12px', borderRadius: 10,
                    background: 'color-mix(in srgb, var(--accent) 8%, #fff)',
                    borderLeft: '3px solid var(--accent)',
                    fontSize: 13, color: 'var(--soft)', lineHeight: 1.6,
                  }}>
                    ℹ️ {s.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <section style={{ marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, margin: '0 0 14px', color: 'var(--ink)' }}>คำถามที่พบบ่อย</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              {
                q: 'สแกนใบหน้าไม่ผ่าน ทำอย่างไร?',
                a: 'ตรวจสอบแสงสว่างในห้อง ควรมีแสงส่องหน้าโดยตรง ไม่ควรมีแสงจ้าด้านหลัง และมองตรงเข้ากล้องโดยไม่สวมแว่นกันแดดหรือหมวก หากยังไม่ผ่าน ลองบันทึกใบหน้าใหม่ในสภาพแสงที่ดีกว่า',
              },
              {
                q: 'GPS ไม่ผ่าน ทั้งที่อยู่ในห้องเรียน?',
                a: 'เปิดแอปแผนที่เพื่อให้ GPS lock ตำแหน่งก่อน แล้วกลับมาลองใหม่ หรือยืนใกล้หน้าต่างที่มี GPS signal ดีกว่า ถ้ายังไม่ผ่านแจ้งอาจารย์ให้ใช้รหัสคาบแทน',
              },
              {
                q: 'ลืมรหัสผ่าน ทำอย่างไร?',
                a: 'ปัจจุบันยังไม่มีระบบ reset รหัสผ่านในแอป กรุณาติดต่อผู้ดูแลระบบเพื่อรีเซ็ตรหัสผ่านผ่าน Supabase Dashboard',
              },
              {
                q: 'ไม่เห็นรายวิชาในแอป ทำอย่างไร?',
                a: 'แจ้งอาจารย์ผู้สอนให้อัปโหลด roster และตรวจสอบว่าใช้ email เดียวกับที่ลงทะเบียนในแอป ระบบจับคู่จาก email เป็นหลัก',
              },
              {
                q: 'เช็คชื่อได้แต่ยังขึ้น "ขาด" ทำอย่างไร?',
                a: 'ตรวจสอบว่าอาจารย์ยังไม่ได้ปิดคาบเรียนก่อนที่คุณเช็คชื่อ และตรวจสอบในแท็บ "ประวัติ" ว่าระบบบันทึกสถานะอะไรไว้',
              },
            ].map(({ q, a }) => (
              <div key={q} style={{
                background: '#fff', borderRadius: 14, padding: '16px 18px',
                border: '1.5px solid var(--line)',
              }}>
                <p style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Q: {q}</p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--soft)', lineHeight: 1.7 }}>A: {a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer nav */}
        <div style={{
          display: 'flex', gap: 10, justifyContent: 'center',
          padding: '20px 0 0', borderTop: '1px solid var(--line)',
        }}>
          <Link href="/about" style={{
            padding: '10px 24px', borderRadius: 14,
            border: '1.5px solid var(--accent)', color: 'var(--accent)',
            textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>
            เกี่ยวกับ Maka
          </Link>
          <Link href="/auth" style={{
            padding: '10px 24px', borderRadius: 14,
            background: 'var(--accent)', color: '#fff',
            textDecoration: 'none', fontSize: 14, fontWeight: 600,
          }}>
            กลับหน้าหลัก
          </Link>
        </div>

      </div>
    </div>
  )
}
