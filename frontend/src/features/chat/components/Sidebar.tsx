import { useEffect, useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Button } from '@/components/ui/button'
import type { AgentMode, ConnectionStatus, ParticipantPresence } from '../../../shared/ws/protocol'
import { formatRemainingTime } from '../../../shared/utils'
import { ProfileEditor } from './ProfileEditor'
import './Sidebar.css'

interface SidebarProps {
  agentMode: AgentMode
  apiKey: string
  connection: ConnectionStatus
  customInstructions: string
  expiresAt: string
  name: string
  notice: string
  participants: ParticipantPresence[]
  roomCode: string
  onCopyLink: () => void
  onModeChange: (agentMode: AgentMode) => void
  onProfileSave: (profile: { name: string; customInstructions: string }) => void
  onReconnect: () => void
}

export function Sidebar(props: SidebarProps) {
  const [, setTick] = useState(0)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  function handleSave(profile: { name: string; customInstructions: string }) {
    props.onProfileSave(profile)
    setEditing(false)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__block">
        <p className="sidebar__eyebrow">Modo do agente</p>
        <ToggleGroup type="single" value={props.agentMode} onValueChange={(v) => props.onModeChange(v as AgentMode)} className="sidebar__toggle">
          <ToggleGroupItem value="automatic" className={props.agentMode === 'automatic' ? 'is-active' : ''}>Automatico</ToggleGroupItem>
          <ToggleGroupItem value="manual" className={props.agentMode === 'manual' ? 'is-active' : ''}>Manual</ToggleGroupItem>
        </ToggleGroup>
        <p className="sidebar__hint">Manual libera o botao no balao e o atalho Ctrl+Enter para enviar com analise.</p>
      </div>

      <div className="sidebar__block">
        <p className="sidebar__eyebrow">Participantes</p>
        <ul className="sidebar__list">{props.participants.map((p) => <li key={p.participantId}>{p.name}</li>)}</ul>
      </div>

      <div className="sidebar__block">
        <p className="sidebar__eyebrow">Perfil</p>
        {editing ? (
          <ProfileEditor
            name={props.name}
            customInstructions={props.customInstructions}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <dl className="sidebar__meta">
              <div><dt>Nome</dt><dd>{props.name}</dd></div>
              <div><dt>API Key</dt><dd>{maskApiKey(props.apiKey)}</dd></div>
              <div><dt>Instrucoes</dt><dd>{props.customInstructions || '—'}</dd></div>
            </dl>
            <Button onClick={() => setEditing(true)}>Editar perfil</Button>
          </>
        )}
      </div>

      <div className="sidebar__block">
        <p className="sidebar__eyebrow">Sala</p>
        <dl className="sidebar__meta">
          <div><dt>Codigo</dt><dd>{props.roomCode}</dd></div>
          <div><dt>Status</dt><dd>{props.connection}</dd></div>
          <div><dt>TTL</dt><dd>{props.expiresAt ? formatRemainingTime(props.expiresAt) : '...'}</dd></div>
        </dl>
        <div className="sidebar__actions">
          <Button onClick={props.onReconnect}>Reconectar</Button>
          <Button onClick={props.onCopyLink}>Copiar link</Button>
        </div>
        {props.notice ? <p className="sidebar__notice">{props.notice}</p> : null}
      </div>
    </aside>
  )
}

function maskApiKey(apiKey: string) {
  if (!apiKey) return 'Nao informada'
  return `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`
}
