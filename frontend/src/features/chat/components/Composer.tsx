import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import type { AgentMode } from '../../../shared/ws/protocol'
import './Composer.css'

interface ComposerProps {
  agentMode: AgentMode
  customInstructionsValid: boolean
  disabled: boolean
  hasApiKey: boolean
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

  const isDisabled = props.disabled || !props.hasApiKey || !props.customInstructionsValid

  return (
    <footer className="composer">
      {!props.hasApiKey && <p className="composer__notice">Configure uma API Key na sidebar para usar o coach.</p>}
      <Textarea
        disabled={isDisabled}
        maxLength={800}
        onBlur={() => props.onTyping(false)}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escreva sua mensagem em ingles..."
        rows={1}
        value={value}
      />
      <div className="composer__meta">
        <span>{props.agentMode === 'manual' ? 'Enter envia · Ctrl+Enter envia com análise' : 'Análise automática ativada'}</span>
        <Button disabled={isDisabled} onClick={() => submit(props.agentMode === 'manual' ? false : undefined)}>
          Enviar
        </Button>
      </div>
    </footer>
  )
}