import { Router } from 'express'
import { authenticateUser, requireAuth } from '../middleware/auth.js'
import * as fileController from './fileController.js'

const router = Router()

router.use(authenticateUser)
router.use(requireAuth)

router.get('/download/:storedName', fileController.downloadFile)

export default router
