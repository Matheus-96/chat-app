import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CoachMode, ParticipantPresence, RoomMessage, RoomMeta, StoredProfile } from './types'

interface ChatPageProps {
  profile: StoredProfile
  onProfileChange: (profile: StoredProfile) => void
  roomId: string
  onGoToLanding: () => void
}

type ConnectionStatus = 'idle' | 'joining' | 'connected'

type SocketEvent =
  | { type: 'room_snapshot'; roomId: string; expiresAt: string; participants: ParticipantPresence[]; messages: RoomMessage[] }
  | { type: 'participant_update'; participants: ParticipantPresence[] }
  | { type: 'message_created'; message: RoomMessage }
  | { type: 'correction_started'; messageId: string }
  | { type: 'correction_finished'; messageId: string }
  | { type: 'typing'; participantId: string; name: string; isTyping: boolean }
  | { type: 'error'; message: string }

const TYPING_DEBOUNCE_MS = 1500

function getParticipantId(roomId: string) {
  const key = `chat-writing-coach.participant.${roomId}`
  const fallbackId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.slice(0, 8)

  let existing: string | null = null
  try {
    existing = sessionStorage.getItem(key)
  } catch {
    return fallbackId
  }

  if (existing) return existing

  const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID().slice(0, 8)
    : fallbackId

  try {
    sessionStorage.setItem(key, id)
  } catch {
    return id
  }

  return id
}

