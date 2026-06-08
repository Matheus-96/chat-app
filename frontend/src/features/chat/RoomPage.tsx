import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { buildRoomLink } from '../../shared/config'
import { requestNotificationPermission } from '../../shared/notifications'
import { loadStoredAgentMode, loadStoredProfile, saveProfile } from '../../shared/storage/profile'
import { Composer } from './components/Composer'
import { Header } from './components/Header'
import { LeftNav } from './components/LeftNav'
import { MessageList } from './components/MessageList'
import { SettingsDrawer } from './components/SettingsDrawer'
import { Sidebar } from './components/Sidebar'
import { useRoomConnection } from './hooks/useRoomConnection'
import './RoomPage.css'

export function RoomPage() {
  const navigate = useNavigate()
  const { roomCode = '' } = useParams()
  const normalizedCode = roomCode.toUpperCase()
  const [profile] = useState(() => loadStoredProfile())
  const [customInstructions, setCustomInstructions] = useState(profile.customInstructions)
  const [notice, setNotice] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { state, actions } = useRoomConnection({
    roomCode: normalizedCode,
    name: profile.name,
    apiKey: profile.apiKey,
    customInstructions,
    participantId: profile.participantId,
    initialAgentMode: loadStoredAgentMode(),
  })

  function handleCustomInstructionsChange(value: string) {
    setCustomInstructions(value)
    saveProfile({ name: profile.name, apiKey: profile.apiKey, customInstructions: value })
  }

  useEffect(() => {
    void requestNotificationPermission()
  }, [])

  useEffect(() => {
    if (!profile.name.trim()) {
      navigate(`/?roomCode=${normalizedCode}`, { replace: true })
    }
  }, [navigate, normalizedCode, profile.name])

  useEffect(() => {
    if (state.expired) {
      navigate('/', { state: { expired: true }, replace: true })
    }
  }, [state.expired, navigate])

  async function handleCopyLink() {
    await navigator.clipboard.writeText(buildRoomLink(normalizedCode))
    setNotice('Link copiado para compartilhar a sala.')
  }

  if (!profile.name.trim()) {
    return null
  }

  return (
    <main className="room-page">
      <LeftNav roomCode={state.roomCode || normalizedCode} />
      <section className="room-page__chat">
        <Header
          participants={state.participants}
          roomCode={state.roomCode || normalizedCode}
          onSettingsToggle={() => setSettingsOpen(!settingsOpen)}
        />
        {state.error ? <p className="room-page__error">{state.error}</p> : null}
        <MessageList
          agentMode={state.agentMode}
          messages={state.messages}
          participantId={profile.participantId}
          pendingCorrections={state.pendingCorrections}
          typingNames={Object.values(state.typing)}
          onAddReaction={actions.addReaction}
          onAnalyze={actions.analyzeMessage}
          onRemoveReaction={actions.removeReaction}
        />
        <Composer
          agentMode={state.agentMode}
          customInstructionsValid={customInstructions.length <= 250}
          disabled={state.connection !== 'connected'}
          hasApiKey={!!profile.apiKey}
          onSend={actions.sendMessage}
          onTyping={actions.sendTyping}
        />
      </section>
      <SettingsDrawer isOpen={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <Sidebar
          agentMode={state.agentMode}
          apiKey={profile.apiKey}
          connection={state.connection}
          customInstructions={customInstructions}
          expiresAt={state.expiresAt}
          name={profile.name}
          notice={notice}
          participants={state.participants}
          roomCode={state.roomCode || normalizedCode}
          onCopyLink={() => void handleCopyLink()}
          onCustomInstructionsChange={handleCustomInstructionsChange}
          onModeChange={actions.setAgentMode}
          onReconnect={actions.reconnect}
        />
      </SettingsDrawer>
    </main>
  )
}