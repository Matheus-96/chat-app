import { create } from 'zustand'
import type { AgentMode, ConnectionStatus, ParticipantPresence, RoomMessage, ServerEvent } from '../shared/ws/protocol'

type SnapshotEvent = Extract<ServerEvent, { type: 'room_snapshot' }>
type ParticipantUpdateEvent = Extract<ServerEvent, { type: 'participant_update' }>

export interface RoomState {
  roomId: string
  roomCode: string
  expiresAt: string
  participantId: string
  participants: ParticipantPresence[]
  messages: RoomMessage[]
  typing: Record<string, string>
  pendingCorrections: string[]
  agentMode: AgentMode
  connection: ConnectionStatus
  expired: boolean
  error: string | null
}

interface RoomActions {
  applySnapshot: (event: SnapshotEvent) => void
  applyParticipantUpdate: (event: ParticipantUpdateEvent) => void
  addMessage: (message: RoomMessage) => void
  setTyping: (participantId: string, name: string, isTyping: boolean) => void
  addPendingCorrection: (messageId: string) => void
  removePendingCorrection: (messageId: string) => void
  updateReactions: (messageId: string, reactions: Record<string, string[]>) => void
  setConnection: (status: ConnectionStatus) => void
  markExpired: () => void
  setAgentMode: (agentMode: AgentMode) => void
  setError: (message: string | null) => void
}

export type RoomStore = RoomState & RoomActions

export const INITIAL_STATE: RoomState = {
  roomId: '', roomCode: '', expiresAt: '', participantId: '',
  participants: [], messages: [], typing: {}, pendingCorrections: [],
  agentMode: 'manual', connection: 'connecting', expired: false, error: null,
}

function resolveAgentMode(participants: ParticipantPresence[], participantId: string, fallback: AgentMode): AgentMode {
  return participants.find((p) => p.participantId === participantId)?.agentMode ?? fallback
}

export const useRoomStore = create<RoomStore>((set, get) => ({
  ...INITIAL_STATE,

  applySnapshot: (event) => set({
    roomId: event.roomId, roomCode: event.roomCode, expiresAt: event.expiresAt,
    participantId: event.participantId, participants: event.participants,
    messages: event.messages, pendingCorrections: [], expired: false, error: null,
    agentMode: resolveAgentMode(event.participants, event.participantId, get().agentMode),
  }),

  applyParticipantUpdate: (event) => set((s) => ({
    participants: event.participants,
    agentMode: resolveAgentMode(event.participants, s.participantId, s.agentMode),
  })),

  addMessage: (message) => set((s) => {
    if (s.messages.some((m) => m.id === message.id)) return {}
    return {
      messages: [...s.messages, message],
      pendingCorrections: message.replyToMessageId
        ? s.pendingCorrections.filter((id) => id !== message.replyToMessageId)
        : s.pendingCorrections,
    }
  }),

  setTyping: (participantId, name, isTyping) => set((s) => {
    const typing = { ...s.typing }
    if (isTyping) { typing[participantId] = name } else { delete typing[participantId] }
    return { typing }
  }),

  addPendingCorrection: (messageId) => set((s) =>
    s.pendingCorrections.includes(messageId) ? {} : { pendingCorrections: [...s.pendingCorrections, messageId] }
  ),

  removePendingCorrection: (messageId) => set((s) => ({
    pendingCorrections: s.pendingCorrections.filter((id) => id !== messageId),
  })),

  updateReactions: (messageId, reactions) => set((s) => ({
    messages: s.messages.map((m) => m.id === messageId ? { ...m, reactions } : m),
  })),

  setConnection: (status) => set({ connection: status }),
  markExpired: () => set({ expired: true }),
  setAgentMode: (agentMode) => set({ agentMode }),
  setError: (error) => set({ error }),
}))
