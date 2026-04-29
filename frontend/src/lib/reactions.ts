// Reactions data structures shared between frontend and backend

/**
 * Emoji enum representing the curated set of allowed reactions.
 * Add or remove emojis here to change the available reactions.
 */
export enum Emoji {
  // 👍 Like
  Like = "👍",
  // ❤️ Love
  Love = "❤️",
  // 😂 Laugh
  Laugh = "😂",
  // 😢 Sad
  Sad = "😢",
}

/**
 * Reaction represents a single emoji reaction from a participant to a message.
 * The system enforces a one‑reaction‑per‑user‑per‑message rule elsewhere.
 */
export interface Reaction {
  /** Unique identifier of the participant who reacted */
  userId: string;
  /** Identifier of the message being reacted to */
  messageId: string;
  /** The emoji chosen from the {@link Emoji} set */
  emoji: Emoji;
}

/**
 * Utility type for aggregating reaction counts per emoji.
 * Example: { [Emoji.Like]: 3, [Emoji.Love]: 1 }
 */
export type ReactionCounts = Record<Emoji, number>;
