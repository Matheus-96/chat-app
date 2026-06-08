import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ReactionBar } from '@/components/ui/ReactionBar'
import { getAvatarColor } from '../../../lib/avatarColor'
import { computeDiff } from '../../../lib/diff'
import type { RoomMessage } from '../../../shared/ws/protocol'
import './MessageBubble.css'

interface MessageBubbleProps {
  canAnalyze: boolean
  correction?: RoomMessage
  isOwn: boolean
  isPending: boolean
  message: RoomMessage
  participantId: string
  onAddReaction: (emoji: string) => void
  onAnalyze: (messageId: string, mode?: 'normal' | 'chunking') => void
  onRemoveReaction: (emoji: string) => void
}

export function MessageBubble(props: MessageBubbleProps) {
  const avatarColor = getAvatarColor(props.message.authorId)
  const initials = props.message.authorName.slice(0, 2).toUpperCase()

  return (
    <article className={`message-bubble group ${props.isOwn ? 'message-bubble--own' : 'message-bubble--other'}`}>
      {!props.isOwn && (
        <div className="message-bubble__avatar" style={{ backgroundColor: avatarColor }}>
          {initials}
        </div>
      )}
      <div className="message-bubble__card">
        <p className="message-bubble__content">{props.message.content}</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {props.canAnalyze ? <Button variant="link" className="message-bubble__action" onClick={() => props.onAnalyze(props.message.id, 'normal')} type="button">Analisar com agente</Button> : null}
          {props.canAnalyze ? <Button variant="link" className="message-bubble__action" onClick={() => props.onAnalyze(props.message.id, 'chunking')} type="button">Chunking</Button> : null}
        </div>
        {props.isPending ? <p className="message-bubble__status">Coach analisando...</p> : null}
        {props.correction && props.correction.error
          ? <ErrorBlock message={props.message} onAnalyze={props.onAnalyze} />
          : props.correction
          ? <CorrectionBlock correction={props.correction} originalMessage={props.message} />
          : null}
        {props.message.chunking ? <ChunkingBlock chunking={props.message.chunking} messageId={props.message.id} onAnalyze={props.onAnalyze} /> : null}
        <ReactionBar
          reactions={props.message.reactions}
          participantId={props.participantId}
          onAdd={props.onAddReaction}
          onRemove={props.onRemoveReaction}
        />
      </div>
    </article>
  )
}

function CorrectionBlock({ correction, originalMessage }: { correction: RoomMessage; originalMessage: RoomMessage }) {
  const [expanded, setExpanded] = useState(true)

  const diffTokens = computeDiff(originalMessage.content, correction.content)

  return (
    <div className="message-bubble__correction">
      <div className="message-bubble__correction-header">
        <span className="message-bubble__correction-badge">CORREÇÃO</span>
        <button
          className="message-bubble__correction-toggle"
          onClick={() => setExpanded(!expanded)}
          type="button"
          aria-label={expanded ? 'Esconder análise' : 'Exibir análise'}
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {expanded && (
        <>
          <div className="message-bubble__correction-diff">
            {diffTokens.map((token, idx) => (
              <span
                key={idx}
                className={token.changed ? 'message-bubble__correction-changed' : ''}
              >
                {token.text}
              </span>
            ))}
          </div>

          {correction.explanation && (
            <p className="message-bubble__correction-explanation">{correction.explanation}</p>
          )}

          <button
            className="message-bubble__correction-button"
            onClick={() => setExpanded(false)}
            type="button"
          >
            Entendi
          </button>
        </>
      )}
    </div>
  )
}

function ErrorBlock({ message, onAnalyze }: { message: RoomMessage; onAnalyze: (id: string, mode?: 'normal' | 'chunking') => void }) {
  return (
    <div className="message-bubble__error">
      <p className="message-bubble__error-text">Analise indisponivel.</p>
      <Button variant="link" className="message-bubble__action" onClick={() => onAnalyze(message.id, 'normal')} type="button">Analisar</Button>
    </div>
  )
}

function ChunkingBlock({ chunking, messageId, onAnalyze }: { chunking: RoomMessage['chunking']; messageId: string; onAnalyze: (id: string, mode?: 'normal' | 'chunking') => void }) {
  const [expanded, setExpanded] = useState(true)

  if (!chunking) return null

  return (
    <div className="message-bubble__chunking">
      <div className="message-bubble__chunking-header">
        <span className="message-bubble__chunking-badge">CHUNKING</span>
        <button
          className="message-bubble__chunking-toggle"
          onClick={() => setExpanded(!expanded)}
          type="button"
          aria-label={expanded ? 'Esconder análise' : 'Exibir análise'}
        >
          {expanded ? '−' : '+'}
        </button>
      </div>

      {expanded && (
        <>
          {chunking.error ? (
            <>
              <p className="message-bubble__error-text">Análise indisponível.</p>
              <Button variant="link" className="message-bubble__action" onClick={() => onAnalyze(messageId, 'chunking')} type="button">Analisar</Button>
            </>
          ) : (
            <table className="message-bubble__chunking-table">
              <thead>
                <tr>
                  <th>Chunk</th>
                  <th>Tradução</th>
                </tr>
              </thead>
              <tbody>
                {chunking.chunks.map((chunk, idx) => (
                  <tr key={idx}>
                    <td>{chunk.text}</td>
                    <td>{chunk.analysis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}