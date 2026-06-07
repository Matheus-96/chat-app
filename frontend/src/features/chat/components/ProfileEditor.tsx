import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const MAX_INSTRUCTIONS = 250
const INSTRUCTIONS_ALERT_THRESHOLD = 20

interface ProfileEditorProps {
  name: string
  customInstructions: string
  onSave: (profile: { name: string; customInstructions: string }) => void
  onCancel: () => void
}

export function ProfileEditor({ name, customInstructions, onSave, onCancel }: ProfileEditorProps) {
  const [editName, setEditName] = useState(name)
  const [editInstructions, setEditInstructions] = useState(customInstructions)

  const remaining = MAX_INSTRUCTIONS - editInstructions.length
  const overLimit = remaining < 0
  const nearLimit = remaining <= INSTRUCTIONS_ALERT_THRESHOLD && !overLimit

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (overLimit || !editName.trim()) return
    onSave({ name: editName.trim(), customInstructions: editInstructions })
  }

  return (
    <form className="profile-editor" onSubmit={handleSubmit}>
      <label className="space-y-1">
        <span className="profile-editor__label">Nome</span>
        <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Seu nome" />
      </label>
      <label className="space-y-1">
        <span className="profile-editor__label">Instrucoes do coach</span>
        <textarea
          className="profile-editor__instructions"
          value={editInstructions}
          onChange={(e) => setEditInstructions(e.target.value)}
          rows={3}
          placeholder="Ex: foque em erros de preposicao..."
        />
        <span className={overLimit ? 'profile-editor__counter--over' : nearLimit ? 'profile-editor__counter--near' : 'profile-editor__counter'}>
          {remaining} restantes
        </span>
      </label>
      <div className="profile-editor__actions">
        <Button type="submit" disabled={overLimit || !editName.trim()}>Salvar</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  )
}
