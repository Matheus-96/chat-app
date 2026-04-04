export interface RoomMeta {
  id: string
  createdAt: string
  expiresAt: string
  participantCount: number
  messageCount: number
}

export interface ParticipantPresence {
  participantId: string
  name: string
  connectedAt: string
}

export interface RoomMessage {
  id: string
  roomId: string
  role: 'user' | 'assistant'
  authorId: string
  authorName: string
  content: string
  explanation?: string
  replyToMessageId?: string
  createdAt: string
  visibility: 'public' | 'private'
  visibleToParticipantId?: string
  analysisMode?: 'standard' | 'rewrite'
}

export interface StoredProfile {
  name: string
  apiKey: string
}

export type CoachMode = 'automatic' | 'manual' | 'rewrite'