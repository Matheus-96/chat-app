export function formatRemainingTime(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'expirada'
  const totalMinutes = Math.floor(diff / 60_000)
  if (totalMinutes < 1) return 'menos de 1min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0) return `${hours}h ${minutes}min`
  return `${minutes}min`
}
