import { Router } from 'express'
import * as membershipController from '../controllers/membershipController.js'

const router = Router()

// ── Read endpoints ───────────────────────────────────────────────────────────
// List official club members for appointment picker
router.get('/members', membershipController.listMembers)

// List panel roster for a specific panel term
router.get('/panel-memberships/term/:termId', membershipController.getByTerm)

// List full chronological history for a specific member across all terms
router.get('/panel-memberships/member/:memberId', membershipController.getHistoryByMember)

// Get single panel membership details
router.get('/panel-memberships/:id', membershipController.getById)

// ── Mutation endpoints ───────────────────────────────────────────────────────
// TODO: RBAC - protect with auth & role middleware (e.g. requireRole(['ADMIN', 'EXECUTIVE_LEAD']))
router.post('/panel-memberships', membershipController.assign)

// TODO: RBAC - protect with auth & role middleware
router.patch('/panel-memberships/:id/end', membershipController.endMembership)

// TODO: RBAC - protect with auth & role middleware
router.patch('/panel-memberships/:id/void', membershipController.voidMembership)

export default router
