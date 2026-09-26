/**
 * Certificate Service — adm_member_certificates
 *
 * Orchestrates business logic for Executive Panel certificate records.
 * Delegates data access to certificateRepository.js and reuses
 * membershipRepository.js (Task 5) for membership lookups — no logic
 * is re-derived from scratch.
 *
 * Key rules:
 * - Snapshot fields are captured at creation time from the LIVE membership
 *   join data; they are NEVER updated from later joins.
 * - Certificate numbers are auto-generated as CERT-{membershipId}-{timestamp}.
 * - Only one certificate record is allowed per panel_membership_id
 *   (enforced by DB unique constraint uk_adm_member_certificates_membership).
 * - No real document/file/PDF generation here — document_template_id and
 *   generated_document_id are stubbed FKs for the Shared/Core pipeline later.
 *
 * // TODO: Shared/Core integration point — when the document generation
 * //        pipeline is implemented, it will populate generated_document_id
 * //        on adm_member_certificates by calling the infra_generated_documents
 * //        table. This service should NOT implement that logic.
 */

import * as certRepo from '../repositories/certificateRepository.js'
import * as membershipRepo from '../repositories/membershipRepository.js'
import * as panelTermRepo from '../repositories/panelTermRepository.js'
import { validateCreate, validateUpdateStatus } from '../validators/certificateValidator.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a unique certificate number.
 * Format: CERT-{membershipId}-{YYYYMMDDHHmmss}
 * @param {number} membershipId
 */
function generateCertificateNumber(membershipId) {
  const now = new Date()
  const ts = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
  return `CERT-${membershipId}-${ts}`
}

// ── Service methods ───────────────────────────────────────────────────────────

/**
 * Get a single certificate record by its primary key.
 * @param {number|string} id
 */
export async function getCertificateById(id) {
  const cert = await certRepo.findById(id)
  if (!cert) {
    const err = new Error(`Certificate record with ID ${id} not found.`)
    err.status = 404
    throw err
  }
  return cert
}

/**
 * List all certificate records for a given panel term.
 * Also returns memberships that do NOT yet have a certificate so the UI
 * can show the full picture (issued vs. pending-issue).
 * @param {number|string} termId
 */
export async function getCertificatesByTerm(termId) {
  const term = await panelTermRepo.findById(termId)
  if (!term) {
    const err = new Error(`Panel term with ID ${termId} not found.`)
    err.status = 404
    throw err
  }

  const [issued, withoutCertificate] = await Promise.all([
    certRepo.findByTermId(termId),
    certRepo.findMembershipsWithoutCertificateByTerm(termId),
  ])

  return {
    term,
    issued,
    withoutCertificate,
  }
}

/**
 * List all certificate records for a given member.
 * @param {number|string} memberId
 */
export async function getCertificatesByMember(memberId) {
  // Verify member exists via membershipRepo (reusing Task 5 helper)
  const member = await membershipRepo.findMemberById(memberId)
  if (!member) {
    const err = new Error(`Official club member with ID ${memberId} not found.`)
    err.status = 404
    throw err
  }

  const certificates = await certRepo.findByMemberId(memberId)
  return { member, certificates }
}

/**
 * Create a certificate record for a panel membership.
 *
 * Snapshot discipline: snapshot fields are read from the CURRENT live
 * membership join (via membershipRepo.findById) at the moment of creation
 * and stored immutably. They will NOT be updated if member/position/team/term
 * data changes later.
 *
 * @param {object} payload — must contain panel_membership_id
 */
export async function createCertificate(payload) {
  // 1. Validate input
  const validation = validateCreate(payload)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  const { panel_membership_id } = payload
  const membershipId = Number(panel_membership_id)

  // 2. Look up the LIVE membership using the Task 5 repository function.
  //    This gives us the full join (member name, position, team, term).
  const membership = await membershipRepo.findById(membershipId)
  if (!membership) {
    const err = new Error(`Panel membership with ID ${membershipId} does not exist.`)
    err.status = 404
    throw err
  }

  // 3. Eligibility check: VOID memberships do not receive certificates
  if (membership.status === 'VOID') {
    const err = new Error(
      `Cannot create a certificate for a VOID membership. Only ACTIVE or ENDED memberships are eligible.`
    )
    err.status = 422
    throw err
  }

  // 4. Check for duplicate (one certificate per membership is enforced at DB level
  //    by uk_adm_member_certificates_membership, but we give a friendly 409 first)
  const existing = await certRepo.findByMembershipId(membershipId)
  if (existing) {
    const err = new Error(
      `A certificate record already exists for this panel membership ` +
      `(${membership.member_name} — ${membership.position_name} — ${membership.panel_title}). ` +
      `Certificate #${existing.certificate_number}, status: ${existing.status}.`
    )
    err.status = 409
    throw err
  }

  // 5. Capture snapshot data from the LIVE join NOW.
  //    After this point the snapshots are immutable — they will NOT change
  //    even if the member is renamed, the position is renamed, or the team changes.
  const snapshotDate = new Date().toISOString().split('T')[0]
  const memberNameSnapshot = membership.member_name
  const termSnapshot = membership.panel_title
  const positionSnapshot = membership.position_name
  const teamSnapshot = membership.team_name ?? null

  // 6. Generate a unique certificate number
  const certificateNumber = generateCertificateNumber(membershipId)

  // 7. Insert the record
  try {
    return await certRepo.create({
      panel_membership_id: membershipId,
      certificate_number: certificateNumber,
      snapshot_date: snapshotDate,
      member_name_snapshot: memberNameSnapshot,
      term_snapshot: termSnapshot,
      position_snapshot: positionSnapshot,
      team_snapshot: teamSnapshot,
    })
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      // Unique constraint violation — concurrent duplicate
      const err = new Error(
        'A certificate record already exists for this panel membership (concurrent duplicate).'
      )
      err.status = 409
      throw err
    }
    throw dbErr
  }
}

/**
 * Update the status of a certificate record.
 * Only forward transitions are allowed per the schema's status/timestamp design.
 *
 * PENDING → ISSUED → AVAILABLE → DELIVERED
 *
 * @param {number|string} id
 * @param {object} payload — must contain status
 */
export async function updateCertificateStatus(id, payload) {
  // 1. Fetch existing to validate current status
  const cert = await getCertificateById(id)

  // 2. Validate transition
  const validation = validateUpdateStatus(payload, cert.status)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  // 3. Apply status change (updateStatus also sets the timestamp column)
  const updated = await certRepo.updateStatus(id, payload.status)
  if (!updated) {
    const err = new Error(`Certificate record with ID ${id} could not be updated.`)
    err.status = 500
    throw err
  }

  return updated
}
