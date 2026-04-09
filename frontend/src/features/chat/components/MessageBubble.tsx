import type { RoomMessage } from '../../../shared/ws/protocol'
import './MessageBubble.css'

interface MessageBubbleProps {
  canAnalyze: boolean
  correction?: RoomMessage
  isOwn: boolean
  isPending: boolean
  message: RoomMessage
  onAnalyze: (messageId: string) => void
}

export function MessageBubble(props: MessageBubbleProps) {
  return (
    <article className={`message-bubble ${props.isOwn ? 'message-bubble--own' : ''}`}>
      <div className="message-bubble__card">
        <p className="message-bubble__author">{props.isOwn ? 'Voce' : props.message.authorName}</p>
        <p className="message-bubble__content">{props.message.content}</p>
        {props.canAnalyze ? <button className="message-bubble__action" onClick={() => props.onAnalyze(props.message.id)} type="button">Analisar com agente</button> : null}
        {props.isPending ? <p className="message-bubble__status">Coach analisando...</p> : null}
        {props.correction ? <CorrectionBlock correction={props.correction} /> : null}
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