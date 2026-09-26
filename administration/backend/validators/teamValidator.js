
const ALLOWED_STATUSES = ['ACTIVE', 'INACTIVE']
const KEY_PATTERN = /^[A-Z0-9_]+$/

/**
 * Validate a team create payload.
 * @param {object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCreate(body) {
  const errors = []

  if (!body.team_key || typeof body.team_key !== 'string' || body.team_key.trim() === '') {
    errors.push('team_key is required.')
  } else if (!KEY_PATTERN.test(body.team_key.trim())) {
    errors.push('team_key must be UPPER_SNAKE_CASE (letters, digits, underscores only).')
  } else if (body.team_key.trim().length > 100) {
    errors.push('team_key must be 100 characters or fewer.')
  }

  if (!body.team_name || typeof body.team_name !== 'string' || body.team_name.trim() === '') {
    errors.push('team_name is required and must be a non-empty string.')
  } else if (body.team_name.trim().length > 150) {
    errors.push('team_name must be 150 characters or fewer.')
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push('description must be a string or null.')
    } else if (body.description.length > 500) {
      errors.push('description must be 500 characters or fewer.')
    }
  }

  if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}.`)
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
}

/**
 * Validate a team update payload (all fields optional but at least one required).
 * @param {object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateUpdate(body) {
  const errors = []
  const allowed = ['team_key', 'team_name', 'description', 'status']
  const provided = Object.keys(body).filter((k) => allowed.includes(k))

  if (provided.length === 0) {
    errors.push('At least one field must be provided for update.')
    return { valid: false, errors }
  }

  if (body.team_key !== undefined) {
    if (typeof body.team_key !== 'string' || body.team_key.trim() === '') {
      errors.push('team_key must be a non-empty string.')
    } else if (!KEY_PATTERN.test(body.team_key.trim())) {
      errors.push('team_key must be UPPER_SNAKE_CASE (letters, digits, underscores only).')
    } else if (body.team_key.trim().length > 100) {
      errors.push('team_key must be 100 characters or fewer.')
    }
  }

  if (body.team_name !== undefined) {
    if (typeof body.team_name !== 'string' || body.team_name.trim() === '') {
      errors.push('team_name must be a non-empty string.')
    } else if (body.team_name.trim().length > 150) {
      errors.push('team_name must be 150 characters or fewer.')
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string') {
      errors.push('description must be a string or null.')
    } else if (body.description.length > 500) {
      errors.push('description must be 500 characters or fewer.')
    }
  }

  if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}.`)
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
}

/**
 * Validate a status-only update (activate/deactivate endpoint).
 * @param {object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateStatusUpdate(body) {
  if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
    return {
      valid: false,
      errors: [`status is required and must be one of: ${ALLOWED_STATUSES.join(', ')}.`],
    }
  }
  return { valid: true, errors: [] }
}
