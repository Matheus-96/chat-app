import { Router } from 'express';
import reactionsRouter from './reactions';

const router = Router();

// Mount reactions under messages path
router.use('/api/messages', reactionsRouter);

export default router;
