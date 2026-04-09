import { useEffect, useRef, useState } from 'react'
import type { AgentMode } from '../../../shared/ws/protocol'
import './Composer.css'

interface ComposerProps {
  agentMode: AgentMode
  disabled: boolean
  onSend: (content: string, analyze?: boolean) => void
  onTyping: (isTyping: boolean) => void
}

export function Composer(props: ComposerProps) {
  const [value, setValue] = useState('')
  const typingTimer = useRef<number | null>(null)

  useEffect(() => () => {
    if (typingTimer.current !== null) {
      window.clearTimeout(typingTimer.current)
    }
  }, [])

  function submit(analyze?: boolean) {
    const content = value.trim()

    if (!content) {
      return
    }

    props.onSend(content, analyze)
    props.onTyping(false)
    setValue('')
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter' || event.shiftKey) {
      return
    }

    event.preventDefault()
    submit(props.agentMode === 'manual' ? event.ctrlKey : undefined)
  }

  function handleChange(nextValue: string) {
    setValue(nextValue)
    props.onTyping(true)
    if (typingTimer.current !== null) {
      window.clearTimeout(typingTimer.current)
    }
    typingTimer.current = window.setTimeout(() => props.onTyping(false), 1200)
  }

  return (
    <footer className="composer">
      <textarea disabled={props.disabled} maxLength={800} onBlur={() => props.onTyping(false)} onChange={(event) => handleChange(event.target.value)} onKeyDown={handleKeyDown} placeholder="Escreva sua mensagem em ingles..." rows={1} value={value} />
      <div className="composer__meta">
        <span>{props.agentMode === 'manual' ? 'Ctrl+Enter envia com analise' : 'Analise automatica ligada'}</span>
        <button disabled={props.disabled} onClick={() => submit(props.agentMode === 'manual' ? false : undefined)} type="button">Enviar</button>
      </div>
    </footer>
  )
}