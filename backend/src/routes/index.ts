import { Router } from 'express'
import reactionsRouter from './reactions'

const router = Router()
router.use(reactionsRouter)

export default router
