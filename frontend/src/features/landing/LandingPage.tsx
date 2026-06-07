import { useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { createRoom, fetchRoomByCode, normalizeRoomCode } from '../../shared/api/rooms'
import { loadStoredProfile, saveProfile } from '../../shared/storage/profile'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ProfileEditor } from './components/ProfileEditor'
import './LandingPage.css'

export function LandingPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const isExpired = (location.state as { expired?: boolean } | null)?.expired === true
  const profile = loadStoredProfile()
  const [savedProfile, setSavedProfile] = useState(profile)
  const [roomCode, setRoomCode] = useState(searchParams.get('roomCode') ?? '')
  const [error, setError] = useState('')
  const [busyAction, setBusyAction] = useState<'create' | 'join' | null>(null)

  function handleProfileSave(updated: { name: string; apiKey: string; customInstructions: string }) {
    saveProfile(updated)
    setSavedProfile({ ...updated, participantId: profile.participantId })
    setError('')
  }

  async function handleCreateRoom() {
    if (!savedProfile.name.trim()) { setError('Informe seu nome antes de continuar.'); return }
    setBusyAction('create')
    setError('')
    try {
      const room = await createRoom()
      navigate(`/room/${room.roomCode}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar a sala.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleJoinRoom() {
    if (!savedProfile.name.trim()) { setError('Informe seu nome antes de continuar.'); return }
    const normalizedCode = normalizeRoomCode(roomCode)
    if (!normalizedCode) { setError('Informe um codigo ou link valido para entrar na sala.'); return }
    setBusyAction('join')
    setError('')
    try {
      await fetchRoomByCode(normalizedCode)
      navigate(`/room/${normalizedCode}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nao foi possivel entrar na sala.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <main className="landing-page">
      {isExpired && (
        <p className="landing-page__expired-notice">Sala expirada ou nao encontrada. Crie uma nova sala para continuar.</p>
      )}
      <section className="landing-page__hero">
        <p className="landing-page__eyebrow">Writing practice in realtime</p>
        <h1>Converse em ingles com feedback do coach no fluxo da sala.</h1>
        <p>Crie uma sala compartilhavel, escreva em tempo real e acompanhe correcoes do agente sem quebrar o ritmo da conversa.</p>
      </section>

      <section className="landing-card">
        <Card>
          <div className="p-6 space-y-4">
            <ProfileEditor
              name={savedProfile.name}
              apiKey={savedProfile.apiKey}
              customInstructions={savedProfile.customInstructions}
              submitLabel="Salvar perfil"
              onSave={handleProfileSave}
            >
              <label className="space-y-1.5">
                <span>Codigo ou link da sala</span>
                <Input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="AB12CD ou URL completa" />
              </label>
            </ProfileEditor>
            {error ? <p className="landing-card__error">{error}</p> : null}
            <div className="landing-card__actions space-y-2 pt-2">
              <Button disabled={busyAction !== null} onClick={() => void handleCreateRoom()}>
                {busyAction === 'create' ? 'Criando...' : 'Criar nova sala'}
              </Button>
              <Button variant="ghost" disabled={busyAction !== null} onClick={() => void handleJoinRoom()}>
                {busyAction === 'join' ? 'Entrando...' : 'Entrar em sala existente'}
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </main>
  )
}
