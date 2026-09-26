const ALLOWED_STATUSES = ['PLANNED', 'ACTIVE', 'ARCHIVED']

/**
 * Validate a panel term create payload.
 * @param {object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCreate(body) {
  const errors = []

  if (!body.panel_title || typeof body.panel_title !== 'string' || body.panel_title.trim() === '') {
    errors.push('panel_title is required and must be a non-empty string.')
  } else if (body.panel_title.trim().length > 200) {
    errors.push('panel_title must be 200 characters or fewer.')
  }

  if (!body.start_date) {
    errors.push('start_date is required (YYYY-MM-DD).')
  } else if (!isValidDate(body.start_date)) {
    errors.push('start_date must be a valid date in YYYY-MM-DD format.')
  }

  if (!body.end_date) {
    errors.push('end_date is required (YYYY-MM-DD).')
  } else if (!isValidDate(body.end_date)) {
    errors.push('end_date must be a valid date in YYYY-MM-DD format.')
  }

  if (body.start_date && body.end_date && isValidDate(body.start_date) && isValidDate(body.end_date)) {
    if (new Date(body.end_date) <= new Date(body.start_date)) {
      errors.push('end_date must be after start_date.')
    }
  }

  if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}.`)
  }

  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    errors.push('notes must be a string or null.')
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
}

/**
 * Validate a panel term update payload (all fields optional but at least one required).
 * @param {object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateUpdate(body) {
  const errors = []
  const allowed = ['panel_title', 'start_date', 'end_date', 'status', 'notes']
  const provided = Object.keys(body).filter((k) => allowed.includes(k))

  if (provided.length === 0) {
    errors.push('At least one field must be provided for update.')
    return { valid: false, errors }
  }

  if (body.panel_title !== undefined) {
    if (typeof body.panel_title !== 'string' || body.panel_title.trim() === '') {
      errors.push('panel_title must be a non-empty string.')
    } else if (body.panel_title.trim().length > 200) {
      errors.push('panel_title must be 200 characters or fewer.')
    }
  }

  if (body.start_date !== undefined && !isValidDate(body.start_date)) {
    errors.push('start_date must be a valid date in YYYY-MM-DD format.')
  }

  if (body.end_date !== undefined && !isValidDate(body.end_date)) {
    errors.push('end_date must be a valid date in YYYY-MM-DD format.')
  }

  if (body.start_date && body.end_date && isValidDate(body.start_date) && isValidDate(body.end_date)) {
    if (new Date(body.end_date) <= new Date(body.start_date)) {
      errors.push('end_date must be after start_date.')
    }
  }

  if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}.`)
  }

  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') {
    errors.push('notes must be a string or null.')
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isValidDate(value) {
  if (typeof value !== 'string') return false
  const d = new Date(value)
  return !isNaN(d.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(value)
}