function getWebSocketUrl() {
  const configured = import.meta.env.VITE_WS_URL as string | undefined
  if (configured) return configured
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? ''
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export default function ChatPage(props: ChatPageProps) {
  const { profile, onProfileChange, roomId, onGoToLanding } = props

  const [roomMeta, setRoomMeta] = useState<RoomMeta | null>(null)
  const [participants, setParticipants] = useState<ParticipantPresence[]>([])
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [pendingMessageIds, setPendingMessageIds] = useState<string[]>([])
  const [typingNames, setTypingNames] = useState<Map<string, string>>(new Map())
  const [draft, setDraft] = useState('')
  const [rewriteTarget, setRewriteTarget] = useState<RoomMessage | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [coachMode, setCoachMode] = useState<CoachMode>('automatic')
  const [errorMessage, setErrorMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [expandedCorrections, setExpandedCorrections] = useState<Set<string>>(new Set())

  const socketRef = useRef<WebSocket | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isTypingSentRef = useRef(false)

  const currentParticipantId = useMemo(() => getParticipantId(roomId), [roomId])
  const shareUrl = `${window.location.origin}/r/${roomId}`

  // ---- derived data -------------------------------------------------------

  const coachRepliesByMessageId = useMemo(() => {
    const map = new Map<string, RoomMessage>()
    for (const message of messages) {
      if (message.role === 'assistant' && message.replyToMessageId) {
        map.set(message.replyToMessageId, message)
      }
    }
    return map
  }, [messages])

  const messagesWithStatus = useMemo(() => {
    const pendingIds = new Set(pendingMessageIds)
    return messages.map((message) => ({
      ...message,
      isPendingCorrection: pendingIds.has(message.id),
      coachReply: coachRepliesByMessageId.get(message.id) ?? null,
    }))
  }, [messages, pendingMessageIds, coachRepliesByMessageId])

  const typingList = useMemo(() => {
    const names: string[] = []
    for (const [pid, name] of typingNames.entries()) {
      if (pid !== currentParticipantId) names.push(name)
    }
    return names
  }, [typingNames, currentParticipantId])

  // ---- scroll to bottom ---------------------------------------------------

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messagesWithStatus.length, typingList.length])

  // ---- load room meta -----------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const response = await fetch(`${getApiBaseUrl()}/api/rooms/${roomId}`)
        if (!response.ok) throw new Error('Sala nao encontrada ou expirada.')
        const payload = await response.json() as RoomMeta
        if (!cancelled) setRoomMeta(payload)
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Nao foi possivel carregar a sala.')
      }
    }

    void load()
    return () => { cancelled = true }
  }, [roomId])

  // ---- websocket ----------------------------------------------------------

  const joinRoom = useCallback(() => {
    if (!profile.name.trim()) {
      setErrorMessage('Informe seu nome para entrar na sala.')
      return
    }

    setStatus('joining')
    setErrorMessage('')
    setPendingMessageIds([])
    setTypingNames(new Map())

    socketRef.current?.close()

    const ws = new WebSocket(getWebSocketUrl())
    socketRef.current = ws

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        type: 'join_room',
        roomId,
        participantId: currentParticipantId,
        name: profile.name.trim(),
      }))
    })

    ws.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data as string) as SocketEvent

      switch (payload.type) {
        case 'room_snapshot':
          setParticipants(payload.participants)
          setMessages(payload.messages)
          setRoomMeta((m) => m ? { ...m, expiresAt: payload.expiresAt } : m)
          setStatus('connected')
          break
        case 'participant_update':
          setParticipants(payload.participants)
          break
        case 'message_created':
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.message.id)) return prev
            return [...prev, payload.message]
          })
          break
        case 'correction_started':
          setPendingMessageIds((prev) => prev.includes(payload.messageId) ? prev : [...prev, payload.messageId])
          break
        case 'correction_finished':
          setPendingMessageIds((prev) => prev.filter((id) => id !== payload.messageId))
          break
        case 'typing':
          setTypingNames((prev) => {
            const next = new Map(prev)
            if (payload.isTyping) {
              next.set(payload.participantId, payload.name)
            } else {
              next.delete(payload.participantId)
            }
            return next
          })
          break
        case 'error':
          setErrorMessage(payload.message)
          break
      }
    })

    ws.addEventListener('close', () => {
      if (socketRef.current === ws) setStatus('idle')
    })

    ws.addEventListener('error', () => {
      setErrorMessage('Nao foi possivel conectar em tempo real com a sala.')
      setStatus('idle')
    })
  }, [roomId, currentParticipantId, profile.name])

  useEffect(() => {
    joinRoom()
    return () => { socketRef.current?.close() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  // ---- typing events ------------------------------------------------------

  function sendTypingEvent(isTyping: boolean) {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'typing', isTyping }))
  }

  function handleDraftChange(value: string) {
    setDraft(value)

    if (!isTypingSentRef.current) {
      isTypingSentRef.current = true
      sendTypingEvent(true)
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)

    typingTimerRef.current = setTimeout(() => {
      isTypingSentRef.current = false
      sendTypingEvent(false)
    }, TYPING_DEBOUNCE_MS)
  }

  // ---- send message -------------------------------------------------------

  function sendMessage() {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setErrorMessage('Conecte-se a uma sala antes de enviar mensagens.')
      return
    }

    const content = draft.trim()
    if (!content) return

    // In rewrite mode the composer is locked to a specific target message
    // and the user must produce a corrected version before sending.
    if (coachMode === 'rewrite' && rewriteTarget) {
      ws.send(JSON.stringify({
        type: 'send_message',
        content,
        apiKey: profile.apiKey.trim() || undefined,
        analyze: true,
        analysisMode: 'rewrite',
      }))
      setDraft('')
      setRewriteTarget(null)
    } else if (coachMode === 'rewrite') {
      // No target yet — send without analysis and wait for coach reply before allowing rewrite
      ws.send(JSON.stringify({
        type: 'send_message',
        content,
        apiKey: profile.apiKey.trim() || undefined,
        analyze: true,
        analysisMode: 'rewrite',
      }))
      setDraft('')
    } else {
      ws.send(JSON.stringify({
        type: 'send_message',
        content,
        apiKey: profile.apiKey.trim() || undefined,
        analyze: coachMode === 'automatic',
        analysisMode: 'standard',
      }))
      setDraft('')
    }

    // Stop typing indicator
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current)
    isTypingSentRef.current = false
    sendTypingEvent(false)
  }

  function requestManualAnalysis(messageId: string) {
    const ws = socketRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({
      type: 'analyze_message',
      messageId,
      apiKey: profile.apiKey.trim() || undefined,
      analysisMode: 'standard',
    }))
  }

  function enterRewriteMode(originalMessage: RoomMessage) {
    setRewriteTarget(originalMessage)
    setDraft('')
    textareaRef.current?.focus()
  }

  function cancelRewrite() {
    setRewriteTarget(null)
    setDraft('')
  }

  async function copyShareLink() {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function toggleExpanded(id: string) {
    setExpandedCorrections((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ---- render -------------------------------------------------------------

  const composerHint = rewriteTarget
    ? 'Reescreva a frase corrigindo o erro apontado pelo coach e envie.'
    : coachMode === 'automatic'
      ? 'Envio e revisao ocorrem em paralelo automaticamente.'
      : coachMode === 'rewrite'
        ? 'Envie sua frase. O coach aponta o erro e voce reescreve para praticar.'
        : 'No modo manual, clique em "Analisar" ao lado da mensagem para obter revisao.'

  return (
    <main className="chat-shell">
      <header className="chat-topbar">
        <button className="ghost-button" onClick={onGoToLanding}>← Voltar</button>
        <div className="topbar-room">
          <p className="section-label">Sala</p>
          <strong>{roomId}</strong>
        </div>
        <button className="secondary-button" onClick={() => void copyShareLink()}>
          {copied ? '✓ Link copiado' : 'Copiar link'}
        </button>
      </header>

      <section className="workspace-panel">
        <aside className="control-panel">
          <div className="panel-card">
            <p className="section-label">Perfil</p>
            <label>
              Nome
              <input
                value={profile.name}
                onChange={(e) => onProfileChange({ ...profile, name: e.target.value })}
              />
            </label>
            <label>
              Chave OpenRouter
              <input
                type="password"
                value={profile.apiKey}
                onChange={(e) => onProfileChange({ ...profile, apiKey: e.target.value })}
              />
            </label>
            <button
              className="primary-button"
              onClick={joinRoom}
              disabled={status === 'joining'}
            >
              {status === 'joining' ? 'Conectando...' : 'Reconectar'}
            </button>
          </div>

          <div className="panel-card">
            <p className="section-label">Modo do coach</p>
            <label>
              Analise
              <select
                value={coachMode}
                onChange={(e) => {
                  setCoachMode(e.target.value as CoachMode)
                  setRewriteTarget(null)
                  setDraft('')
                }}
              >
                <option value="automatic">Automatico</option>
                <option value="manual">Manual</option>
                <option value="rewrite">Reescrever</option>
              </select>
            </label>
            <p className="input-hint">
              {coachMode === 'automatic'
                ? 'Toda mensagem enviada dispara o coach automaticamente.'
                : coachMode === 'manual'
                  ? 'Clique em "Analisar" ao lado das suas mensagens.'
                  : 'O coach aponta erros criticos. Reescreva para fixar o aprendizado.'}
            </p>
          </div>

          <div className="panel-card presence-card">
            <p className="section-label">Presenca</p>
            {participants.length === 0 ? (
              <p>Ninguem conectado ainda.</p>
            ) : (
              <ul>
                {participants.map((p) => (
                  <li key={p.participantId}>
                    <strong>{p.name}</strong>
                    <span>{p.participantId === currentParticipantId ? 'Voce' : 'Online'}</span>
                  </li>
                ))}
              </ul>
            )}
            {roomMeta ? (
              <p className="share-link">
                Expira em {new Date(roomMeta.expiresAt).toLocaleString('pt-BR')}
              </p>
            ) : null}
          </div>
        </aside>

        <section className="chat-panel">
          <header className="chat-header">
            <div>
              <p className="section-label">Conversa</p>
              <h2>Mensagens em tempo real</h2>
            </div>
            <span className={`status-pill status-${status}`}>{status}</span>
          </header>

          {errorMessage ? (
            <p className="error-banner">{errorMessage}</p>
          ) : null}

          <div className="messages-list">
            {messagesWithStatus.length === 0 ? (
              <div className="empty-state">
                <p>Sem mensagens ainda.</p>
                <span>Envie sua primeira frase em ingles para iniciar a conversa.</span>
              </div>
            ) : (
              messagesWithStatus.map((message) => {
                const isCurrentUser = message.authorId === currentParticipantId
                const isUserMessage = message.role === 'user'
                const isCoachMsg = message.role === 'assistant'
                const isRewriteCoachMsg = isCoachMsg && message.analysisMode === 'rewrite'

                const bubbleClass = isCoachMsg
                  ? 'message-coach'
                  : isCurrentUser
                    ? 'message-self'
                    : 'message-peer'

                const showManualBtn = coachMode === 'manual' && isUserMessage && isCurrentUser
                const showRewriteBtn = coachMode === 'rewrite' && isUserMessage && isCurrentUser && message.coachReply !== null && !rewriteTarget

                return (
                  <article key={message.id} className={`message-bubble ${bubbleClass}`}>
                    <div className="message-meta">
                      <strong>{message.authorName}</strong>
                      <span>{formatTime(message.createdAt)}</span>
                    </div>

                    {isRewriteCoachMsg ? (
                      <>
                        <small>{message.explanation}</small>
                        <button
                          className="see-correction-btn"
                          onClick={() => toggleExpanded(message.id)}
                        >
                          {expandedCorrections.has(message.id) ? 'Ocultar versao corrigida ↑' : 'Ver versao corrigida →'}
                        </button>
                        {expandedCorrections.has(message.id) ? (
                          <p className="correction-revealed">{message.content}</p>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <p>{message.content}</p>
                        {message.explanation && !isRewriteCoachMsg ? (
                          <small>{message.explanation}</small>
                        ) : null}
                      </>
                    )}

                    {message.isPendingCorrection ? (
                      <span className="pending-tag">Coach analisando...</span>
                    ) : null}

                    {showManualBtn ? (
                      <button
                        className="analyze-button"
                        onClick={() => requestManualAnalysis(message.id)}
                        disabled={message.isPendingCorrection}
                      >
                        {message.coachReply ? 'Analisar novamente' : 'Analisar com coach'}
                      </button>
                    ) : null}

                    {showRewriteBtn ? (
                      <button
                        className="analyze-button rewrite-trigger"
                        onClick={() => enterRewriteMode(message)}
                      >
                        Reescrever esta frase
                      </button>
                    ) : null}
                  </article>
                )
              })
            )}

            {typingList.length > 0 ? (
              <div className="typing-indicator">
                <span className="typing-dots">
                  <span /><span /><span />
                </span>
                <span>
                  {typingList.join(', ')} {typingList.length === 1 ? 'esta' : 'estao'} digitando...
                </span>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <footer className="composer">
            {rewriteTarget ? (
              <div className="rewrite-banner">
                <span>Reescreva: <em>"{rewriteTarget.content}"</em></span>
                <button className="ghost-button" onClick={cancelRewrite}>Cancelar</button>
              </div>
            ) : null}

            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder={
                rewriteTarget
                  ? 'Reescreva a frase corrigida aqui...'
                  : 'Write your next message in English... (Enter to send, Shift+Enter for new line)'
              }
              rows={3}
            />

            <div className="composer-actions">
              <p>{composerHint}</p>
              <button
                className="primary-button"
                onClick={sendMessage}
                disabled={status !== 'connected' || !draft.trim()}
              >
                {rewriteTarget ? 'Enviar reescrita' : 'Enviar'}
              </button>
            </div>
          </footer>
        </section>
      </section>
    </main>
  )
}
