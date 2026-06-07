import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const MAX_INSTRUCTIONS = 250
const INSTRUCTIONS_ALERT_THRESHOLD = 20

interface ProfileEditorProps {
  name: string
  apiKey: string
  customInstructions: string
  submitLabel: string
  onSave: (profile: { name: string; apiKey: string; customInstructions: string }) => void
  error?: string
  busy?: boolean
  children?: React.ReactNode
}

export function ProfileEditor(props: ProfileEditorProps) {
  const [name, setName] = useState(props.name)
  const [apiKey, setApiKey] = useState(props.apiKey)
  const [instructions, setInstructions] = useState(props.customInstructions)

  const remaining = MAX_INSTRUCTIONS - instructions.length
  const overLimit = remaining < 0
  const nearLimit = remaining <= INSTRUCTIONS_ALERT_THRESHOLD && !overLimit

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (overLimit) return
    props.onSave({ name, apiKey, customInstructions: instructions })
  }

  return (
    <form className="profile-editor" onSubmit={handleSubmit}>
      <label className="space-y-1.5">
        <span>Nome</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Como voce aparece na sala" />
      </label>
      <label className="space-y-1.5">
        <span>API Key OpenRouter</span>
        <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-or-v1-..." />
      </label>
      <label className="space-y-1.5">
        <span>Instrucoes do coach</span>
        <textarea
          className="profile-editor__instructions"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Ex: foque em erros de preposicao, vocabulario B2..."
          rows={3}
        />
        <span className={overLimit ? 'profile-editor__counter--over' : nearLimit ? 'profile-editor__counter--near' : 'profile-editor__counter'}>
          {remaining} caracteres restantes
        </span>
      </label>
      {props.error ? <p className="profile-editor__error">{props.error}</p> : null}
      {props.children}
      <Button type="submit" disabled={overLimit || props.busy}>
        {props.submitLabel}
      </Button>
    </form>
  )
}
