import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Composer } from '../Composer'
import type { AgentMode } from '../../../../shared/ws/protocol'

function renderComposer(hasApiKey: boolean, agentMode: AgentMode = 'manual', disabled = false, customInstructionsValid = true) {
  const onSend = vi.fn()
  render(
    <Composer
      agentMode={agentMode}
      customInstructionsValid={customInstructionsValid}
      disabled={disabled}
      hasApiKey={hasApiKey}
      onSend={onSend}
      onTyping={vi.fn()}
    />
  )
  return { onSend }
}

describe('Composer — custom instructions blocking', () => {
  it('disables send button when customInstructionsValid is false', () => {
    renderComposer(true, 'manual', false, false)
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled()
  })

  it('enables send button when customInstructionsValid is true and other conditions met', () => {
    renderComposer(true, 'manual', false, true)
    expect(screen.getByRole('button', { name: 'Enviar' })).not.toBeDisabled()
  })
})

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

describe('Composer — hints por modo', () => {
  it('exibe referência a Ctrl+Enter no modo manual', () => {
    renderComposer(true, 'manual')
    expect(screen.getByText(/Ctrl\+Enter/i)).toBeInTheDocument()
  })

  it('exibe hint de análise automática no modo automático', () => {
    renderComposer(true, 'automatic')
    expect(screen.getByText(/Análise automática/i)).toBeInTheDocument()
  })

  it('não exibe hint Ctrl+Enter no modo automático', () => {
    renderComposer(true, 'automatic')
    expect(screen.queryByText(/Ctrl\+Enter/i)).not.toBeInTheDocument()
  })
})

describe('Composer — comportamento de envio por modo', () => {
  it('modo manual + Enter chama onSend sem analyze=true', async () => {
    const user = userEvent.setup()
    const { onSend } = renderComposer(true, 'manual')

    await user.type(screen.getByRole('textbox'), 'hello')
    await user.keyboard('{Enter}')

    expect(onSend).toHaveBeenCalledOnce()
    expect(onSend).not.toHaveBeenCalledWith(expect.anything(), true)
  })

  it('modo manual + Ctrl+Enter chama onSend com analyze=true', async () => {
    const user = userEvent.setup()
    const { onSend } = renderComposer(true, 'manual')

    await user.type(screen.getByRole('textbox'), 'hello')
    await user.keyboard('{Control>}{Enter}{/Control}')

    expect(onSend).toHaveBeenCalledOnce()
    expect(onSend).toHaveBeenCalledWith('hello', true)
  })

  it('modo automático + Enter chama onSend', async () => {
    const user = userEvent.setup()
    const { onSend } = renderComposer(true, 'automatic')

    await user.type(screen.getByRole('textbox'), 'hello')
    await user.keyboard('{Enter}')

    expect(onSend).toHaveBeenCalledOnce()
  })

  it('botão Enviar no modo manual chama onSend sem analyze=true', async () => {
    const user = userEvent.setup()
    const { onSend } = renderComposer(true, 'manual')

    await user.type(screen.getByRole('textbox'), 'hello')
    await user.click(screen.getByRole('button', { name: 'Enviar' }))

    expect(onSend).toHaveBeenCalledOnce()
    expect(onSend).not.toHaveBeenCalledWith(expect.anything(), true)
  })
})
