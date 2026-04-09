import { apiUrl } from '../config'

export interface RoomMeta {
  id: string
  roomCode: string
  createdAt: string
  expiresAt: string
  participantCount: number
  messageCount: number
}

interface CreateRoomResponse {
  roomId: string
  roomCode: string
  expiresAt: string
}

async function readJson<T>(response: Response) {
  const payload = await response.json() as T & { message?: string }
  if (!response.ok) {
    throw new Error(payload.message ?? 'Nao foi possivel concluir a requisicao.')
  }
  return payload
}

export async function createRoom() {
  const response = await fetch(`${apiUrl}/api/rooms`, { method: 'POST' })
  return readJson<CreateRoomResponse>(response)
}

export async function fetchRoomByCode(roomCode: string) {
  const response = await fetch(`${apiUrl}/api/rooms/code/${normalizeRoomCode(roomCode)}`)
  return readJson<RoomMeta>(response)
}

export function normalizeRoomCode(value: string) {
  const raw = value.trim()

  try {
    const parsed = new URL(raw)
    return parsed.pathname.split('/').filter(Boolean).at(-1)?.toUpperCase() ?? ''
  } catch {
    return raw.split('/').filter(Boolean).at(-1)?.toUpperCase() ?? ''
  }
}