import type { ParticipantPresence } from '../../../shared/ws/protocol'
import { GearIcon } from '../../../shared/icons/GearIcon'
import './Header.css'

interface HeaderProps {
  participants: ParticipantPresence[]
  roomCode: string
  onSettingsToggle: () => void
}

export function Header({ participants, roomCode, onSettingsToggle }: HeaderProps) {
  const participantNames = participants.map((p) => p.name).join(', ')
  const title = participantNames || roomCode

  return (
    <header className="header">
      <div className="header__content">
        <h1 className="header__title">{title}</h1>
        <div className="header__avatars">
          {participants.map((p) => (
            <div key={p.participantId} className="header__avatar" title={p.name}>
              {p.name.slice(0, 2).toUpperCase()}
            </div>
          ))}
        </div>
        <div className="header__chip"># {roomCode}</div>
      </div>
      <button
        className="header__settings-btn"
        onClick={onSettingsToggle}
        aria-label="Configurações"
        type="button"
      >
        <GearIcon />
      </button>
    </header>
  )
}
