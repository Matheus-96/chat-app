interface LeftNavProps {
  roomCode: string
}

export function LeftNav({ roomCode }: LeftNavProps) {
  const roomAvatar = roomCode.slice(0, 2).toUpperCase()

  return (
    <nav className="left-nav">
      <div className="left-nav__logo">Verbo.</div>
      <div className="left-nav__room-item">
        <div className="left-nav__avatar">{roomAvatar}</div>
      </div>
    </nav>
  )
}
