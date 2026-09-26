import { Router } from 'express'
import * as panelTermController from '../controllers/panelTermController.js'
import * as positionController from '../controllers/positionController.js'
import * as teamController from '../controllers/teamController.js'

const router = Router()

// ── Panel Terms ─────────────────────────────────────────────────────────────
router.get('/panel-terms', panelTermController.getAll)
router.get('/panel-terms/:id', panelTermController.getById)

// TODO: RBAC - protect with auth & role middleware (e.g. requireRole(['ADMIN', 'EXECUTIVE_LEAD']))
router.post('/panel-terms', panelTermController.create)
// TODO: RBAC - protect with auth & role middleware
router.patch('/panel-terms/:id', panelTermController.update)
// TODO: RBAC - protect with auth & role middleware
router.patch('/panel-terms/:id/archive', panelTermController.archive)

// ── Positions ───────────────────────────────────────────────────────────────
router.get('/positions', positionController.getAll)
router.get('/positions/:id', positionController.getById)

// TODO: RBAC - protect with auth & role middleware
router.post('/positions', positionController.create)
// TODO: RBAC - protect with auth & role middleware
router.patch('/positions/:id', positionController.update)
// TODO: RBAC - protect with auth & role middleware
router.patch('/positions/:id/status', positionController.setStatus)

// ── Teams ───────────────────────────────────────────────────────────────────
router.get('/teams', teamController.getAll)
router.get('/teams/:id', teamController.getById)

// TODO: RBAC - protect with auth & role middleware
router.post('/teams', teamController.create)
// TODO: RBAC - protect with auth & role middleware
router.patch('/teams/:id', teamController.update)
// TODO: RBAC - protect with auth & role middleware
router.patch('/teams/:id/status', teamController.setStatus)

export default router
