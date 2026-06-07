import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  maybeNotifyMessage,
  notifyNewMessage,
  playNotificationTone,
  requestNotificationPermission,
} from '../notifications'

type NotificationMock = ReturnType<typeof vi.fn> & {
  permission: NotificationPermission
  requestPermission: ReturnType<typeof vi.fn>
}

function makeFreshNotification(): NotificationMock {
  const mock = vi.fn() as unknown as NotificationMock
  Object.defineProperty(mock, 'permission', { value: 'default', writable: true, configurable: true })
  mock.requestPermission = vi.fn().mockResolvedValue('granted')
  return mock
}

function makeFreshAudioContext() {
  return vi.fn().mockImplementation(function() {
    return {
      currentTime: 0,
      destination: {},
      createOscillator: vi.fn().mockReturnValue({
        type: '' as OscillatorType,
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
  })
}

function notification(): NotificationMock {
  return window.Notification as unknown as NotificationMock
}

beforeEach(() => {
  vi.stubGlobal('Notification', makeFreshNotification())
  vi.stubGlobal('AudioContext', makeFreshAudioContext())
  Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true })
})

afterEach(() => {
  vi.clearAllMocks()
})

// ─── requestNotificationPermission ──────────────────────────────────────────

describe('requestNotificationPermission', () => {
  it('skips if Notification is not in window', async () => {
    Reflect.deleteProperty(window, 'Notification')
    await expect(requestNotificationPermission()).resolves.toBeUndefined()
  })

  it('skips if permission is already granted', async () => {
    notification().permission = 'granted'
    await requestNotificationPermission()
    expect(notification().requestPermission).not.toHaveBeenCalled()
  })

  it('skips if permission is denied', async () => {
    notification().permission = 'denied'
    await requestNotificationPermission()
    expect(notification().requestPermission).not.toHaveBeenCalled()
  })

  it('calls requestPermission when permission is default', async () => {
    notification().permission = 'default'
    await requestNotificationPermission()
    expect(notification().requestPermission).toHaveBeenCalledOnce()
  })
})

// ─── notifyNewMessage ────────────────────────────────────────────────────────

describe('notifyNewMessage', () => {
  it('skips if document.hidden is false', () => {
    Object.defineProperty(document, 'hidden', { value: false, writable: true, configurable: true })
    notification().permission = 'granted'
    notifyNewMessage('Alice', 'Hello')
    expect(notification()).not.toHaveBeenCalled()
  })

  it('skips if Notification is not available', () => {
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })
    Reflect.deleteProperty(window, 'Notification')
    expect(() => notifyNewMessage('Alice', 'Hello')).not.toThrow()
  })

  it('skips if permission is not granted', () => {
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })
    notification().permission = 'default'
    notifyNewMessage('Alice', 'Hello')
    expect(notification()).not.toHaveBeenCalled()
  })

  it('creates Notification when document is hidden and permission is granted', () => {
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })
    notification().permission = 'granted'
    notifyNewMessage('Alice', 'Hello world')
    expect(notification()).toHaveBeenCalledWith('Alice', { body: 'Hello world' })
  })
})

// ─── playNotificationTone ────────────────────────────────────────────────────

describe('playNotificationTone', () => {
  it('returns silently if AudioContext is not available', () => {
    Reflect.deleteProperty(window, 'AudioContext')
    expect(() => playNotificationTone()).not.toThrow()
  })

  it('configures oscillator with correct type, frequency and gain', () => {
    const mockStop = vi.fn()
    const mockStart = vi.fn()
    const mockOscConnect = vi.fn()
    const mockGainConnect = vi.fn()
    const destination = {}
    const mockOscillator = {
      type: '' as OscillatorType,
      frequency: { value: 0 },
      connect: mockOscConnect,
      start: mockStart,
      stop: mockStop,
    }
    const mockGainNode = { gain: { value: 0 }, connect: mockGainConnect }
    const mockCtx = {
      currentTime: 0,
      destination,
      createOscillator: vi.fn().mockReturnValue(mockOscillator),
      createGain: vi.fn().mockReturnValue(mockGainNode),
    }
    vi.stubGlobal('AudioContext', vi.fn().mockImplementation(function() { return mockCtx }))

    playNotificationTone()

    expect(mockOscillator.type).toBe('triangle')
    expect(mockOscillator.frequency.value).toBe(660)
    expect(mockGainNode.gain.value).toBe(0.025)
    expect(mockOscConnect).toHaveBeenCalledWith(mockGainNode)
    expect(mockGainConnect).toHaveBeenCalledWith(destination)
    expect(mockStart).toHaveBeenCalled()
    expect(mockStop).toHaveBeenCalled()
  })
})

// ─── maybeNotifyMessage ──────────────────────────────────────────────────────

describe('maybeNotifyMessage', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'hidden', { value: true, writable: true, configurable: true })
    notification().permission = 'granted'
  })

  it('does not notify if authorId equals currentParticipantId', () => {
    maybeNotifyMessage(
      { authorId: 'p1', role: 'user', authorName: 'Alice', content: 'Hi' },
      'p1',
    )
    expect(notification()).not.toHaveBeenCalled()
    expect(window.AudioContext as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it('does not notify if role is assistant', () => {
    maybeNotifyMessage(
      { authorId: 'p2', role: 'assistant', authorName: 'Coach', content: 'Good job' },
      'p1',
    )
    expect(notification()).not.toHaveBeenCalled()
    expect(window.AudioContext as unknown as ReturnType<typeof vi.fn>).not.toHaveBeenCalled()
  })

  it('notifies with tone and browser notification for message from another participant', () => {
    maybeNotifyMessage(
      { authorId: 'p2', role: 'user', authorName: 'Bob', content: 'Hello there' },
      'p1',
    )
    expect(window.AudioContext as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalled()
    expect(notification()).toHaveBeenCalledWith('Bob', { body: 'Hello there' })
  })
})
