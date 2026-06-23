'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { RealtimeChannel } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { AvatarMenu } from '@/app/components/avatar-menu'

// ── Types ──────────────────────────────────────────────────────

type Tab = 'courses' | 'report' | 'profile'
type AttendFilter = 'all' | 'on-time' | 'late' | 'absent'

interface RosterMember {
  id: string; course_id: string; student_id: string; full_name: string; profile_id: string | null
}

interface Profile { id: string; full_name: string; student_id: string | null; faculty: string | null; email: string }
interface Course {
  id: string; code: string; name: string; room: string | null; join_code: string
  academic_year: string | null; semester: number | null
  schedule_days: string[]
  schedule_start_time: string | null  // 'HH:MM:SS' from postgres
  schedule_end_time: string | null
  late_threshold_minutes: number
}
interface Session {
  id: string; status: 'open' | 'closed'
  starts_at: string; late_threshold_minutes: number; course_id: string
  latitude: number | null; longitude: number | null
  session_pin: string | null
}
interface AttendanceRow {
  id: string; profile_id: string; session_id: string
  status: 'on-time' | 'late' | 'absent'
  checked_at: string; method: string; similarity: number | null
  profiles: { full_name: string; student_id: string | null } | null
}
interface EnrolledMember {
  profile_id: string
  profiles: { full_name: string; student_id: string | null } | null
}

// ── Helpers ────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
}
const THAI_DAYS   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'] as const
const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'] as const
function formatThaiDate(iso: string) {
  const d = new Date(iso)
  return `วัน${THAI_DAYS[d.getDay()]}ที่ ${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`
}
function formatExcelDateTime(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()+543} ${p(d.getHours())}:${p(d.getMinutes())}`
}
function statusExcelLabel(s: string) {
  return s === 'on-time' ? 'ตรงเวลา' : s === 'late' ? 'มาสาย' : s === 'not-registered' ? 'ยังไม่ลงทะเบียน' : 'ขาด'
}
function elapsed(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins} นาที`
  return `${Math.floor(mins / 60)} ชม.`
}
function statusLabel(s: string) {
  return s === 'on-time' ? 'ตรงเวลา' : s === 'late' ? 'มาสาย' : 'ยังไม่เข้า'
}
function statusBadgeClass(s: string) {
  return s === 'on-time' ? 'on-time' : s === 'late' ? 'late' : 'absent'
}
const COLORS = ['#d97361','#4a90d9','#6ab04c','#f39c12','#8e44ad','#2ecc71']
function avatarColor(name: string) { return COLORS[(name.charCodeAt(0) ?? 0) % COLORS.length] }

// ── Donut Chart ───────────────────────────────────────────────

function DonutChart({ onTime, late, total }: { onTime: number; late: number; total: number }) {
  const r = 48
  const circ = 2 * Math.PI * r
  const onTimeLen = total > 0 ? (onTime / total) * circ : 0
  const lateLen   = total > 0 ? (late / total) * circ : 0
  const absent    = Math.max(0, total - onTime - late)

  return (
    <div className="m-donut-row">
      <div style={{ position: 'relative', width: 116, height: 116, flexShrink: 0 }}>
        <svg width="116" height="116" viewBox="0 0 116 116" style={{ overflow: 'visible' }}>
          {/* track */}
          <circle cx="58" cy="58" r={r} fill="none" stroke="#ede0d6" strokeWidth="12" />
          {/* on-time */}
          {onTimeLen > 0 && (
            <circle cx="58" cy="58" r={r} fill="none" stroke="var(--good)" strokeWidth="12"
              strokeLinecap="butt"
              strokeDasharray={`${onTimeLen} ${circ}`}
              strokeDashoffset={0}
              transform="rotate(-90 58 58)"
            />
          )}
          {/* late */}
          {lateLen > 0 && (
            <circle cx="58" cy="58" r={r} fill="none" stroke="var(--warn)" strokeWidth="12"
              strokeLinecap="butt"
              strokeDasharray={`${lateLen} ${circ}`}
              strokeDashoffset={-onTimeLen}
              transform="rotate(-90 58 58)"
            />
          )}
        </svg>
        {/* center text */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: '"Mitr",sans-serif', fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--ink)' }}>
            {onTime + late}
          </span>
          <span style={{ fontSize: 11, color: 'var(--soft)' }}>/{total} คน</span>
        </div>
      </div>

      <div className="m-donut-stats">
        <div className="m-stat-row">
          <div className="m-stat-dot" style={{ background: 'var(--good)' }} />
          <div className="m-stat-label">ตรงเวลา</div>
          <div className="m-stat-val">{onTime}</div>
        </div>
        <div className="m-stat-row">
          <div className="m-stat-dot" style={{ background: 'var(--warn)' }} />
          <div className="m-stat-label">มาสาย</div>
          <div className="m-stat-val">{late}</div>
        </div>
        <div className="m-stat-row">
          <div className="m-stat-dot" style={{ background: '#ede0d6' }} />
          <div className="m-stat-label">ขาด</div>
          <div className="m-stat-val">{absent}</div>
        </div>
      </div>
    </div>
  )
}

// ── Join Code Generator ────────────────────────────────────────

function generateJoinCode(): string {
  // Avoids ambiguous chars (0/O, 1/I/L)
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function generateSessionPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

// ── Day constants ──────────────────────────────────────────────
const DAYS     = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา'] as const
const DAY_ABBR = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'] as const  // indexed by getDay()
const DAY_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'] as const

function fmtTime(t: string | null) { return t ? t.slice(0, 5) : '' }

// ── Add-Course Sheet ───────────────────────────────────────────

function AddCourseSheet({
  onClose, onCreated,
}: {
  onClose: () => void
  onCreated: (c: Course) => void
}) {
  const currentYear = new Date().getFullYear().toString()
  const [name,          setName]          = useState('')
  const [code,          setCode]          = useState('')
  const [room,          setRoom]          = useState('')
  const [joinCode,      setJoinCode]      = useState(() => generateJoinCode())
  const [academicYear,  setAcademicYear]  = useState(currentYear)
  const [semester,      setSemester]      = useState<1|2|3>(1)
  const [scheduleDays,  setScheduleDays]  = useState<string[]>([])
  const [scheduleStart, setScheduleStart] = useState('')
  const [scheduleEnd,   setScheduleEnd]   = useState('')
  const [lateThreshold, setLateThreshold] = useState(15)
  const [busy,          setBusy]          = useState(false)
  const [err,           setErr]           = useState('')

  const toggleDay = (day: string) =>
    setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setBusy(true); setErr('')

    const courseCode = code.trim() || name.trim().toUpperCase().replace(/\s+/g, '').slice(0, 10)
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).single<{ full_name: string }>()
    const { data, error } = await supabase.from('courses').insert({
      code:                    courseCode,
      name:                    name.trim(),
      room:                    room.trim() || null,
      join_code:               joinCode,
      instructor_id:           user.id,
      instructor_name:         prof?.full_name ?? '',
      academic_year:           academicYear.trim() || null,
      semester,
      schedule_days:           scheduleDays,
      schedule_start_time:     scheduleStart || null,
      schedule_end_time:       scheduleEnd   || null,
      late_threshold_minutes:  lateThreshold,
    }).select('id, code, name, room, join_code, academic_year, semester, schedule_days, schedule_start_time, schedule_end_time, late_threshold_minutes').single<Course>()

    if (error) {
      if (error.code === '23505') setErr('รหัสห้องชนกัน กรุณากด "สุ่มใหม่" แล้วลองอีกครั้ง')
      else setErr(error.message)
    } else if (data) {
      onCreated(data)
      onClose()
    }
    setBusy(false)
  }

  return (
    <>
      <div className="m-overlay" onClick={onClose} />
      <div className="m-sheet">
        <div className="m-sheet-handle" />
        <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 20, margin: '0 0 20px' }}>เพิ่มรายวิชา</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div className="auth-error">{err}</div>}

          <div className="m-form-field">
            <label>ชื่อวิชา <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="เช่น การเขียนโปรแกรมเว็บ" required />
          </div>
          <div className="m-form-field">
            <label>รหัสวิชา (ไม่บังคับ)</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="เช่น CS101" />
          </div>
          <div className="m-form-field">
            <label>ห้องเรียน (ไม่บังคับ)</label>
            <input value={room} onChange={e => setRoom(e.target.value)} placeholder="เช่น SC101" />
          </div>

          {/* Academic year + semester */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="m-form-field">
              <label>ปีการศึกษา</label>
              <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="เช่น 2026" />
            </div>
            <div className="m-form-field">
              <label>ภาคเรียน</label>
              <select
                value={semester}
                onChange={e => setSemester(Number(e.target.value) as 1|2|3)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 14, background: '#fff' }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3 (ฤดูร้อน)</option>
              </select>
            </div>
          </div>

          {/* Day selector */}
          <div className="m-form-field">
            <label>วันที่สอน</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {DAYS.map(day => (
                <button
                  key={day} type="button"
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
                    border: '1.5px solid', fontFamily: '"Mitr",sans-serif', fontSize: 13, fontWeight: 600,
                    borderColor: scheduleDays.includes(day) ? 'var(--accent)' : 'var(--line)',
                    background:  scheduleDays.includes(day) ? 'color-mix(in srgb, var(--accent) 12%, #fff)' : '#fff',
                    color:       scheduleDays.includes(day) ? 'var(--accent)' : 'var(--soft)',
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Start/End time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="m-form-field">
              <label>เวลาเริ่ม</label>
              <input type="time" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} />
            </div>
            <div className="m-form-field">
              <label>เวลาสิ้นสุด</label>
              <input type="time" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} />
            </div>
          </div>

          {/* Late threshold */}
          <div className="m-form-field">
            <label>ถือว่าสาย หลังจาก (นาที)</label>
            <input
              type="number" value={lateThreshold} min={0} max={180}
              onChange={e => setLateThreshold(Number(e.target.value))}
            />
          </div>

          {/* Join code */}
          <div style={{
            background: 'color-mix(in srgb, var(--accent) 8%, #fff)',
            border: '1.5px dashed color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: 16, padding: '14px 16px',
          }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--soft)', fontWeight: 700 }}>
              รหัสเข้าห้องเรียน (แจ้งนักศึกษา)
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, letterSpacing: 6, color: 'var(--accent)', flex: 1 }}>
                {joinCode}
              </span>
              <button
                type="button"
                onClick={() => setJoinCode(generateJoinCode())}
                style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--soft)' }}
              >
                สุ่มใหม่
              </button>
            </div>
          </div>

          <button type="submit" className="m-btn m-btn-salmon" style={{ marginTop: 6 }} disabled={busy}>
            {busy ? 'กำลังสร้าง...' : 'สร้างรายวิชา'}
          </button>
          <button type="button" className="m-btn m-btn-white" onClick={onClose}>ยกเลิก</button>
        </form>
      </div>
    </>
  )
}

