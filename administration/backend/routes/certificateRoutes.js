import { Router } from 'express'
import * as certificateController from '../controllers/certificateController.js'

const router = Router()

// ── Read endpoints (no auth required for now) ────────────────────────────────

// List all certificate records for a panel term (+ memberships without one)
router.get('/certificates/term/:termId', certificateController.getByTerm)

// List all certificate records for a specific member
router.get('/certificates/member/:memberId', certificateController.getByMember)

// Get a single certificate record by its primary key
router.get('/certificates/:id', certificateController.getById)

// ── Mutation endpoints ───────────────────────────────────────────────────────

// Create a certificate record from a panel_membership_id
// (snapshots captured at creation time; no file/document generated here)
// TODO: RBAC - protect with auth & role middleware (e.g. requireRole(['ADMIN', 'EXECUTIVE_LEAD']))
router.post('/certificates', certificateController.create)

// Advance certificate status: PENDING → ISSUED → AVAILABLE → DELIVERED
// TODO: RBAC - protect with auth & role middleware (e.g. requireRole(['ADMIN', 'EXECUTIVE_LEAD']))
router.patch('/certificates/:id/status', certificateController.updateStatus)

export default router
