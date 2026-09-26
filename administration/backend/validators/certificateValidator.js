/**
 * Certificate Validator — adm_member_certificates
 *
 * Validates payloads for certificate creation and status updates.
 * Status values are taken directly from the schema's approved set:
 *   PENDING | ISSUED | AVAILABLE | DELIVERED
 * No invented statuses.
 */

// Exact status values derivable from the schema:
//   DEFAULT 'PENDING', and timestamp columns: issued_at, available_at, delivered_at
const VALID_STATUSES = ['PENDING', 'ISSUED', 'AVAILABLE', 'DELIVERED']

// Allowed forward transitions — prevents arbitrary status jumps
const ALLOWED_TRANSITIONS = {
  PENDING: ['ISSUED'],
  ISSUED: ['AVAILABLE'],
  AVAILABLE: ['DELIVERED'],
  DELIVERED: [], // terminal
}

/**
 * Validate the create-certificate payload.
 * The service provides panel_membership_id; everything else is derived
 * automatically from the membership record.
 *
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCreate(payload) {
  const errors = []

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be an object.'] }
  }

  const { panel_membership_id } = payload

  // panel_membership_id: required positive integer
  if (panel_membership_id === undefined || panel_membership_id === null || panel_membership_id === '') {
    errors.push('panel_membership_id is required.')
  } else if (!Number.isInteger(Number(panel_membership_id)) || Number(panel_membership_id) <= 0) {
    errors.push('panel_membership_id must be a positive integer.')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate the update-status payload.
 *
 * @param {{ status: string }} payload
 * @param {string} currentStatus  — current status from the database row
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateUpdateStatus(payload, currentStatus) {
  const errors = []

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be an object.'] }
  }

  const { status } = payload

  if (!status) {
    errors.push('status is required.')
    return { valid: false, errors }
  }

  if (!VALID_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${VALID_STATUSES.join(', ')}.`)
    return { valid: false, errors }
  }

  // Enforce allowed transition
  if (currentStatus) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(status)) {
      errors.push(
        `Cannot transition certificate from ${currentStatus} to ${status}. ` +
        `Allowed next statuses from ${currentStatus}: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}.`
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

export { VALID_STATUSES, ALLOWED_TRANSITIONS }
