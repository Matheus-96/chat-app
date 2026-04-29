// Reaction model for backend (shared definitions)

/**
 * Emoji enum mirroring the frontend set of allowed reactions.
 */
export enum Emoji {
  Like = "👍",
  Love = "❤️",
  Laugh = "😂",
  Sad = "😢",
}

/**
 * Reaction entity stored in the backend.
 * Represents a participant's reaction to a specific message.
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
