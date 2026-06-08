import { describe, it, expect } from 'vitest'
import { computeDiff } from '../diff'

describe('computeDiff', () => {
  it('retorna string inteira com changed: false quando strings são iguais', () => {
    const result = computeDiff('Hello world', 'Hello world')
    expect(result).toEqual([{ text: 'Hello world', changed: false }])
  })

  it('marca tokens alterados com changed: true em substituição simples', () => {
    const result = computeDiff('quick', 'slow')
    const changedTokens = result.filter((t) => t.changed)
    expect(changedTokens.length).toBeGreaterThan(0)
  })

  it('marca adição de caracteres como changed: true', () => {
    const result = computeDiff('world', 'beautiful world')
    const allText = result.map((t) => t.text).join('')
    expect(allText).toBe('beautiful world')
    expect(result.some((t) => t.changed)).toBe(true)
  })

  it('retorna apenas texto corrigido quando removido algo', () => {
    const result = computeDiff('beautiful world', 'world')
    const allText = result.map((t) => t.text).join('')
    expect(allText).toBe('world')
    expect(allText).not.toContain('beautiful')
  })

  it('preserva partes iguais com changed: false', () => {
    const result = computeDiff('The quick brown fox', 'The slow brown fox')
    const unchangedTokens = result.filter((t) => !t.changed)
    const unchangedText = unchangedTokens.map((t) => t.text).join('')
    expect(unchangedText).toContain('The ')
    expect(unchangedText).toContain('brown')
  })
})
