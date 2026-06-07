import { Button } from '@/components/ui/button'
import { ReactionBar } from '@/components/ui/ReactionBar'
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
  onAnalyze: (messageId: string) => void
  onRemoveReaction: (emoji: string) => void
}

export function MessageBubble(props: MessageBubbleProps) {
  return (
    <article className={`message-bubble group ${props.isOwn ? 'message-bubble--own' : ''}`}>
      <div className="message-bubble__card">
        <p className="message-bubble__author">{props.isOwn ? 'Voce' : props.message.authorName}</p>
        <p className="message-bubble__content">{props.message.content}</p>
        {props.canAnalyze ? <Button variant="link" className="message-bubble__action" onClick={() => props.onAnalyze(props.message.id)} type="button">Analisar com agente</Button> : null}
        {props.isPending ? <p className="message-bubble__status">Coach analisando...</p> : null}
        {props.correction && props.correction.error
          ? <ErrorBlock message={props.message} onAnalyze={props.onAnalyze} />
          : props.correction
          ? <CorrectionBlock correction={props.correction} />
          : null}
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

function CorrectionBlock({ correction }: { correction: RoomMessage }) {
  return (
    <div className="message-bubble__correction">
      <div className="message-bubble__divider">
        <span />
        <details className="message-bubble__details">
          <summary>i</summary>
          <p>{correction.explanation}</p>
        </details>
      </div>
      <p className="message-bubble__corrected">{correction.content}</p>
    </div>
  )
}

function ErrorBlock({ message, onAnalyze }: { message: RoomMessage; onAnalyze: (id: string) => void }) {
  return (
    <div className="message-bubble__error">
      <p className="message-bubble__error-text">Analise indisponivel.</p>
      <Button variant="link" className="message-bubble__action" onClick={() => onAnalyze(message.id)} type="button">Analisar</Button>
    </div>
  )
}