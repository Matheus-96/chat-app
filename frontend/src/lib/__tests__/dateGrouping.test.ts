import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { groupMessagesByDate } from '../dateGrouping'

describe('groupMessagesByDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-07T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna array vazio para lista vazia', () => {
    const result = groupMessagesByDate([], () => new Date())
    expect(result).toEqual([])
  })

  it('agrupa mensagens do mesmo dia em um único grupo', () => {
    const today = new Date('2026-06-07T10:00:00Z')
    const afternoon = new Date('2026-06-07T15:00:00Z')

    const getDate = (id: string) => (id === 'msg1' ? today : afternoon)

    const result = groupMessagesByDate(['msg1', 'msg2'], getDate)

    expect(result).toHaveLength(1)
    expect(result[0].label).toBe('HOJE')
    expect(result[0].messageIds).toEqual(['msg1', 'msg2'])
  })

  it('cria grupos separados para dias diferentes', () => {
    const yesterday = new Date('2026-06-06T10:00:00Z')
    const today = new Date('2026-06-07T10:00:00Z')

    const getDate = (id: string) => (id === 'msg1' ? yesterday : today)

    const result = groupMessagesByDate(['msg1', 'msg2'], getDate)

    expect(result).toHaveLength(2)
    expect(result[0].label).toBe('ONTEM')
    expect(result[1].label).toBe('HOJE')
  })

  it('formata datas antigas com dd/mm/yyyy', () => {
    const oldDate = new Date('2026-05-01T10:00:00Z')

    const getDate = () => oldDate

    const result = groupMessagesByDate(['msg1'], getDate)

    expect(result[0].label).toBe('01/05/2026')
  })
})
