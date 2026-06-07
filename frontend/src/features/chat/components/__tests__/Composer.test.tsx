import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Composer } from '../Composer'

function renderComposer(hasApiKey: boolean, disabled = false) {
  return render(
    <Composer
      agentMode="manual"
      disabled={disabled}
      hasApiKey={hasApiKey}
      onSend={vi.fn()}
      onTyping={vi.fn()}
    />
  )
}

describe('Composer — API key blocking', () => {
  it('renders notice when hasApiKey is false', () => {
    renderComposer(false)
    expect(screen.getByText(/Configure uma API Key/i)).toBeInTheDocument()
  })

  it('disables textarea when hasApiKey is false', () => {
    renderComposer(false)
    expect(screen.getByRole('textbox')).toBeDisabled()
  })

  it('disables send button when hasApiKey is false', () => {
    renderComposer(false)
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('does not render notice when hasApiKey is true', () => {
    renderComposer(true)
    expect(screen.queryByText(/Configure uma API Key/i)).not.toBeInTheDocument()
  })

  it('textarea is enabled when hasApiKey is true and not disabled', () => {
    renderComposer(true)
    expect(screen.getByRole('textbox')).not.toBeDisabled()
  })
})
