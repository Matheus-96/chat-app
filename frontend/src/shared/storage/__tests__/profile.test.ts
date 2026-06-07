import { beforeEach, describe, expect, it } from 'vitest'
import { loadStoredProfile, saveProfile, getParticipantId } from '../profile'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('getParticipantId', () => {
  it('generates a UUID on first call', () => {
    const id = getParticipantId()
    expect(id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('returns the same ID on subsequent calls within the same session', () => {
    const first = getParticipantId()
    const second = getParticipantId()
    expect(first).toBe(second)
  })
})

describe('saveProfile / loadStoredProfile roundtrip', () => {
  it('persists and restores name, apiKey and customInstructions', () => {
    saveProfile({ name: 'Alice', apiKey: 'sk-key-123', customInstructions: 'foque em preposicoes' })
    const loaded = loadStoredProfile()
    expect(loaded.name).toBe('Alice')
    expect(loaded.apiKey).toBe('sk-key-123')
    expect(loaded.customInstructions).toBe('foque em preposicoes')
  })

  it('trims name and apiKey on save', () => {
    saveProfile({ name: '  Bob  ', apiKey: '  sk-key  ', customInstructions: '' })
    const loaded = loadStoredProfile()
    expect(loaded.name).toBe('Bob')
    expect(loaded.apiKey).toBe('sk-key')
  })
})

describe('backward compatibility', () => {
  it('returns empty string for customInstructions when key is absent in localStorage', () => {
    localStorage.setItem('chat.profile.name', 'Alice')
    localStorage.setItem('chat.profile.apiKey', 'sk-key')
    // customInstructions key not set
    const loaded = loadStoredProfile()
    expect(loaded.customInstructions).toBe('')
  })
})
