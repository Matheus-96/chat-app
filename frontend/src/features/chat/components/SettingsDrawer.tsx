import type { ReactNode } from 'react'
import './SettingsDrawer.css'

interface SettingsDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: ReactNode
}

export function SettingsDrawer({ isOpen, onClose, children }: SettingsDrawerProps) {
  if (!isOpen) return null

  return (
    <>
      <div className="settings-drawer__overlay" onClick={onClose} />
      <aside className="settings-drawer">{children}</aside>
    </>
  )
}
