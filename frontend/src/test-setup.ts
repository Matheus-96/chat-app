import '@testing-library/jest-dom'
import { vi } from 'vitest'

vi.stubGlobal('AudioContext', vi.fn().mockImplementation(function() {
  return {
    currentTime: 0,
    destination: {},
    createOscillator: vi.fn().mockReturnValue({
      type: '',
      frequency: { value: 0 },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    }),
    createGain: vi.fn().mockReturnValue({
      gain: { value: 0 },
      connect: vi.fn(),
    }),
  }
}))

const NotificationStub = vi.fn()
Object.defineProperty(NotificationStub, 'permission', { value: 'default', writable: true, configurable: true })
NotificationStub.requestPermission = vi.fn().mockResolvedValue('granted')
vi.stubGlobal('Notification', NotificationStub)
