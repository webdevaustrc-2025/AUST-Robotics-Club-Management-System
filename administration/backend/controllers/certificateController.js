/**
 * Certificate Controller — adm_member_certificates
 *
 * Follows the exact controller pattern established in Task 4/5:
 *   - thin try/catch wrapper
 *   - delegates all logic to the service layer
 *   - consistent error shape: { error, details }
 *   - consistent success shape: { data } or { data, message }
 */

import * as certificateService from '../services/certificateService.js'

/**
 * GET /administration/certificates/:id
 * Get a single certificate record by its primary key.
 */
export async function getById(req, res) {
  try {
    const { id } = req.params
    const data = await certificateService.getCertificateById(id)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve certificate record.',
      details: err.details,
    })
  }
}

/**
 * GET /administration/certificates/term/:termId
 * List all certificate records for a panel term, plus memberships without one.
 */
export async function getByTerm(req, res) {
  try {
    const { termId } = req.params
    const data = await certificateService.getCertificatesByTerm(termId)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve certificates for term.',
      details: err.details,
    })
  }
}

/**
 * GET /administration/certificates/member/:memberId
 * List all certificate records for a specific member across all terms.
 */
export async function getByMember(req, res) {
  try {
    const { memberId } = req.params
    const data = await certificateService.getCertificatesByMember(memberId)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve certificate history for member.',
      details: err.details,
    })
  }
}

/**
 * POST /administration/certificates
 * Create a certificate record for a given panel_membership_id.
 * Snapshot fields are captured at creation time inside the service layer.
 *
 * // TODO: Shared/Core auth/RBAC integration point
 * //        This endpoint should be protected: only ADMIN or EXECUTIVE_LEAD roles
 * //        may create certificate records. Add requireAuth + requireRole middleware
 * //        when the Shared/Core auth system is implemented.
 */
export async function create(req, res) {
  try {
    const data = await certificateService.createCertificate(req.body)
    return res.status(201).json({
      data,
      message: 'Certificate record created successfully. Snapshot captured.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to create certificate record.',
      details: err.details,
    })
  }
}

/**
 * PATCH /administration/certificates/:id/status
 * Advance a certificate's status along the approved progression:
 *   PENDING → ISSUED → AVAILABLE → DELIVERED
 *
 * // TODO: Shared/Core auth/RBAC integration point
 * //        This endpoint should be protected: only ADMIN or EXECUTIVE_LEAD roles
 * //        may update certificate status. Add requireAuth + requireRole middleware
 * //        when the Shared/Core auth system is implemented.
 */
export async function updateStatus(req, res) {
  try {
    const { id } = req.params
    const data = await certificateService.updateCertificateStatus(id, req.body)
    return res.status(200).json({
      data,
      message: `Certificate status updated to ${data.status}.`,
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to update certificate status.',
      details: err.details,
    })
  }
}
