import { Router, Request, Response } from 'express';
import { Reaction, Emoji, ReactionCounts } from '../models/reaction';
import logger from '../utils/logger';

// In-memory store for demo purposes; replace with DB in production
const reactionsStore: Reaction[] = [];

const router = Router();

// Helper to count reactions for a message
function getCounts(messageId: string): ReactionCounts {
  const counts: ReactionCounts = {
    [Emoji.THUMBS_UP]: 0,
    [Emoji.THUMBS_DOWN]: 0,
    [Emoji.LAUGH]: 0,
    [Emoji.HEART]: 0,
  };
  reactionsStore
    .filter(r => r.messageId === messageId)
    .forEach(r => {
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    });
  return counts;
}

// GET reactions for a message
router.get('/:id/reactions', (req: Request, res: Response) => {
  const { id: messageId } = req.params;
  const counts = getCounts(messageId);
  res.json({ messageId, counts });
});

// POST a reaction
router.post('/:id/reactions', (req: Request, res: Response) => {
  const { id: messageId } = req.params;
  const { userId, emoji } = req.body as Partial<Reaction>;

  if (!userId || !emoji) {
    return res.status(400).json({ error: 'userId and emoji are required' });
  }
  if (!Object.values(Emoji).includes(emoji as Emoji)) {
    return res.status(400).json({ error: 'Invalid emoji' });
  }
  // enforce one reaction per user per message
  const existing = reactionsStore.find(r => r.messageId === messageId && r.userId === userId);
  if (existing) {
    return res.status(409).json({ error: 'User already reacted to this message' });
  }
  const reaction: Reaction = { userId, messageId, emoji: emoji as Emoji };
  reactionsStore.push(reaction);
  logger.info(`Reaction added: ${JSON.stringify(reaction)}`);
  res.status(201).json(reaction);
});

// DELETE a reaction
router.delete('/:id/reactions', (req: Request, res: Response) => {
  const { id: messageId } = req.params;
  const { userId } = req.body as Partial<Reaction>;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const index = reactionsStore.findIndex(r => r.messageId === messageId && r.userId === userId);
  if (index === -1) {
    return res.status(404).json({ error: 'Reaction not found' });
  }
  const [removed] = reactionsStore.splice(index, 1);
  logger.info(`Reaction removed: ${JSON.stringify(removed)}`);
  res.json(removed);
});

export default router;
