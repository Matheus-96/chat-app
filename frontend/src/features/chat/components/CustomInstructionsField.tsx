import { Textarea } from '@/components/ui/textarea'
import './CustomInstructionsField.css'

interface Props {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function CustomInstructionsField({ value, onChange, className }: Props) {
  return (
    <div className={`ci-field${className ? ` ${className}` : ''}`}>
      <span className="ci-field__label">Instrucoes do coach</span>
      <Textarea
        value={value}
        maxLength={250}
        rows={2}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ex: foque em erros de preposicao"
      />
      <span className="ci-field__counter">{value.length}/250</span>
    </div>
  )
}