// ── Open-Session Sheet ─────────────────────────────────────────

function OpenSessionSheet({
  course,
  onClose,
  onOpen,
}: {
  course: Course
  onClose: () => void
  onOpen: (startsAt: Date, lateMinutes: number) => void
}) {
  const now       = new Date()
  const todayIdx  = now.getDay()
  const todayAbbr = DAY_ABBR[todayIdx]
  const isTodayScheduled = (course.schedule_days ?? []).includes(todayAbbr)

  const defaultTime = isTodayScheduled && course.schedule_start_time
    ? fmtTime(course.schedule_start_time)
    : `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  const [date,    setDate]    = useState(now.toISOString().split('T')[0])
  const [time,    setTime]    = useState(defaultTime)
  const [lateMin, setLateMin] = useState(course.late_threshold_minutes ?? 15)

  return (
    <>
      <div className="m-overlay" onClick={onClose} />
      <div className="m-sheet">
        <div className="m-sheet-handle" />
        <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 20, margin: '0 0 4px' }}>เปิดคาบเรียน</h3>
        <p style={{ fontSize: 14, color: 'var(--soft)', margin: '0 0 18px' }}>{course.name}</p>

        {isTodayScheduled && (
          <div style={{
            background: 'color-mix(in srgb, var(--good) 10%, #fff)',
            border: '1.5px solid color-mix(in srgb, var(--good) 30%, transparent)',
            borderRadius: 12, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: 'var(--good)', fontWeight: 600,
          }}>
            ✓ วันนี้ตรงกับคาบเรียนวัน{DAY_FULL[todayIdx]}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="m-form-field">
            <label>วันที่</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="m-form-field">
            <label>เวลาเริ่มคาบ</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} />
          </div>
          <div className="m-form-field">
            <label>ถือว่าสาย หลังจาก (นาที)</label>
            <input
              type="number" value={lateMin} min={0} max={180}
              onChange={e => setLateMin(Number(e.target.value))}
            />
          </div>
          <button
            className="m-btn m-btn-salmon" style={{ marginTop: 6 }}
            onClick={() => onOpen(new Date(`${date}T${time}:00`), lateMin)}
          >
            เปิดคาบเรียน
          </button>
          <button className="m-btn m-btn-white" onClick={onClose}>ยกเลิก</button>
        </div>
      </div>
    </>
  )
}

// ── Edit-Course Sheet ──────────────────────────────────────────

function EditCourseSheet({
  course,
  onClose,
  onUpdated,
}: {
  course: Course
  onClose: () => void
  onUpdated: (c: Course) => void
}) {
  const [name,          setName]          = useState(course.name)
  const [code,          setCode]          = useState(course.code)
  const [room,          setRoom]          = useState(course.room ?? '')
  const [academicYear,  setAcademicYear]  = useState(course.academic_year ?? '')
  const [semester,      setSemester]      = useState<1|2|3>((course.semester as 1|2|3) ?? 1)
  const [scheduleDays,  setScheduleDays]  = useState<string[]>(course.schedule_days ?? [])
  const [scheduleStart, setScheduleStart] = useState(fmtTime(course.schedule_start_time))
  const [scheduleEnd,   setScheduleEnd]   = useState(fmtTime(course.schedule_end_time))
  const [lateThreshold, setLateThreshold] = useState(course.late_threshold_minutes ?? 15)
  const [busy,          setBusy]          = useState(false)
  const [err,           setErr]           = useState('')

  const toggleDay = (day: string) =>
    setScheduleDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setErr('')

    const { data, error } = await supabase
      .from('courses')
      .update({
        name:                    name.trim(),
        code:                    code.trim(),
        room:                    room.trim() || null,
        academic_year:           academicYear.trim() || null,
        semester,
        schedule_days:           scheduleDays,
        schedule_start_time:     scheduleStart || null,
        schedule_end_time:       scheduleEnd   || null,
        late_threshold_minutes:  lateThreshold,
      })
      .eq('id', course.id)
      .select('id, code, name, room, join_code, academic_year, semester, schedule_days, schedule_start_time, schedule_end_time, late_threshold_minutes')
      .single<Course>()

    if (error) { setErr(error.message) }
    else if (data) { onUpdated(data); onClose() }
    setBusy(false)
  }

  return (
    <>
      <div className="m-overlay" onClick={onClose} />
      <div className="m-sheet">
        <div className="m-sheet-handle" />
        <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 20, margin: '0 0 20px' }}>แก้ไขรายวิชา</h3>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {err && <div className="auth-error">{err}</div>}

          <div className="m-form-field">
            <label>ชื่อวิชา <span style={{ color: 'var(--accent)' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="m-form-field">
            <label>รหัสวิชา</label>
            <input value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div className="m-form-field">
            <label>ห้องเรียน</label>
            <input value={room} onChange={e => setRoom(e.target.value)} placeholder="เช่น SC101" />
          </div>

          {/* Academic year + semester */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="m-form-field">
              <label>ปีการศึกษา</label>
              <input value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="เช่น 2026" />
            </div>
            <div className="m-form-field">
              <label>ภาคเรียน</label>
              <select
                value={semester}
                onChange={e => setSemester(Number(e.target.value) as 1|2|3)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 12, border: '1.5px solid var(--line)', fontSize: 14, background: '#fff' }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3 (ฤดูร้อน)</option>
              </select>
            </div>
          </div>

          {/* Day selector */}
          <div className="m-form-field">
            <label>วันที่สอน</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {DAYS.map(day => (
                <button
                  key={day} type="button"
                  onClick={() => toggleDay(day)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
                    border: '1.5px solid', fontFamily: '"Mitr",sans-serif', fontSize: 13, fontWeight: 600,
                    borderColor: scheduleDays.includes(day) ? 'var(--accent)' : 'var(--line)',
                    background:  scheduleDays.includes(day) ? 'color-mix(in srgb, var(--accent) 12%, #fff)' : '#fff',
                    color:       scheduleDays.includes(day) ? 'var(--accent)' : 'var(--soft)',
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>

          {/* Start/End time */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="m-form-field">
              <label>เวลาเริ่ม</label>
              <input type="time" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} />
            </div>
            <div className="m-form-field">
              <label>เวลาสิ้นสุด</label>
              <input type="time" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} />
            </div>
          </div>

          {/* Late threshold */}
          <div className="m-form-field">
            <label>ถือว่าสาย หลังจาก (นาที)</label>
            <input
              type="number" value={lateThreshold} min={0} max={180}
              onChange={e => setLateThreshold(Number(e.target.value))}
            />
          </div>

          <button type="submit" className="m-btn m-btn-salmon" style={{ marginTop: 6 }} disabled={busy}>
            {busy ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
          <button type="button" className="m-btn m-btn-white" onClick={onClose}>ยกเลิก</button>
        </form>
      </div>
    </>
  )
}

// ── Upload-Roster Sheet ────────────────────────────────────────

type ParsedStudent = { student_id: string; full_name: string }

function UploadRosterSheet({
  course,
  onClose,
  onUploaded,
}: {
  course: Course
  onClose: () => void
  onUploaded: () => void
}) {
  const [rows,    setRows]    = useState<ParsedStudent[]>([])
  const [busy,    setBusy]    = useState(false)
  const [err,     setErr]     = useState('')
  const [result,  setResult]  = useState<{ added: number; matched: number } | null>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setErr(''); setRows([])
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
        if (raw.length === 0) { setErr('ไม่พบข้อมูลในไฟล์'); return }

        // Auto-detect columns — try common Thai/English headers
        const firstRow = raw[0]
        const keys = Object.keys(firstRow)
        const idKey   = keys.find(k => /รหัสนักศึกษา|student.?id|รหัส|id/i.test(k)) ?? keys[0]
        const nameKey = keys.find(k => /ชื่อ|name|full.?name/i.test(k)) ?? keys[1]

        const parsed: ParsedStudent[] = raw
          .map(r => ({
            student_id: String(r[idKey] ?? '').trim(),
            full_name:  String(r[nameKey] ?? '').trim(),
          }))
          .filter(r => r.student_id && r.full_name)

        if (parsed.length === 0) { setErr('ไม่พบข้อมูลที่ถูกต้อง กรุณาตรวจสอบหัวคอลัมน์'); return }
        setRows(parsed)
      } catch {
        setErr('อ่านไฟล์ไม่ได้ กรุณาใช้ไฟล์ .xlsx หรือ .xls')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const upload = async () => {
    if (!supabase || rows.length === 0) return
    setBusy(true); setErr('')

    // Look up existing profiles by student_id to auto-link
    const studentIds = rows.map(r => r.student_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, student_id')
      .in('student_id', studentIds)

    const profileMap: Record<string, string> = {}
    for (const p of profiles ?? []) {
      if (p.student_id) profileMap[p.student_id] = p.id
    }

    const toUpsert = rows.map(r => ({
      course_id:  course.id,
      student_id: r.student_id,
      full_name:  r.full_name,
      profile_id: profileMap[r.student_id] ?? null,
    }))

    const { error } = await supabase
      .from('student_roster')
      .upsert(toUpsert, { onConflict: 'course_id,student_id', ignoreDuplicates: false })

    if (error) { setErr(error.message); setBusy(false); return }

    const matched = toUpsert.filter(r => r.profile_id).length
    setResult({ added: rows.length, matched })
    setBusy(false)
  }

  return (
    <>
      <div className="m-overlay" onClick={!busy ? onClose : undefined} />
      <div className="m-sheet">
        <div className="m-sheet-handle" />
        <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 20, margin: '0 0 4px' }}>อัปโหลดรายชื่อนักศึกษา</h3>
        <p style={{ fontSize: 13, color: 'var(--soft)', margin: '0 0 18px' }}>{course.name}</p>

        {result ? (
          /* ── Success state ── */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{
              background: 'color-mix(in srgb, var(--good) 10%, #fff)',
              border: '1.5px solid color-mix(in srgb, var(--good) 30%, transparent)',
              borderRadius: 16, padding: '18px 20px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <p style={{ fontFamily: '"Mitr",sans-serif', fontSize: 16, margin: '0 0 4px', color: 'var(--good)' }}>
                บันทึกรายชื่อสำเร็จ
              </p>
              <p style={{ fontSize: 13, color: 'var(--soft)', margin: 0 }}>
                รายชื่อทั้งหมด {result.added} คน · ลงทะเบียนในระบบแล้ว {result.matched} คน
              </p>
              {result.added - result.matched > 0 && (
                <p style={{ fontSize: 12, color: 'var(--warn)', margin: '6px 0 0' }}>
                  {result.added - result.matched} คนยังไม่ได้สมัครใช้งาน จะแสดงเป็น "ยังไม่ลง" ในรายงาน
                </p>
              )}
            </div>
            <button className="m-btn m-btn-salmon" onClick={() => { onUploaded(); onClose() }}>
              เสร็จสิ้น
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {err && <div className="auth-error">{err}</div>}

            {/* File tips */}
            <div style={{
              background: 'var(--surface-soft)', borderRadius: 12, padding: '12px 14px', fontSize: 12, color: 'var(--soft)',
            }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--ink)' }}>รูปแบบไฟล์ที่รองรับ: .xlsx, .xls</p>
              <p style={{ margin: 0 }}>ไฟล์ต้องมีคอลัมน์ <strong>รหัสนักศึกษา</strong> และ <strong>ชื่อ-นามสกุล</strong> (หรือ student_id, name)</p>
            </div>

            {/* File picker */}
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, border: '2px dashed var(--line)', borderRadius: 16, padding: '24px 16px',
              cursor: 'pointer', background: '#fff', transition: 'border-color 0.15s',
            }}>
              <span style={{ fontSize: 32 }}>📂</span>
              <span style={{ fontFamily: '"Mitr",sans-serif', fontSize: 14, color: 'var(--soft)' }}>
                {rows.length > 0 ? `โหลดแล้ว ${rows.length} รายการ — คลิกเพื่อเปลี่ยนไฟล์` : 'คลิกเพื่อเลือกไฟล์ Excel'}
              </span>
              <input type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFile} />
            </label>

            {/* Preview table */}
            {rows.length > 0 && (
              <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ background: 'var(--surface-soft)', padding: '8px 14px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--soft)' }}>รหัสนักศึกษา</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--soft)' }}>ชื่อ-นามสกุล</span>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {rows.slice(0, 50).map((r, i) => (
                    <div key={i} style={{ padding: '7px 14px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, borderTop: '1px solid var(--line)', fontSize: 13 }}>
                      <span style={{ fontFamily: 'monospace', color: 'var(--soft)' }}>{r.student_id}</span>
                      <span>{r.full_name}</span>
                    </div>
                  ))}
                  {rows.length > 50 && (
                    <div style={{ padding: '7px 14px', fontSize: 12, color: 'var(--soft)', borderTop: '1px solid var(--line)', textAlign: 'center' }}>
                      + {rows.length - 50} รายการ
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              className="m-btn m-btn-salmon" style={{ marginTop: 6 }}
              disabled={rows.length === 0 || busy}
              onClick={upload}
            >
              {busy ? 'กำลังบันทึก...' : `บันทึกรายชื่อ ${rows.length > 0 ? `(${rows.length} คน)` : ''}`}
            </button>
            <button className="m-btn m-btn-white" onClick={onClose} disabled={busy}>ยกเลิก</button>
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Component ─────────────────────────────────────────────

export default function TeacherPage() {
  const router = useRouter()

  const [tab,          setTab]        = useState<Tab>('courses')
  const [profile,      setProfile]    = useState<Profile | null>(null)
  const [courses,      setCourses]    = useState<Course[]>([])
  const [sessions,     setSessions]   = useState<Record<string, Session>>({})
  const [attendance,   setAttendance] = useState<Record<string, AttendanceRow[]>>({})
  const [enrolled,     setEnrolled]   = useState<Record<string, EnrolledMember[]>>({})
  const [selectedId,    setSelected]    = useState<string | null>(null)
  const [filter,        setFilter]      = useState<AttendFilter>('all')
  const [showAddSheet,  setShowAdd]      = useState(false)
  const [openingCourse,  setOpeningCourse]  = useState<Course | null>(null)
  const [editingCourse,  setEditingCourse]  = useState<Course | null>(null)
  const [uploadingCourse, setUploadingCourse] = useState<Course | null>(null)
  const [roster,         setRoster]         = useState<Record<string, RosterMember[]>>({})
  const [busy,          setBusy]         = useState(true)
  const [statusMsg,     setStatus]       = useState('')
  // Most recent session per course — used for courses-tab count
  const [reportSession,         setReportSession]         = useState<Record<string, Session>>({})
  // All sessions per course — used for report-tab session list
  const [allSessions,           setAllSessions]           = useState<Record<string, Session[]>>({})
  // Which session the user clicked in report tab (null = show session list)
  const [reportSelectedSession, setReportSelectedSession] = useState<Session | null>(null)
  const [filterYear,     setFilterYear]     = useState<string | null>(null)
  const [filterSemester, setFilterSemester] = useState<number | null>(null)
  const realtimeRef = useRef<RealtimeChannel | null>(null)

  // ── Load ──
  const loadData = useCallback(async (keepSelected = false) => {
    if (!supabase) { router.push('/auth'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const [profRes, courseRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, student_id, faculty, email').eq('id', user.id).single<Profile>(),
      supabase.from('courses').select('id, code, name, room, join_code, academic_year, semester, schedule_days, schedule_start_time, schedule_end_time, late_threshold_minutes').eq('instructor_id', user.id).order('code'),
    ])

    setProfile(profRes.data ?? null)
    const list = (courseRes.data ?? []) as Course[]
    setCourses(list)

    if (list.length === 0) { setBusy(false); return }
    if (!keepSelected) setSelected(s => s ?? list[0].id)

    const ids = list.map(c => c.id)

    const [openSessRes, allSessRes, enrollRes] = await Promise.all([
      // Open sessions only — used for courses tab open/close UI
      supabase.from('sessions').select('id, status, starts_at, late_threshold_minutes, course_id, session_pin')
        .in('course_id', ids).eq('status', 'open'),
      // ALL sessions ordered by recency — pick most recent per course for report tab
      supabase.from('sessions').select('id, status, starts_at, late_threshold_minutes, course_id, session_pin')
        .in('course_id', ids).order('starts_at', { ascending: false }),
      supabase.from('course_members').select('profile_id, course_id, profiles(full_name, student_id)')
        .in('course_id', ids),
    ])

    // Open sessions map (courses tab)
    const sessionMap: Record<string, Session> = {}
    for (const s of (openSessRes.data ?? []) as Session[]) sessionMap[s.course_id] = s
    setSessions(sessionMap)

    // All sessions per course (for report tab list) — already sorted desc by starts_at
    const allSessData = (allSessRes.data ?? []) as Session[]
    const allSessMap: Record<string, Session[]> = {}
    for (const s of allSessData) {
      if (!allSessMap[s.course_id]) allSessMap[s.course_id] = []
      allSessMap[s.course_id].push(s)
    }
    setAllSessions(allSessMap)

    // Most-recent session per course — prefer open, else latest closed
    const reportMap: Record<string, Session> = {}
    for (const s of allSessData) {
      if (!reportMap[s.course_id]) reportMap[s.course_id] = s
    }
    for (const [cid, s] of Object.entries(sessionMap)) reportMap[cid] = s
    setReportSession(reportMap)

    const enrollMap: Record<string, EnrolledMember[]> = {}
    for (const m of (enrollRes.data ?? []) as unknown as (EnrolledMember & { course_id: string })[]) {
      if (!enrollMap[m.course_id]) enrollMap[m.course_id] = []
      enrollMap[m.course_id].push(m)
    }
    setEnrolled(enrollMap)

    // Load student roster for all courses
    const { data: rosterData } = await supabase
      .from('student_roster')
      .select('id, course_id, student_id, full_name, profile_id')
      .in('course_id', ids)
      .order('student_id')
    const rosterMap: Record<string, RosterMember[]> = {}
    for (const r of (rosterData ?? []) as RosterMember[]) {
      if (!rosterMap[r.course_id]) rosterMap[r.course_id] = []
      rosterMap[r.course_id].push(r)
    }
    setRoster(rosterMap)

    // Load attendance for ALL sessions of all courses
    const allSessIds = allSessData.map(s => s.id)
    if (allSessIds.length > 0) {
      const { data: attnData } = await supabase
        .from('attendance')
        .select('id, session_id, profile_id, status, checked_at, method, similarity, profiles!attendance_profile_id_fkey(full_name, student_id)')
        .in('session_id', allSessIds)
        .order('checked_at', { ascending: false })

      // Build sessionId → course_id lookup
      const sessIdToCourse: Record<string, string> = {}
      for (const s of allSessData) sessIdToCourse[s.id] = s.course_id

      const attnMap: Record<string, AttendanceRow[]> = {}
      for (const row of (attnData ?? []) as unknown as AttendanceRow[]) {
        const courseId = sessIdToCourse[row.session_id]
        if (courseId) {
          if (!attnMap[courseId]) attnMap[courseId] = []
          attnMap[courseId].push(row)
        }
      }
      setAttendance(attnMap)
    }

    setBusy(false)
  }, [router])

  useEffect(() => { void loadData() }, [loadData])

  // ── Realtime (best-effort — works if Supabase Realtime is enabled for attendance table) ──
  useEffect(() => {
    if (!supabase) return
    const openIds = Object.values(sessions).map(s => s.id)
    if (openIds.length === 0) return

    realtimeRef.current?.unsubscribe()
    realtimeRef.current = supabase
      .channel(`teacher-attn-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'attendance' }, async payload => {
        const row = payload.new as AttendanceRow
        const courseId = Object.entries(sessions).find(([, s]) => s.id === row.session_id)?.[0]
        if (!courseId) return
        const { data: prof } = await supabase!.from('profiles').select('full_name, student_id').eq('id', row.profile_id).single()
        const enriched = { ...row, profiles: prof ?? null }
        setAttendance(prev => ({ ...prev, [courseId]: [enriched, ...(prev[courseId] ?? [])] }))
      })
      .subscribe()

    return () => { realtimeRef.current?.unsubscribe() }
  }, [sessions])

  // ── Poll attendance every 10 s when any session is open (fallback for realtime) ──
  useEffect(() => {
    if (Object.keys(sessions).length === 0) return
    const t = setInterval(() => void loadData(true), 10_000)
    return () => clearInterval(t)
  }, [sessions, loadData])

  // ── Reset report session view when course changes ──
  useEffect(() => { setReportSelectedSession(null) }, [selectedId])

  // ── Sign out ──
  const signOut = useCallback(async () => {
    await supabase?.auth.signOut()
    router.push('/auth')
  }, [router])

  // ── Session actions ──
  const openSession = useCallback(async (courseId: string, startsAt: Date, lateMinutes: number) => {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setBusy(true); setStatus('กำลังระบุตำแหน่ง...')

    // Capture teacher's GPS for student proximity check
    let latitude: number | null = null
    let longitude: number | null = null
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 8000,
        })
      )
      latitude  = pos.coords.latitude
      longitude = pos.coords.longitude
    } catch {
      // Permission denied or unavailable — open session without location lock
    }

    setStatus('กำลังเปิดคาบ...')
    const session_pin = generateSessionPin()
    const { data, error } = await supabase.from('sessions').insert({
      course_id: courseId, starts_at: startsAt.toISOString(),
      late_threshold_minutes: lateMinutes, status: 'open', created_by: user.id,
      latitude, longitude, session_pin,
    }).select().single<Session>()
    if (error || !data) { setStatus('เปิดคาบไม่สำเร็จ: ' + (error?.message ?? 'unknown')) }
    else { setSessions(prev => ({ ...prev, [courseId]: data })); setAttendance(prev => ({ ...prev, [courseId]: [] })); setStatus('') }
    setBusy(false)
  }, [])

  const closeSession = useCallback(async (courseId: string) => {
    if (!supabase) return
    const session = sessions[courseId]
    if (!session) return
    setBusy(true); setStatus('กำลังปิดคาบ...')
    const { error } = await supabase.from('sessions').update({ status: 'closed', ends_at: new Date().toISOString() }).eq('id', session.id)
    if (error) { setStatus('ปิดคาบไม่สำเร็จ: ' + error.message) }
    else {
      setSessions(prev => { const n = { ...prev }; delete n[courseId]; return n })
      setStatus('')
    }
    setBusy(false)
  }, [sessions])

  const deleteCourse = async (courseId: string, courseName: string) => {
    if (!supabase) return
    if (!window.confirm(`ลบรายวิชา "${courseName}" ?\n\nข้อมูลคาบเรียนและรายชื่อนักศึกษาจะถูกลบทั้งหมด`)) return
    const { error } = await supabase.from('courses').delete().eq('id', courseId)
    if (error) { setStatus('ลบไม่ได้: ' + error.message); return }
    setCourses(prev => prev.filter(c => c.id !== courseId))
    if (selectedId === courseId) setSelected(courses.find(c => c.id !== courseId)?.id ?? null)
    setStatus('ลบรายวิชาแล้ว')
    setTimeout(() => setStatus(''), 2500)
  }

  const resetCourse = async (courseId: string, courseName: string) => {
    if (!supabase) return
    if (!window.confirm(`ล้างข้อมูลการเข้าเรียน "${courseName}" ?\n\nคาบเรียนและข้อมูลการเช็คชื่อทั้งหมดจะถูกลบถาวร\nรายวิชาและรายชื่อนักศึกษายังคงอยู่`)) return
    const { data: sessionData } = await supabase.from('sessions').select('id').eq('course_id', courseId)
    if (sessionData && sessionData.length > 0) {
      const ids = sessionData.map((s: { id: string }) => s.id)
      await supabase.from('attendance').delete().in('session_id', ids)
    }
    await supabase.from('sessions').delete().eq('course_id', courseId)
    setSessions(prev => { const n = { ...prev }; delete n[courseId]; return n })
    setAttendance(prev => { const n = { ...prev }; n[courseId] = []; return n })
    setAllSessions(prev => { const n = { ...prev }; n[courseId] = []; return n })
    setReportSession(prev => { const n = { ...prev }; delete n[courseId]; return n })
    setReportSelectedSession(null)
    setStatus('ล้างข้อมูลการเข้าเรียนแล้ว')
    setTimeout(() => setStatus(''), 2500)
  }

  // ── Loading ──
  if (busy && !profile) {
    return (
      <div className="loading-shell">
        <div className="loading-card">
          <img src="/brand/maka-logo.svg" alt="Maka" width={52} height={52} style={{ display: 'block' }} />
          <div className="spinner" />
          <p>กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    )
  }

  // ── Report tab year/semester filter ─────────────────────────
  const reportYears     = [...new Set(courses.map(c => c.academic_year).filter((y): y is string => !!y))].sort().reverse()
  const reportSemesters = [...new Set(courses.map(c => c.semester).filter((s): s is number => s != null))].sort()
  const reportCourses   = courses.filter(c => {
    if (filterYear     && c.academic_year !== filterYear)     return false
    if (filterSemester && c.semester      !== filterSemester) return false
    return true
  })

  const activeCourse   = courses.find(c => c.id === selectedId) ?? null
  const allAttn        = selectedId ? (attendance[selectedId] ?? []) : []
  const courseSessions = selectedId ? (allSessions[selectedId] ?? []) : []
  const enrolledList   = selectedId ? (enrolled[selectedId]   ?? []) : []
  const rosterList     = selectedId ? (roster[selectedId]     ?? []) : []

  // Use roster if uploaded, otherwise fall back to course_members
  const hasRoster      = rosterList.length > 0
  const totalEnrolled  = hasRoster ? rosterList.length : enrolledList.length

  // Report detail — scoped to the session the user clicked
  const attnList = reportSelectedSession
    ? allAttn.filter(a => a.session_id === reportSelectedSession.id)
    : []
  const onTime = attnList.filter(r => r.status === 'on-time').length
  const late   = attnList.filter(r => r.status === 'late').length

  // Build merged list: roster (preferred) or enrolled members
  const mergedList = hasRoster
    ? rosterList.map(member => {
        const attn = member.profile_id ? attnList.find(a => a.profile_id === member.profile_id) : undefined
        return {
          key:        member.id,
          full_name:  member.full_name,
          student_id: member.student_id,
          status:     (attn?.status ?? (member.profile_id ? 'absent' : 'not-registered')) as 'on-time' | 'late' | 'absent' | 'not-registered',
          checked_at: attn?.checked_at,
          registered: !!member.profile_id,
        }
      })
    : enrolledList.map(member => {
        const attn = attnList.find(a => a.profile_id === member.profile_id)
        return {
          key:        member.profile_id,
          full_name:  member.profiles?.full_name ?? member.profile_id.slice(0, 8),
          student_id: member.profiles?.student_id ?? '—',
          status:     (attn?.status ?? 'absent') as 'on-time' | 'late' | 'absent' | 'not-registered',
          checked_at: attn?.checked_at,
          registered: true,
        }
      })

  const filteredList = filter === 'all' ? mergedList : mergedList.filter(m =>
    filter === 'absent' ? (m.status === 'absent' || m.status === 'not-registered') : m.status === filter
  )

  // ── Export helpers ─────────────────────────────────────────────
  const exportCurrentSession = () => {
    if (!activeCourse || !reportSelectedSession) return
    const rows = mergedList.map(m => ({
      'วันเวลาที่เปิดสอน': formatExcelDateTime(reportSelectedSession.starts_at),
      'เวลาที่ Check-in':   m.checked_at ? formatTime(m.checked_at) : '—',
      'รหัสนักศึกษา':      m.student_id ?? '—',
      'ชื่อ-นามสกุล':      m.full_name,
      'สถานะ':             statusExcelLabel(m.status),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'รายงาน')
    XLSX.writeFile(wb, `${activeCourse.code}_${reportSelectedSession.starts_at.slice(0, 10)}.xlsx`)
  }

  const exportAllSessions = () => {
    if (!activeCourse) return
    const rows: Record<string, string>[] = []
    for (const sess of courseSessions) {
      const sessAttn = allAttn.filter(a => a.session_id === sess.id)
      const list = hasRoster
        ? rosterList.map(member => {
            const attn = member.profile_id ? sessAttn.find(a => a.profile_id === member.profile_id) : undefined
            return {
              full_name:  member.full_name,
              student_id: member.student_id,
              status:     (attn?.status ?? (member.profile_id ? 'absent' : 'not-registered')) as string,
              checked_at: attn?.checked_at,
            }
          })
        : enrolledList.map(member => {
            const attn = sessAttn.find(a => a.profile_id === member.profile_id)
            return {
              full_name:  member.profiles?.full_name ?? member.profile_id.slice(0, 8),
              student_id: member.profiles?.student_id ?? '—',
              status:     (attn?.status ?? 'absent') as string,
              checked_at: attn?.checked_at,
            }
          })
      for (const m of list) {
        rows.push({
          'วันเวลาที่เปิดสอน': formatExcelDateTime(sess.starts_at),
          'เวลาที่ Check-in':   m.checked_at ? formatTime(m.checked_at) : '—',
          'รหัสนักศึกษา':      m.student_id ?? '—',
          'ชื่อ-นามสกุล':      m.full_name,
          'สถานะ':             statusExcelLabel(m.status),
        })
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'รายงาน')
    XLSX.writeFile(wb, `${activeCourse.code}_ทุกคาบ.xlsx`)
  }

  // ── Summary table (all sessions cumulative) ───────────────────
  const summaryList = hasRoster
    ? rosterList.map(member => {
        const memberAttn = member.profile_id
          ? allAttn.filter(a => a.profile_id === member.profile_id)
          : []
        const onTime = memberAttn.filter(a => a.status === 'on-time').length
        const late   = memberAttn.filter(a => a.status === 'late').length
        const absent = courseSessions.length - onTime - late
        return { student_id: member.student_id, full_name: member.full_name, onTime, late, absent, registered: !!member.profile_id }
      })
    : enrolledList.map(member => {
        const memberAttn = allAttn.filter(a => a.profile_id === member.profile_id)
        const onTime = memberAttn.filter(a => a.status === 'on-time').length
        const late   = memberAttn.filter(a => a.status === 'late').length
        const absent = courseSessions.length - onTime - late
        return {
          student_id: member.profiles?.student_id ?? '—',
          full_name:  member.profiles?.full_name ?? '—',
          onTime, late, absent, registered: true,
        }
      })

  const exportSummary = () => {
    if (!activeCourse) return
    const rows = summaryList.map(m => ({
      'รหัสนักศึกษา': m.student_id ?? '—',
      'ชื่อ-นามสกุล': m.full_name,
      'ตรงเวลา':      m.onTime,
      'มาสาย':        m.late,
      'ขาด':          m.absent,
      'คาบทั้งหมด':  courseSessions.length,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'สรุป')
    XLSX.writeFile(wb, `${activeCourse.code}_สรุป.xlsx`)
  }

  return (
    <div className="m-page">
      {/* Add Course Sheet */}
      {showAddSheet && (
        <AddCourseSheet
          onClose={() => setShowAdd(false)}
          onCreated={c => {
            setCourses(prev => [...prev, c])
            setSelected(c.id)
          }}
        />
      )}

      {/* Upload Roster Sheet */}
      {uploadingCourse && (
        <UploadRosterSheet
          course={uploadingCourse}
          onClose={() => setUploadingCourse(null)}
          onUploaded={() => { void loadData(true) }}
        />
      )}

      {/* Edit Course Sheet */}
      {editingCourse && (
        <EditCourseSheet
          course={editingCourse}
          onClose={() => setEditingCourse(null)}
          onUpdated={updated => {
            setCourses(prev => prev.map(c => c.id === updated.id ? updated : c))
            setEditingCourse(null)
          }}
        />
      )}

      {/* Open Session Sheet */}
      {openingCourse && (
        <OpenSessionSheet
          course={openingCourse}
          onClose={() => setOpeningCourse(null)}
          onOpen={(startsAt, lateMin) => {
            const cid = openingCourse.id
            setOpeningCourse(null)
            void openSession(cid, startsAt, lateMin)
          }}
        />
      )}

      <div className="m-scroll">

        {/* ── Courses Tab ── */}
        {tab === 'courses' && (
          <>
            <div className="m-tab-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <h2 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 24, margin: 0, flex: 1 }}>คาบเรียน</h2>
              {/* Manual refresh — useful when realtime is not set up */}
              {Object.keys(sessions).length > 0 && (
                <button
                  title="รีเฟรชข้อมูล"
                  onClick={() => void loadData(true)}
                  style={{
                    width: 38, height: 38, borderRadius: 12, border: '1px solid var(--line)',
                    background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
                    fontSize: 17, color: 'var(--soft)', transition: 'color 0.15s',
                  }}
                >
                  🔄
                </button>
              )}
              <button
                className="m-btn m-btn-salmon m-btn-sm"
                style={{ width: 'auto', padding: '0 16px', minHeight: 38, borderRadius: 14, fontSize: 14 }}
                onClick={() => setShowAdd(true)}
              >
                + เพิ่มวิชา
              </button>
              <AvatarMenu name={profile?.full_name ?? ''} email={profile?.email} onSignOut={signOut} />
            </div>

            {statusMsg && <div className="auth-error" style={{ margin: '0 20px 12px' }}>{statusMsg}</div>}

            <div className="m-pad m-gap">
              {courses.length === 0 ? (
                <div className="m-card" style={{ textAlign: 'center', padding: '32px 20px' }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>📚</div>
                  <h4 style={{ fontFamily: '"Mitr",sans-serif', margin: '0 0 6px' }}>ยังไม่มีรายวิชา</h4>
                  <p style={{ fontSize: 13, color: 'var(--soft)', margin: '0 0 16px' }}>กด "+ เพิ่มวิชา" เพื่อสร้างรายวิชาแรก</p>
                  <button className="m-btn m-btn-salmon m-btn-sm" style={{ width: 'auto', padding: '0 24px' }} onClick={() => setShowAdd(true)}>
                    เพิ่มรายวิชา
                  </button>
                </div>
              ) : (
                courses.map(course => {
                  const sess = sessions[course.id]
                  const isSelected = selectedId === course.id
                  const allCourseAttn = attendance[course.id] ?? []
                  // Count only current open session's attendance for live display
                  const attn = sess
                    ? allCourseAttn.filter(a => a.session_id === sess.id)
                    : allCourseAttn
                  return (
                    <div
                      key={course.id}
                      className="m-card"
                      style={{
                        cursor: 'pointer',
                        border: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
                        transition: 'border-color 0.15s',
                      }}
                      onClick={() => { setSelected(course.id); setTab('courses') }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 16, margin: '0 0 3px' }}>
                            {course.name}
                          </h4>
                          <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--soft)' }}>
                            {[
                              course.room && `ห้อง ${course.room}`,
                              course.semester && course.academic_year && `ภาค ${course.semester}/${course.academic_year}`,
                            ].filter(Boolean).join(' · ')}
                          </p>
                          {course.schedule_days?.length > 0 && (
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--soft)' }}>
                              วัน{course.schedule_days.join(' ')}
                              {fmtTime(course.schedule_start_time) && ` · ${fmtTime(course.schedule_start_time)}`}
                              {fmtTime(course.schedule_end_time)   && `–${fmtTime(course.schedule_end_time)} น.`}
                            </p>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 10 }}>
                          <button
                            title="อัปโหลดรายชื่อนักศึกษา (.xlsx)"
                            onClick={e => { e.stopPropagation(); setUploadingCourse(course) }}
                            style={{
                              width: 30, height: 30, borderRadius: 8, border: '1px solid #b7ddb0',
                              background: '#f0faf0', cursor: 'pointer', display: 'grid', placeItems: 'center',
                            }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                              <rect x="3" y="2" width="18" height="20" rx="2" fill="#1d6f42"/>
                              <line x1="3" y1="8" x2="21" y2="8" stroke="#fff" strokeWidth="1"/>
                              <line x1="3" y1="13" x2="21" y2="13" stroke="#fff" strokeWidth="1"/>
                              <line x1="3" y1="18" x2="21" y2="18" stroke="#fff" strokeWidth="1"/>
                              <line x1="9" y1="8" x2="9" y2="22" stroke="#fff" strokeWidth="1"/>
                              <line x1="15" y1="8" x2="15" y2="22" stroke="#fff" strokeWidth="1"/>
                              <path d="M6.5 5L8 7l1.5-2" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button
                            title="แก้ไขข้อมูลรายวิชา"
                            onClick={e => { e.stopPropagation(); setEditingCourse(course) }}
                            style={{
                              width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)',
                              background: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center',
                              color: 'var(--soft)',
                            }}
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button
                            title="ล้างข้อมูลการเข้าเรียนทั้งหมดของวิชานี้"
                            onClick={e => { e.stopPropagation(); void resetCourse(course.id, course.name) }}
                            style={{
                              width: 30, height: 30, borderRadius: 8, border: '1px solid #fde8c0',
                              background: '#fffbf0', cursor: 'pointer', display: 'grid', placeItems: 'center',
                              color: '#d97706',
                            }}
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <button
                            title="ลบรายวิชานี้ออกจากระบบ"
                            onClick={e => { e.stopPropagation(); void deleteCourse(course.id, course.name) }}
                            style={{
                              width: 30, height: 30, borderRadius: 8, border: '1px solid #fcc',
                              background: '#fff5f5', cursor: 'pointer', display: 'grid', placeItems: 'center',
                              color: '#e05c5c',
                            }}
                          >
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                              <polyline points="3 6 5 6 21 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                          <span className={`label ${sess ? 'good' : 'muted'}`}>
                            {sess ? '● เปิดอยู่' : 'ปิด'}
                          </span>
                        </div>
                      </div>

                      {/* Join code — share with students */}
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          void navigator.clipboard.writeText(course.join_code)
                          setStatus('คัดลอกรหัสห้อง "' + course.join_code + '" แล้ว ✓')
                          setTimeout(() => setStatus(''), 2500)
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          background: 'color-mix(in srgb, var(--accent) 7%, #fff)',
                          border: '1.5px dashed color-mix(in srgb, var(--accent) 28%, transparent)',
                          borderRadius: 12, padding: '10px 14px', cursor: 'pointer',
                          marginBottom: sess ? 10 : 14, width: '100%', textAlign: 'left',
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--soft)', fontWeight: 700 }}>
                            รหัสเข้าห้องเรียน (แตะเพื่อคัดลอก)
                          </p>
                          <span style={{
                            fontFamily: 'monospace', fontSize: 22, fontWeight: 900,
                            letterSpacing: 4, color: 'var(--accent)',
                          }}>
                            {course.join_code}
                          </span>
                        </div>
                        <span style={{ fontSize: 18 }}>📋</span>
                      </button>

                      {sess && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', gap: 12 }}>
                            <span style={{ fontSize: 12, color: 'var(--soft)' }}>เริ่ม {formatTime(sess.starts_at)} ({elapsed(sess.starts_at)})</span>
                            <span style={{ fontSize: 12, color: 'var(--good)', fontWeight: 600 }}>{attn.length} คนเช็คชื่อ</span>
                          </div>
                          {sess.session_pin && (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              background: 'color-mix(in srgb, var(--accent) 6%, #fff)',
                              border: '1.5px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                              borderRadius: 12, padding: '10px 14px',
                            }}>
                              <div style={{ flex: 1 }}>
                                <p style={{ margin: '0 0 2px', fontSize: 10, color: 'var(--soft)', fontWeight: 700, letterSpacing: 0.5 }}>
                                  รหัสเช็คชื่อ (แสดงบนจอ)
                                </p>
                                <span style={{
                                  fontFamily: 'monospace', fontSize: 28, fontWeight: 900,
                                  letterSpacing: 10, color: 'var(--accent)',
                                }}>
                                  {sess.session_pin}
                                </span>
                              </div>
                              <div style={{ textAlign: 'right', fontSize: 10, color: 'var(--soft)' }}>
                                <div>สำหรับ</div>
                                <div>นักศึกษา</div>
                                <div>ไม่มีกล้อง</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                        {sess ? (
                          <>
                            <button
                              className="m-btn m-btn-white m-btn-sm"
                              style={{ flex: 1, color: 'var(--accent)', fontWeight: 700 }}
                              disabled={busy}
                              onClick={e => { e.stopPropagation(); setSelected(course.id); setTab('report') }}
                            >
                              ดูรายงาน
                            </button>
                            <button
                              className="m-btn m-btn-sm"
                              style={{ flex: 1, background: '#fee2dc', color: '#b44636', fontWeight: 700, border: 'none', borderRadius: 12 }}
                              disabled={busy}
                              onClick={e => { e.stopPropagation(); void closeSession(course.id) }}
                            >
                              ปิดคาบ
                            </button>
                          </>
                        ) : (
                          <button
                            className="m-btn m-btn-salmon m-btn-sm"
                            style={{ flex: 1 }}
                            disabled={busy}
                            onClick={e => { e.stopPropagation(); setOpeningCourse(course) }}
                          >
                            เปิดคาบเรียน
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* ── Report Tab ── */}
        {tab === 'report' && (
          <>
            <div className="m-tab-header" style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                {reportSelectedSession ? (
                  <button
                    onClick={() => { setReportSelectedSession(null); setFilter('all') }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontFamily: '"Mitr",sans-serif', fontSize: 15, padding: 0 }}
                  >
                    ← คาบทั้งหมด
                  </button>
                ) : (
                  <h2 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 24, margin: 0, flex: 1 }}>รายงานการเข้าเรียน</h2>
                )}
                <AvatarMenu name={profile?.full_name ?? ''} email={profile?.email} onSignOut={signOut} />
              </div>

              {/* Year / Semester filter — only on list view */}
              {!reportSelectedSession && (reportYears.length > 0 || reportSemesters.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                  {reportYears.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--soft)', flexShrink: 0 }}>ปีการศึกษา</span>
                      {reportYears.length > 3 ? (
                        <select
                          value={filterYear ?? ''}
                          onChange={e => { setFilterYear(e.target.value || null); setReportSelectedSession(null) }}
                          style={{
                            padding: '5px 28px 5px 10px', borderRadius: 16,
                            border: '1px solid var(--line)', fontSize: 12,
                            fontFamily: '"Mitr",sans-serif', cursor: 'pointer',
                            background: filterYear ? 'var(--accent)' : '#fff',
                            color: filterYear ? '#fff' : 'var(--ink)',
                            appearance: 'none',
                            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='${filterYear ? '%23fff' : '%23666'}' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 10px center',
                          }}
                        >
                          <option value="">ทั้งหมด</option>
                          {reportYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      ) : (
                        <div style={{ overflowX: 'auto', display: 'flex', gap: 6, paddingBottom: 2 }}>
                          {[null, ...reportYears].map(y => (
                            <button
                              key={y ?? 'all'}
                              onClick={() => { setFilterYear(y); setReportSelectedSession(null) }}
                              style={{
                                flexShrink: 0, padding: '4px 12px', borderRadius: 16,
                                border: filterYear === y ? 'none' : '1px solid var(--line)',
                                fontSize: 12, fontFamily: '"Mitr",sans-serif', cursor: 'pointer',
                                background: filterYear === y ? 'var(--accent)' : '#fff',
                                color: filterYear === y ? '#fff' : 'var(--ink)',
                              }}
                            >
                              {y ?? 'ทั้งหมด'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {reportSemesters.length > 0 && (
                    <div style={{ overflowX: 'auto', display: 'flex', gap: 6, paddingBottom: 2 }}>
                      <span style={{ fontSize: 11, color: 'var(--soft)', flexShrink: 0, alignSelf: 'center', paddingRight: 2 }}>ภาคเรียน</span>
                      {[null, ...reportSemesters].map(s => (
                        <button
                          key={s ?? 'all'}
                          onClick={() => { setFilterSemester(s); setReportSelectedSession(null) }}
                          style={{
                            flexShrink: 0, padding: '4px 12px', borderRadius: 16,
                            border: filterSemester === s ? 'none' : '1px solid var(--line)',
                            fontSize: 12, fontFamily: '"Mitr",sans-serif', cursor: 'pointer',
                            background: filterSemester === s ? '#6ab04c' : '#fff',
                            color: filterSemester === s ? '#fff' : 'var(--ink)',
                          }}
                        >
                          {s != null ? `ภาค ${s}` : 'ทั้งหมด'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Course selector — only on list view */}
              {!reportSelectedSession && reportCourses.length > 1 && (
                <div style={{ overflowX: 'auto', display: 'flex', gap: 8, paddingBottom: 4, marginTop: 6 }}>
                  {reportCourses.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelected(c.id)}
                      style={{
                        flexShrink: 0, padding: '5px 14px', borderRadius: 20, border: 'none',
                        fontSize: 13, fontFamily: '"Mitr",sans-serif', cursor: 'pointer',
                        background: selectedId === c.id ? 'var(--accent)' : 'var(--surface-soft)',
                        color: selectedId === c.id ? '#fff' : 'var(--ink)',
                        transition: 'all 0.15s',
                      }}
                    >
                      {c.code}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="m-pad m-gap">
              {!activeCourse || !reportCourses.find(c => c.id === selectedId) ? (
                <div className="m-card" style={{ textAlign: 'center', color: 'var(--soft)' }}>
                  {reportCourses.length === 0 ? 'ไม่มีวิชาในเงื่อนไขที่เลือก' : 'เลือกวิชาเพื่อดูรายงาน'}
                </div>
              ) : reportSelectedSession ? (
                /* ── Detail view ── */
                <>
                  {/* Session header */}
                  <div className="m-card">
                    <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 16, margin: '0 0 4px' }}>
                      {activeCourse.code} · {activeCourse.name}
                    </h3>
                    <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>
                      {formatThaiDate(reportSelectedSession.starts_at)}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: 'var(--soft)' }}>
                          เวลา {formatTime(reportSelectedSession.starts_at)}
                          {fmtTime(activeCourse.schedule_end_time) ? `–${fmtTime(activeCourse.schedule_end_time)} น.` : ' น.'}
                        </span>
                        <span className={`label ${reportSelectedSession.status === 'open' ? 'good' : 'muted'}`} style={{ fontSize: 11 }}>
                          {reportSelectedSession.status === 'open' ? '● เปิดอยู่' : 'ปิดแล้ว'}
                        </span>
                      </div>
                      <button
                        onClick={exportCurrentSession}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          padding: '5px 12px', borderRadius: 8,
                          background: '#1d6f42', color: '#fff',
                          border: 'none', cursor: 'pointer',
                          fontSize: 12, fontFamily: '"Mitr",sans-serif',
                        }}
                      >
                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2"/>
                          <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
                          <polyline points="9 15 12 18 15 15" fill="none" stroke="currentColor" strokeWidth="2"/>
                        </svg>
                        Excel
                      </button>
                    </div>
                  </div>

                  {/* Donut */}
                  <div className="m-card">
                    <DonutChart onTime={onTime} late={late} total={totalEnrolled || (onTime + late)} />
                  </div>

                  {/* Filter tabs */}
                  <div className="m-filter-tabs">
                    {(['all', 'on-time', 'late', 'absent'] as AttendFilter[]).map(f => (
                      <button key={f} className={`m-filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                        {f === 'all' ? 'ทั้งหมด' : f === 'on-time' ? 'ตรงเวลา' : f === 'late' ? 'มาสาย' : 'ขาด'}
                        <span style={{ marginLeft: 4, fontSize: 11, fontWeight: 600, color: filter === f ? 'var(--accent)' : 'var(--soft)' }}>
                          {f === 'all' ? mergedList.length : f === 'on-time' ? onTime : f === 'late' ? late : Math.max(0, totalEnrolled - onTime - late)}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Student list */}
                  {totalEnrolled === 0 ? (
                    <div className="m-card" style={{ textAlign: 'center', color: 'var(--soft)', fontSize: 14 }}>
                      ยังไม่มีนักศึกษาลงทะเบียนในวิชานี้
                    </div>
                  ) : filteredList.length === 0 ? (
                    <div className="m-card" style={{ textAlign: 'center', color: 'var(--soft)', fontSize: 14 }}>ไม่มีรายการในหมวดนี้</div>
                  ) : filteredList.map((m, i) => (
                    <div key={m.key} className="m-student-row">
                      <div className="m-student-avatar" style={{ background: avatarColor(m.full_name) }}>
                        {m.full_name[0]}
                      </div>
                      <div className="m-list-main">
                        <h4>{i + 1}. {m.full_name}</h4>
                        <p>รหัส {m.student_id ?? '—'}{m.checked_at ? ` · ${formatTime(m.checked_at)}` : ''}</p>
                      </div>
                      {m.status === 'not-registered'
                        ? <span className="m-time-badge" style={{ background: '#f3f0ff', color: '#7c6fb0', fontSize: 11 }}>ยังไม่ลง</span>
                        : <span className={`m-time-badge ${statusBadgeClass(m.status)}`}>{statusLabel(m.status)}</span>
                      }
                    </div>
                  ))}
                </>
              ) : (
                /* ── Session list view ── */
                <>
                  {/* Course info */}
                  <div className="m-card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 16, margin: '0 0 3px' }}>
                          {activeCourse.code} · {activeCourse.name}
                        </h3>
                        <p style={{ margin: 0, fontSize: 12, color: 'var(--soft)' }}>
                          {[
                            activeCourse.room && `ห้อง ${activeCourse.room}`,
                            activeCourse.semester && activeCourse.academic_year && `ภาค ${activeCourse.semester}/${activeCourse.academic_year}`,
                            activeCourse.schedule_days?.length > 0 && `วัน${activeCourse.schedule_days.join(' ')} · ${fmtTime(activeCourse.schedule_start_time)}–${fmtTime(activeCourse.schedule_end_time)} น.`,
                          ].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {courseSessions.length > 0 && (
                        <>
                        <button
                          onClick={() => void resetCourse(activeCourse.id, activeCourse.name)}
                          title="ล้างข้อมูลการเข้าเรียน"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 10px', borderRadius: 8,
                            background: '#fffbf0', color: '#d97706',
                            border: '1px solid #fde8c0', cursor: 'pointer', flexShrink: 0,
                            fontSize: 12, fontFamily: '"Mitr",sans-serif',
                          }}
                        >
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          Reset
                        </button>
                        <button
                          onClick={exportAllSessions}
                          title="Export ทุกคาบ"
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 8,
                            background: '#1d6f42', color: '#fff',
                            border: 'none', cursor: 'pointer', flexShrink: 0,
                            fontSize: 12, fontFamily: '"Mitr",sans-serif',
                          }}
                        >
                          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2"/>
                            <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
                            <polyline points="9 15 12 18 15 15" fill="none" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          Excel ทุกคาบ
                        </button>
                        </>
                      )}
                      </div>
                    </div>
                  </div>

                  {/* Stat row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'จำนวนนักศึกษา', value: totalEnrolled, icon: '👥', color: 'var(--accent)' },
                      { label: 'จำนวนคาบเรียน',  value: courseSessions.length, icon: '📅', color: '#6ab04c' },
                    ].map(s => (
                      <div key={s.label} className="m-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px' }}>
                        <span style={{ fontSize: 26, lineHeight: 1 }}>{s.icon}</span>
                        <div>
                          <p style={{ margin: 0, fontSize: 22, fontWeight: 700, fontFamily: '"Mitr",sans-serif', color: s.color, lineHeight: 1.1 }}>
                            {s.value}
                          </p>
                          <p style={{ margin: 0, fontSize: 11, color: 'var(--soft)', marginTop: 2 }}>{s.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {courseSessions.length === 0 ? (
                    <div className="m-card" style={{ textAlign: 'center', color: 'var(--soft)', padding: '28px 20px' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
                      <p style={{ margin: 0, fontSize: 14 }}>ยังไม่มีคาบเรียน</p>
                    </div>
                  ) : courseSessions.map(sess => {
                    const sessAttn = allAttn.filter(a => a.session_id === sess.id)
                    const sOnTime  = sessAttn.filter(r => r.status === 'on-time').length
                    const sLate    = sessAttn.filter(r => r.status === 'late').length
                    const sAbsent  = Math.max(0, totalEnrolled - sOnTime - sLate)
                    return (
                      <button
                        key={sess.id}
                        className="m-card"
                        style={{ width: '100%', textAlign: 'left', cursor: 'pointer', border: '1.5px solid transparent', transition: 'border-color 0.15s', padding: '14px 16px' }}
                        onClick={() => { setReportSelectedSession(sess); setFilter('all') }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                          <div style={{ flex: 1 }}>
                            <p style={{ margin: '0 0 2px', fontSize: 14, fontFamily: '"Mitr",sans-serif', fontWeight: 600, color: 'var(--ink)' }}>
                              {formatThaiDate(sess.starts_at)}
                            </p>
                            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--soft)' }}>
                              เวลา {formatTime(sess.starts_at)}
                              {fmtTime(activeCourse.schedule_end_time) ? `–${fmtTime(activeCourse.schedule_end_time)} น.` : ' น.'}
                            </p>
                            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                              <span style={{ color: 'var(--good)', fontWeight: 600 }}>✓ {sOnTime}</span>
                              <span style={{ color: 'var(--warn)', fontWeight: 600 }}>⏰ {sLate}</span>
                              <span style={{ color: 'var(--soft)' }}>✗ {sAbsent}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                            <span className={`label ${sess.status === 'open' ? 'good' : 'muted'}`} style={{ fontSize: 11 }}>
                              {sess.status === 'open' ? '● เปิดอยู่' : 'ปิดแล้ว'}
                            </span>
                            <span style={{ fontSize: 18, color: 'var(--soft)' }}>›</span>
                          </div>
                        </div>
                      </button>
                    )
                  })}

                  {/* ── Summary table ── */}
                  {summaryList.length > 0 && courseSessions.length > 0 && (
                    <div className="m-card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
                        <h4 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 15, margin: 0 }}>
                          ตารางสรุปการเข้าเรียน
                          <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 400, color: 'var(--soft)' }}>
                            ({courseSessions.length} คาบ)
                          </span>
                        </h4>
                        <button
                          onClick={exportSummary}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 8,
                            background: '#1d6f42', color: '#fff',
                            border: 'none', cursor: 'pointer',
                            fontSize: 12, fontFamily: '"Mitr",sans-serif',
                          }}
                        >
                          <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                            <polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2"/>
                            <line x1="12" y1="18" x2="12" y2="12" stroke="currentColor" strokeWidth="2"/>
                            <polyline points="9 15 12 18 15 15" fill="none" stroke="currentColor" strokeWidth="2"/>
                          </svg>
                          Export Excel
                        </button>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: 'var(--surface-soft)', borderTop: '1px solid var(--line)' }}>
                              <th style={{ padding: '9px 14px', textAlign: 'left', fontFamily: '"Mitr",sans-serif', fontWeight: 600, fontSize: 12, color: 'var(--soft)', whiteSpace: 'nowrap' }}>รหัสนักศึกษา</th>
                              <th style={{ padding: '9px 14px', textAlign: 'left', fontFamily: '"Mitr",sans-serif', fontWeight: 600, fontSize: 12, color: 'var(--soft)' }}>ชื่อ-นามสกุล</th>
                              <th style={{ padding: '9px 14px', textAlign: 'center', fontFamily: '"Mitr",sans-serif', fontWeight: 600, fontSize: 12, color: 'var(--good)', whiteSpace: 'nowrap' }}>ตรงเวลา</th>
                              <th style={{ padding: '9px 14px', textAlign: 'center', fontFamily: '"Mitr",sans-serif', fontWeight: 600, fontSize: 12, color: 'var(--warn)', whiteSpace: 'nowrap' }}>มาสาย</th>
                              <th style={{ padding: '9px 14px', textAlign: 'center', fontFamily: '"Mitr",sans-serif', fontWeight: 600, fontSize: 12, color: '#e05c5c', whiteSpace: 'nowrap' }}>ขาด</th>
                            </tr>
                          </thead>
                          <tbody>
                            {summaryList.map((m, i) => (
                              <tr
                                key={m.student_id + i}
                                style={{ borderTop: '1px solid var(--line)', background: i % 2 === 1 ? 'var(--surface-soft)' : '#fff' }}
                              >
                                <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--soft)', whiteSpace: 'nowrap' }}>
                                  {m.student_id ?? '—'}
                                </td>
                                <td style={{ padding: '9px 14px', fontFamily: '"Mitr",sans-serif' }}>
                                  {m.full_name}
                                  {!m.registered && (
                                    <span style={{ marginLeft: 6, fontSize: 10, background: '#f3f0ff', color: '#7c6fb0', padding: '1px 6px', borderRadius: 4 }}>ยังไม่ลง</span>
                                  )}
                                </td>
                                <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--good)' }}>{m.onTime}</td>
                                <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--warn)' }}>{m.late}</td>
                                <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700, color: '#e05c5c' }}>{m.absent}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* ── Profile Tab ── */}
        {tab === 'profile' && (
          <>
            <div className="m-tab-header" style={{ paddingBottom: 20 }}>
              {/* Avatar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div className="m-avatar-circle-lg">
                  {(profile?.full_name ?? '?')[0]}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ fontFamily: '"Mitr",sans-serif', fontSize: 20, margin: '0 0 4px' }}>{profile?.full_name}</h3>
                  <span className="label muted" style={{ fontSize: 12 }}>อาจารย์</span>
                </div>
              </div>

              {/* Info card */}
              <div className="m-card m-gap">
                {[
                  { label: 'อีเมล', value: profile?.email },
                  { label: 'รหัสบุคลากร', value: profile?.student_id ?? '—' },
                  { label: 'คณะ / ภาควิชา', value: profile?.faculty ?? '—' },
                  { label: 'จำนวนวิชา', value: `${courses.length} วิชา` },
                ].map(row => (
                  <div key={row.label} className="m-detail-row">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="m-gap" style={{ marginTop: 16 }}>
                <button
                  className="m-btn m-btn-white"
                  onClick={() => setShowAdd(true)}
                >
                  📚 เพิ่มรายวิชา
                </button>
                <button
                  className="m-btn"
                  style={{ background: '#fee2dc', color: '#b44636', border: 'none', marginTop: 10 }}
                  onClick={signOut}
                >
                  ออกจากระบบ
                </button>
              </div>
            </div>
          </>
        )}

      </div>

      {/* Bottom Nav */}
      <div className="m-bottom-nav">
        <Link href="/auth" className="m-nav-logo">
          <img src="/brand/maka-logo.svg" alt="Maka" width={24} height={24} style={{ display: 'block' }} />
          <span className="m-nav-logo-text">Maka</span>
        </Link>
        <button className={`m-nav-item ${tab === 'courses' ? 'active' : ''}`} onClick={() => setTab('courses')}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"
              fill={tab === 'courses' ? 'currentColor' : 'none'} fillOpacity={tab === 'courses' ? 0.12 : 0} />
            <path d="M7 8H17M7 12H14M7 16H11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          คาบเรียน
        </button>
        <button className={`m-nav-item ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path d="M4 19V9L12 4L20 9V19H14V14H10V19H4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
              fill={tab === 'report' ? 'currentColor' : 'none'} fillOpacity={tab === 'report' ? 0.12 : 0} />
          </svg>
          รายงาน
        </button>
        <button className={`m-nav-item ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"
              fill={tab === 'profile' ? 'currentColor' : 'none'} fillOpacity={tab === 'profile' ? 0.12 : 0} />
            <path d="M4 20C4 17 7.6 14 12 14C16.4 14 20 17 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          โปรไฟล์
        </button>
      </div>
    </div>
  )
}
