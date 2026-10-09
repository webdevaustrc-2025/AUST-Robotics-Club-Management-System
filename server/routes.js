import { Router } from 'express'
import { createTaskRouter } from '../administration/backend/routes/taskRoutes.js'

const router = Router()

router.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// D2: Administration Tasks Router with 501 Placeholder until Shared Features delivers authenticators
const authPlaceholder = (req, res, next) => {
  res.status(501).json({
    error: {
      code: 'AUTH_NOT_CONFIGURED',
      message: 'Authentication middleware not yet configured by Shared Features',
    },
  })
}

const requirePermissionPlaceholder = (code) => (req, res, next) => {
  res.status(501).json({
    error: {
      code: 'AUTH_NOT_CONFIGURED',
      message: `Permission middleware for "${code}" not yet configured by Shared Features`,
    },
  })
}

router.use(
  '/administration/tasks',
  createTaskRouter({
    authenticate: authPlaceholder,
    requirePermission: requirePermissionPlaceholder,
  })
)

export default router

