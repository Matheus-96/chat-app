import { useState } from 'react'
import type { StoredProfile } from './types'

interface LandingPageProps {
  profile: StoredProfile
  onProfileChange: (profile: StoredProfile) => void
  onNavigateToRoom: (roomId: string) => void
}

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

function normalizeRoomInput(value: string) {
  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  const slashMatch = normalized.match(/\/r\/([A-Za-z0-9_-]+)$/)

  if (slashMatch?.[1]) {
    return slashMatch[1]
  }

  return normalized.replace(/\s/g, '')
}

export default function LandingPage(props: LandingPageProps) {
  const { profile, onProfileChange, onNavigateToRoom } = props
  const [roomInput, setRoomInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'creating'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  async function createRoom() {
    setErrorMessage('')

    if (!profile.name.trim()) {
      setErrorMessage('Informe seu nome para criar uma sala.')
      return
    }

    setStatus('creating')

    try {
      const response = await fetch(`${getApiBaseUrl()}/api/rooms`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Nao foi possivel criar a sala.')
      }

      const payload = await response.json() as { roomId: string }
      onNavigateToRoom(payload.roomId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Falha ao criar sala.')
      setStatus('idle')
    }
  }

  function connectToRoom() {
    setErrorMessage('')

    if (!profile.name.trim()) {
      setErrorMessage('Informe seu nome para entrar em uma sala.')
      return
    }

    const normalizedRoomId = normalizeRoomInput(roomInput)

    if (!normalizedRoomId) {
      setErrorMessage('Informe o codigo da sala para conectar.')
      return
    }

    onNavigateToRoom(normalizedRoomId)
  }

  return (
    <main className="landing-shell">
      <section className="landing-hero">
        <p className="eyebrow">Realtime Writing Coach</p>
        <h1>Pratique ingles em chat real com ajuda da IA.</h1>
        <p>
          Crie salas por link, converse com outra pessoa e receba correcao privada para evoluir no writing.
        </p>

        <ul className="landing-features">
          <li>
            <strong>Automatico</strong>
            <span>Toda mensagem enviada dispara o coach automaticamente.</span>
          </li>
          <li>
            <strong>Manual</strong>
            <span>Solicite analise individualmente por mensagem.</span>
          </li>
          <li>
            <strong>Reescrever</strong>
            <span>Receba dicas sobre erros criticos e reescreva a frase para fixar o aprendizado.</span>
          </li>
        </ul>
      </section>

      <section className="landing-card">
        <h2>Entrar ou criar sala</h2>

        <label>
          Seu nome
          <input
            value={profile.name}
            onChange={(e) => onProfileChange({ ...profile, name: e.target.value })}
            placeholder="Ex.: Victor"
            onKeyDown={(e) => { if (e.key === 'Enter') void createRoom() }}
          />
        </label>

        <label>
          Chave OpenRouter
          <input
            type="password"
            value={profile.apiKey}
            onChange={(e) => onProfileChange({ ...profile, apiKey: e.target.value })}
            placeholder="sk-or-v1-..."
          />
          <span className="input-hint">Salva somente neste navegador.</span>
        </label>

        <label>
          Sala existente (codigo ou link)
          <input
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="Ex.: DXNF2Y5BU6 ou /r/DXNF2Y5BU6"
            onKeyDown={(e) => { if (e.key === 'Enter') connectToRoom() }}
          />
        </label>

        {errorMessage ? <p className="error-banner landing-error">{errorMessage}</p> : null}

        <div className="landing-actions">
          <button className="secondary-button" onClick={connectToRoom}>
            Conectar na sala
          </button>
          <button
            className="primary-button"
            onClick={() => void createRoom()}
            disabled={status === 'creating'}
          >
            {status === 'creating' ? 'Criando...' : 'Criar sala'}
          </button>
        </div>
      </section>
    </main>
  )
}
