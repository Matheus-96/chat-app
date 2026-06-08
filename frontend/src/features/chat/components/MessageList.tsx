import { useEffect, useRef } from 'react'
import { groupMessagesByDate } from '../../../lib/dateGrouping'
import type { AgentMode, RoomMessage } from '../../../shared/ws/protocol'
import { AutomaticModeChip } from './AutomaticModeChip'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'
import './MessageList.css'

interface MessageListProps {
  agentMode: AgentMode
  messages: RoomMessage[]
  participantId: string
  pendingCorrections: string[]
  typingNames: string[]
  onAddReaction: (messageId: string, emoji: string) => void
  onAnalyze: (messageId: string, mode?: 'normal' | 'chunking') => void
  onRemoveReaction: (messageId: string, emoji: string) => void
}

export function MessageList(props: MessageListProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const replies = new Map(props.messages.filter((message) => message.role === 'assistant' && message.replyToMessageId).map((message) => [message.replyToMessageId!, message]))
  const roots = props.messages.filter((message) => message.role === 'user')

  useEffect(() => {
    containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
  }, [props.messages, props.typingNames])

  const messageGroups = groupMessagesByDate(
    roots.map((m) => m.id),
    (id) => new Date(roots.find((m) => m.id === id)?.createdAt || new Date().toISOString())
  )
  const messageMap = new Map(roots.map((m) => [m.id, m]))

  return (
    <section className="message-list" ref={containerRef}>
      {roots.length === 0 ? <div className="message-list__empty">Crie a primeira mensagem da sala para iniciar a conversa.</div> : null}
      {messageGroups.map((group, idx) => (
        <>
          {idx > 0 && <div key={`separator-${group.label}`} className="message-list__date-separator">{group.label}</div>}
          {idx === 0 && <div key={`first-separator-${group.label}`} className="message-list__date-separator">{group.label}</div>}
          {group.messageIds.map((messageId) => {
            const message = messageMap.get(messageId)
            if (!message) return null
            return (
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
            )
          })}
        </>
      ))}
      {props.typingNames.length > 0 ? <TypingIndicator names={props.typingNames} /> : null}
      <AutomaticModeChip agentMode={props.agentMode} />
    </section>
  )
}

