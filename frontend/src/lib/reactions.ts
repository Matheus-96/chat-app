// Reaction related types shared between frontend and backend

/**
 * Emoji set that can be used for reactions.
 * Extend this enum when new emojis are added to the UI.
 */
export enum Emoji {
  THUMBS_UP = '👍',
  THUMBS_DOWN = '👎',
  LAUGH = '😂',
  HEART = '❤️',
}

/**
 * Represents a reaction from a participant.
 * Each participant may have at most one reaction per message.
 */
export interface Reaction {
  /** Unique identifier of the message being reacted to */
  messageId: string;
  /** User identifier of the participant who reacted */
  userId: string;
  /** The selected emoji */
  emoji: Emoji;
}

/**
 * Aggregated reaction counts for a message.
 */
export interface ReactionSummary {
  /** Message identifier */
  messageId: string;
  /** Map from emoji to count */
  counts: Record<Emoji, number>;
  /** Set of userIds that have reacted (for one-reaction-per-user enforcement) */
  users: Record<string, Emoji>;
}

/**
 * Exported types for both client and server modules.
 */


