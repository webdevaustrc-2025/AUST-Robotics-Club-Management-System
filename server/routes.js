import { Router } from 'express'
import taskRoutes from '../administration/backend/routes/taskRoutes.js'
import fileRoutes from '../shared-features/backend/files/fileRoutes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

router.use('/files', fileRoutes)
router.use('/administration/tasks', taskRoutes)

export default router

