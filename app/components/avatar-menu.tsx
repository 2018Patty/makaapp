'use client'

import { useState } from 'react'

interface Props {
  name: string
  email?: string
  onSignOut: () => void
  size?: number
}

export function AvatarMenu({ name, email, onSignOut, size = 48 }: Props) {
  const [open, setOpen] = useState(false)
  const initial = (name || '?')[0].toUpperCase()

  return (
    <div className="avm-wrap" style={{ '--avm-size': `${size}px` } as React.CSSProperties}>
      <button
        className="m-avatar-circle avm-btn"
        style={{ width: size, height: size, fontSize: size * 0.42 }}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {initial}
      </button>

      {open && (
        <>
          <div className="avm-backdrop" onClick={() => setOpen(false)} />
          <div className="avm-pop">
            {/* User info */}
            <div className="avm-user">
              <div className="avm-avatar">{initial}</div>
              <div className="avm-info">
                <p className="avm-name">{name}</p>
                {email && <p className="avm-email">{email}</p>}
              </div>
            </div>
            <div className="avm-sep" />
            {/* Logout */}
            <button
              className="avm-item avm-danger"
              onClick={() => { setOpen(false); onSignOut() }}
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
                <path d="M16 17L21 12M21 12L16 7M21 12H9M9 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H9"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              ออกจากระบบ
            </button>
          </div>
        </>
      )}
    </div>
  )
}
