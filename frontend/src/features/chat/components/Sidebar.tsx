import type { AgentMode, ConnectionStatus, ParticipantPresence } from '../../../shared/ws/protocol'
import './Sidebar.css'

interface SidebarProps {
  agentMode: AgentMode
  apiKey: string
  connection: ConnectionStatus
  expiresAt: string
  name: string
  notice: string
  participants: ParticipantPresence[]
  roomCode: string
  onCopyLink: () => void
  onModeChange: (agentMode: AgentMode) => void
  onReconnect: () => void
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__block">
        <p className="sidebar__eyebrow">Modo do agente</p>
        <div className="sidebar__toggle">
          <button className={props.agentMode === 'automatic' ? 'is-active' : ''} onClick={() => props.onModeChange('automatic')} type="button">Automatico</button>
          <button className={props.agentMode === 'manual' ? 'is-active' : ''} onClick={() => props.onModeChange('manual')} type="button">Manual</button>
        </div>
        <p className="sidebar__hint">Manual libera o botao no balao e o atalho Ctrl+Enter para enviar com analise.</p>
      </div>

      <div className="sidebar__block">
        <p className="sidebar__eyebrow">Participantes</p>
        <ul className="sidebar__list">{props.participants.map((participant) => <li key={participant.participantId}>{participant.name}</li>)}</ul>
      </div>

      <div className="sidebar__block">
        <p className="sidebar__eyebrow">Informacoes</p>
        <dl className="sidebar__meta">
          <div><dt>Nome</dt><dd>{props.name}</dd></div>
          <div><dt>API Key</dt><dd>{maskApiKey(props.apiKey)}</dd></div>
          <div><dt>Sala</dt><dd>{props.roomCode}</dd></div>
          <div><dt>Status</dt><dd>{props.connection}</dd></div>
          <div><dt>TTL</dt><dd>{props.expiresAt ? new Date(props.expiresAt).toLocaleString('pt-BR') : '...'}</dd></div>
        </dl>
        <div className="sidebar__actions">
          <button onClick={props.onReconnect} type="button">Reconectar</button>
          <button onClick={props.onCopyLink} type="button">Copiar link</button>
        </div>
        {props.notice ? <p className="sidebar__notice">{props.notice}</p> : null}
      </div>
    </aside>
  )
}

function maskApiKey(apiKey: string) {
  if (!apiKey) {
    return 'Nao informada'
  }

  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
}