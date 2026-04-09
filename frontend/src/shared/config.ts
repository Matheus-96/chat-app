const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''
const wsFallback = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

export const apiUrl = apiBaseUrl
export const wsUrl = import.meta.env.VITE_WS_URL ?? wsFallback

export function buildRoomLink(roomCode: string) {
  return `${window.location.origin}/room/${roomCode}`
}