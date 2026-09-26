const ALLOWED_STATUSES = ['ACTIVE', 'INACTIVE']
// position_key must be UPPER_SNAKE_CASE, letters/digits/underscores only.
const KEY_PATTERN = /^[A-Z0-9_]+$/

/**
 * Validate a position create payload.
 * @param {object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateCreate(body) {
  const errors = []

  if (!body.position_key || typeof body.position_key !== 'string' || body.position_key.trim() === '') {
    errors.push('position_key is required.')
  } else if (!KEY_PATTERN.test(body.position_key.trim())) {
    errors.push('position_key must be UPPER_SNAKE_CASE (letters, digits, underscores only).')
  } else if (body.position_key.trim().length > 100) {
    errors.push('position_key must be 100 characters or fewer.')
  }

  if (!body.position_name || typeof body.position_name !== 'string' || body.position_name.trim() === '') {
    errors.push('position_name is required and must be a non-empty string.')
  } else if (body.position_name.trim().length > 150) {
    errors.push('position_name must be 150 characters or fewer.')
  }

  if (body.hierarchy_level !== undefined) {
    const hl = Number(body.hierarchy_level)
    if (!Number.isInteger(hl) || hl < 0) {
      errors.push('hierarchy_level must be a non-negative integer.')
    }
  }

  if (body.sort_order !== undefined) {
    const so = Number(body.sort_order)
    if (!Number.isInteger(so) || so < 0) {
      errors.push('sort_order must be a non-negative integer.')
    }
  }

  if (body.can_assign_tasks !== undefined && typeof body.can_assign_tasks !== 'boolean') {
    errors.push('can_assign_tasks must be a boolean.')
  }

  if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
    errors.push(`status must be one of: ${ALLOWED_STATUSES.join(', ')}.`)
  }

  return errors.length === 0 ? { valid: true, errors: [] } : { valid: false, errors }
}

/**
 * Validate a position update payload (all fields optional but at least one required).
 * @param {object} body
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateUpdate(body) {
  const errors = []
  const allowed = ['position_key', 'position_name', 'hierarchy_level', 'sort_order', 'can_assign_tasks', 'status']
  const provided = Object.keys(body).filter((k) => allowed.includes(k))

  if (provided.length === 0) {
    errors.push('At least one field must be provided for update.')
    return { valid: false, errors }
  }

  if (body.position_key !== undefined) {
    if (typeof body.position_key !== 'string' || body.position_key.trim() === '') {
      errors.push('position_key must be a non-empty string.')
    } else if (!KEY_PATTERN.test(body.position_key.trim())) {
      errors.push('position_key must be UPPER_SNAKE_CASE (letters, digits, underscores only).')
    } else if (body.position_key.trim().length > 100) {
      errors.push('position_key must be 100 characters or fewer.')
    }
  }

  if (body.position_name !== undefined) {
    if (typeof body.position_name !== 'string' || body.position_name.trim() === '') {
      errors.push('position_name must be a non-empty string.')
    } else if (body.position_name.trim().length > 150) {
      errors.push('position_name must be 150 characters or fewer.')
    }
  }

  if (body.hierarchy_level !== undefined) {
    const hl = Number(body.hierarchy_level)
    if (!Number.isInteger(hl) || hl < 0) {
      errors.push('hierarchy_level must be a non-negative integer.')
    }
  }

  if (body.sort_order !== undefined) {
    const so = Number(body.sort_order)
    if (!Number.isInteger(so) || so < 0) {
      errors.push('sort_order must be a non-negative integer.')
    }
  }

  if (body.can_assign_tasks !== undefined && typeof body.can_assign_tasks !== 'boolean') {
    errors.push('can_assign_tasks must be a boolean.')
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
