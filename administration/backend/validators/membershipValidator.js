const STATUS_OPTIONS = ['ACTIVE', 'ENDED', 'VOID']

function isValidDateString(val) {
  if (typeof val !== 'string') return false
  const match = /^\d{4}-\d{2}-\d{2}$/.test(val)
  if (!match) return false
  const d = new Date(val)
  return !isNaN(d.getTime())
}

/**
 * Validate membership assignment payload.
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAssign(payload) {
  const errors = []

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be an object.'] }
  }

  const { panel_term_id, member_id, position_id, team_id, appointed_at, status, notes } = payload

  // panel_term_id: required positive integer
  if (panel_term_id === undefined || panel_term_id === null || panel_term_id === '') {
    errors.push('panel_term_id is required.')
  } else if (!Number.isInteger(Number(panel_term_id)) || Number(panel_term_id) <= 0) {
    errors.push('panel_term_id must be a positive integer.')
  }

  // member_id: required positive integer
  if (member_id === undefined || member_id === null || member_id === '') {
    errors.push('member_id is required.')
  } else if (!Number.isInteger(Number(member_id)) || Number(member_id) <= 0) {
    errors.push('member_id must be a positive integer.')
  }

  // position_id: required positive integer
  if (position_id === undefined || position_id === null || position_id === '') {
    errors.push('position_id is required.')
  } else if (!Number.isInteger(Number(position_id)) || Number(position_id) <= 0) {
    errors.push('position_id must be a positive integer.')
  }

  // team_id: optional, but if provided must be a positive integer
  if (team_id !== undefined && team_id !== null && team_id !== '') {
    if (!Number.isInteger(Number(team_id)) || Number(team_id) <= 0) {
      errors.push('team_id must be a positive integer when provided.')
    }
  }

  // appointed_at: required valid date string
  if (!appointed_at) {
    errors.push('appointed_at date is required.')
  } else if (!isValidDateString(appointed_at)) {
    errors.push('appointed_at must be a valid date in YYYY-MM-DD format.')
  }

  // status: optional, defaults to ACTIVE
  if (status !== undefined && !STATUS_OPTIONS.includes(status)) {
    errors.push(`status must be one of: ${STATUS_OPTIONS.join(', ')}.`)
  }

  // notes: optional, max 500 chars
  if (notes !== undefined && notes !== null && typeof notes === 'string' && notes.length > 500) {
    errors.push('notes must not exceed 500 characters.')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate end-membership payload.
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEndMembership(payload) {
  const errors = []

  if (!payload || typeof payload !== 'object') {
    return { valid: false, errors: ['Payload must be an object.'] }
  }

  const { ended_at, notes } = payload

  // ended_at: required valid date string
  if (!ended_at) {
    errors.push('ended_at date is required.')
  } else if (!isValidDateString(ended_at)) {
    errors.push('ended_at must be a valid date in YYYY-MM-DD format.')
  }

  // notes: optional, max 500 chars
  if (notes !== undefined && notes !== null && typeof notes === 'string' && notes.length > 500) {
    errors.push('notes must not exceed 500 characters.')
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate void-membership payload.
 * @param {object} payload
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateVoidMembership(payload) {
  const errors = []

  if (payload && payload.notes !== undefined && payload.notes !== null) {
    if (typeof payload.notes !== 'string' || payload.notes.length > 500) {
      errors.push('notes must not exceed 500 characters.')
    }
  }

  return { valid: errors.length === 0, errors }
}
