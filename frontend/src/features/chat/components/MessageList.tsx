import { useEffect, useRef } from 'react'
import type { AgentMode, RoomMessage } from '../../../shared/ws/protocol'
import { MessageBubble } from './MessageBubble'
import './MessageList.css'

interface MessageListProps {
  agentMode: AgentMode
  messages: RoomMessage[]
  participantId: string
  pendingCorrections: string[]
  typingNames: string[]
  onAddReaction: (messageId: string, emoji: string) => void
  onAnalyze: (messageId: string) => void
  onRemoveReaction: (messageId: string, emoji: string) => void
}

export function MessageList(props: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const replies = new Map(props.messages.filter((message) => message.role === 'assistant' && message.replyToMessageId).map((message) => [message.replyToMessageId!, message]))
  const roots = props.messages.filter((message) => message.role === 'user')

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
  }, [props.messages, props.typingNames])

  return (
    <section className="message-list" ref={containerRef}>
      {roots.length === 0 ? <div className="message-list__empty">Crie a primeira mensagem da sala para iniciar a conversa.</div> : null}
      {roots.map((message) => (
        <MessageBubble
          canAnalyze={props.agentMode === 'manual' && message.authorId === props.participantId && !replies.has(message.id) && !props.pendingCorrections.includes(message.id)}
          correction={replies.get(message.id)}
          isOwn={message.authorId === props.participantId}
          isPending={props.pendingCorrections.includes(message.id)}
          key={message.id}
          message={message}
          participantId={props.participantId}
          onAddReaction={(emoji) => props.onAddReaction(message.id, emoji)}
          onAnalyze={props.onAnalyze}
          onRemoveReaction={(emoji) => props.onRemoveReaction(message.id, emoji)}
        />
      ))}
      {props.typingNames.length > 0 ? <p className="message-list__typing">{formatTyping(props.typingNames)}</p> : null}
    </section>
  )
}

function formatTyping(names: string[]) {
  return `${names.join(', ')} ${names.length > 1 ? 'estao' : 'esta'} digitando...`
}