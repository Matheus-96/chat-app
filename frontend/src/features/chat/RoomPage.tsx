import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { buildRoomLink } from '../../shared/config'
import { requestNotificationPermission } from '../../shared/notifications'
import { loadStoredProfile, saveProfile } from '../../shared/storage/profile'
import { Composer } from './components/Composer'
import { MessageList } from './components/MessageList'
import { Sidebar } from './components/Sidebar'
import { useRoomConnection } from './hooks/useRoomConnection'
import './RoomPage.css'

export function RoomPage() {
  const navigate = useNavigate()
  const { roomCode = '' } = useParams()
  const normalizedCode = roomCode.toUpperCase()
  const [profile, setProfile] = useState(() => loadStoredProfile())
  const [notice, setNotice] = useState('')
  const { state, actions } = useRoomConnection({
    roomCode: normalizedCode,
    name: profile.name,
    apiKey: profile.apiKey,
    participantId: profile.participantId,
    customInstructions: profile.customInstructions,
  })

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

  function handleProfileSave(updated: { name: string; customInstructions: string }) {
    const newProfile = { ...profile, ...updated }
    saveProfile(newProfile)
    setProfile(newProfile)
    if (updated.name !== profile.name) {
      actions.sendUpdateName(updated.name)
    }
  }

  if (!profile.name.trim()) return null

  return (
    <main className="room-page">
      <Sidebar
        agentMode={state.agentMode}
        apiKey={profile.apiKey}
        connection={state.connection}
        customInstructions={profile.customInstructions}
        expiresAt={state.expiresAt}
        name={profile.name}
        notice={notice}
        participants={state.participants}
        roomCode={state.roomCode || normalizedCode}
        onCopyLink={() => void handleCopyLink()}
        onModeChange={actions.setAgentMode}
        onProfileSave={handleProfileSave}
        onReconnect={actions.reconnect}
      />
      <section className="room-page__chat">
        {state.error ? <p className="room-page__error">{state.error}</p> : null}
        <MessageList
          agentMode={state.agentMode}
          messages={state.messages}
          participantId={profile.participantId}
          pendingCorrections={state.pendingCorrections}
          typingNames={Object.values(state.typing)}
          onAnalyze={actions.analyzeMessage}
        />
        <Composer
          agentMode={state.agentMode}
          disabled={state.connection !== 'connected'}
          onSend={actions.sendMessage}
          onTyping={actions.sendTyping}
        />
      </section>
    </main>
  )
}
