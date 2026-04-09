import type { AgentMode } from '../ws/protocol'

const nameKey = 'chat.profile.name'
const apiKeyKey = 'chat.profile.apiKey'
const agentModeKey = 'chat.profile.agentMode'
const participantKey = 'chat.session.participantId'

export interface StoredProfile {
  name: string
  apiKey: string
  participantId: string
}

export function loadStoredProfile(): StoredProfile {
  return {
    name: localStorage.getItem(nameKey) ?? '',
    apiKey: localStorage.getItem(apiKeyKey) ?? '',
    participantId: getParticipantId(),
  }
}

export function saveProfile(profile: Omit<StoredProfile, 'participantId'>) {
  localStorage.setItem(nameKey, profile.name.trim())
  localStorage.setItem(apiKeyKey, profile.apiKey.trim())
}

export function loadStoredAgentMode(): AgentMode {
  return localStorage.getItem(agentModeKey) === 'manual' ? 'manual' : 'automatic'
}

export function saveStoredAgentMode(agentMode: AgentMode) {
  localStorage.setItem(agentModeKey, agentMode)
}

function getParticipantId() {
  const saved = sessionStorage.getItem(participantKey)

  if (saved) {
    return saved
  }

  const participantId = crypto.randomUUID()
  sessionStorage.setItem(participantKey, participantId)
  return participantId
}