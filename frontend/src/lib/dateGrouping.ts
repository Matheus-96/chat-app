export interface MessageGroup {
  label: string
  messageIds: string[]
}

export function groupMessagesByDate(messageIds: string[], getMessageDate: (id: string) => Date): MessageGroup[] {
  if (messageIds.length === 0) return []

  const groups: MessageGroup[] = []
  let currentDate: string | null = null
  let currentGroup: MessageGroup | null = null

  for (const id of messageIds) {
    const date = getMessageDate(id)
    const dateStr = formatDateKey(date)

    if (dateStr !== currentDate) {
      if (currentGroup) {
        groups.push(currentGroup)
      }
      currentDate = dateStr
      currentGroup = {
        label: formatDateLabel(date),
        messageIds: [id],
      }
    } else if (currentGroup) {
      currentGroup.messageIds.push(id)
    }
  }

  if (currentGroup) {
    groups.push(currentGroup)
  }

  return groups
}

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDateLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const dateStr = formatDateKey(date)
  const todayStr = formatDateKey(today)
  const yesterdayStr = formatDateKey(yesterday)

  if (dateStr === todayStr) return 'HOJE'
  if (dateStr === yesterdayStr) return 'ONTEM'

  const day = date.getDate().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}
