// Reaction model for backend (shared definitions)

/**
 * Emoji enum mirroring the frontend set of allowed reactions.
 */
export enum Emoji {
  THUMBS_UP = '👍',
  THUMBS_DOWN = '👎',
  LAUGH = '😂',
  HEART = '❤️',
}

/**
 * Reaction entity stored in the backend.
 * Represents a participant's reaction to a specific message.
 * Note: Each participant may have at most one reaction per message.
 */
export interface Reaction {
  /** Unique identifier of the participant */
  userId: string;
  /** Identifier of the chat message */
  messageId: string;
  /** Chosen emoji */
  emoji: Emoji;
}

/**
 * Aggregated counts of reactions per emoji for a message.
 */
export type ReactionCounts = Record<Emoji, number>;

// Types are exported directly above; no need for re-export.

