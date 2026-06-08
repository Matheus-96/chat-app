import './TypingIndicator.css'

interface TypingIndicatorProps {
  names: string[]
}

export function TypingIndicator({ names }: TypingIndicatorProps) {
  if (names.length === 0) return null

  const displayNames = names.length === 1 ? names[0] : names.slice(0, 2).join(' e ')
  const verb = names.length === 1 ? 'está' : 'estão'

  return (
    <article className="typing-indicator">
      <div className="typing-indicator__bubble">
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
        <span className="typing-indicator__dot" />
      </div>
      <p className="typing-indicator__text">
        {displayNames} {verb} digitando...
      </p>
    </article>
  )
}
