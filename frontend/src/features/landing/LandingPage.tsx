import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createRoom, fetchRoomByCode, normalizeRoomCode } from '../../shared/api/rooms'
import { loadStoredProfile, saveProfile } from '../../shared/storage/profile'
import './LandingPage.css'

export function LandingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const profile = loadStoredProfile()
  const [name, setName] = useState(profile.name)
  const [apiKey, setApiKey] = useState(profile.apiKey)
  const [roomCode, setRoomCode] = useState(searchParams.get('roomCode') ?? '')
  const [error, setError] = useState('')
  const [busyAction, setBusyAction] = useState<'create' | 'join' | null>(null)

  async function handleCreateRoom() {
    if (!persistProfile()) {
      return
    }

    setBusyAction('create')
    setError('')

    try {
      const room = await createRoom()
      navigate(`/room/${room.roomCode}`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Falha ao criar a sala.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleJoinRoom() {
    if (!persistProfile()) {
      return
    }

    const normalizedCode = normalizeRoomCode(roomCode)

    if (!normalizedCode) {
      setError('Informe um codigo ou link valido para entrar na sala.')
      return
    }

    setBusyAction('join')
    setError('')

    try {
      await fetchRoomByCode(normalizedCode)
      navigate(`/room/${normalizedCode}`)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Nao foi possivel entrar na sala.')
    } finally {
      setBusyAction(null)
    }
  }

  function persistProfile() {
    if (!name.trim()) {
      setError('Informe seu nome antes de continuar.')
      return false
    }

    saveProfile({ name, apiKey })
    return true
  }

  return (
    <main className="landing-page">
      <section className="landing-page__hero">
        <p className="landing-page__eyebrow">Writing practice in realtime</p>
        <h1>Converse em ingles com feedback do coach no fluxo da sala.</h1>
        <p>
          Crie uma sala compartilhavel, escreva em tempo real e acompanhe correcoes do agente sem quebrar o ritmo da conversa.
        </p>
      </section>

      <section className="landing-card">
        <label>
          <span>Nome</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Como voce aparece na sala" />
        </label>
        <label>
          <span>API Key OpenRouter</span>
          <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-or-v1-..." />
        </label>
        <label>
          <span>Codigo ou link da sala</span>
          <input value={roomCode} onChange={(event) => setRoomCode(event.target.value)} placeholder="AB12CD ou URL completa" />
        </label>
        {error ? <p className="landing-card__error">{error}</p> : null}
        <div className="landing-card__actions">
          <button disabled={busyAction !== null} onClick={handleCreateRoom} type="button">
            {busyAction === 'create' ? 'Criando...' : 'Criar nova sala'}
          </button>
          <button className="landing-card__ghost" disabled={busyAction !== null} onClick={handleJoinRoom} type="button">
            {busyAction === 'join' ? 'Entrando...' : 'Entrar em sala existente'}
          </button>
        </div>
      </section>
    </main>
  )
}