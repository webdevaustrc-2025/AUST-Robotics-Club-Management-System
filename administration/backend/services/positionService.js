import * as positionRepo from '../repositories/positionRepository.js'
import { validateCreate, validateUpdate, validateStatusUpdate } from '../validators/positionValidator.js'

/**
 * Derive an UPPER_SNAKE_CASE slug from a display name.
 * e.g. "Vice President (Technical)" -> "VICE_PRESIDENT_TECHNICAL"
 * @param {string} name
 * @returns {string}
 */
export function deriveKeyFromName(name) {
  if (!name || typeof name !== 'string') return ''
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * List all positions ordered by hierarchy_level DESC, sort_order ASC.
 */
export async function listPositions() {
  return await positionRepo.findAll()
}

/**
 * Get a single position by primary key.
 * @param {number|string} id
 */
export async function getPositionById(id) {
  const position = await positionRepo.findById(id)
  if (!position) {
    const err = new Error(`Position with ID ${id} not found.`)
    err.status = 404
    throw err
  }
  return position
}

/**
 * Create a new position after validation and optional key auto-derivation.
 * @param {object} payload
 */
export async function createPosition(payload) {
  const data = { ...payload }

  // Auto-derive position_key if omitted or empty
  if (!data.position_key || typeof data.position_key !== 'string' || data.position_key.trim() === '') {
    data.position_key = deriveKeyFromName(data.position_name)
  } else {
    data.position_key = data.position_key.trim().toUpperCase()
  }

  const validation = validateCreate(data)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  try {
    return await positionRepo.create({
      position_key: data.position_key,
      position_name: data.position_name.trim(),
      hierarchy_level: data.hierarchy_level !== undefined ? Number(data.hierarchy_level) : 0,
      sort_order: data.sort_order !== undefined ? Number(data.sort_order) : 0,
      can_assign_tasks: data.can_assign_tasks === true || data.can_assign_tasks === 'true',
      status: data.status || 'ACTIVE',
    })
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      if (dbErr.constraint?.includes('key') || dbErr.detail?.includes('position_key')) {
        const err = new Error(`A position with key "${data.position_key}" already exists.`)
        err.status = 409
        throw err
      }
      const err = new Error(`A position with name "${data.position_name}" already exists.`)
      err.status = 409
      throw err
    }
    throw dbErr
  }
}

/**
 * Update an existing position.
 * @param {number|string} id
 * @param {object} payload
 */
export async function updatePosition(id, payload) {
  await getPositionById(id)

  const data = { ...payload }
  if (data.position_key !== undefined) {
    data.position_key = data.position_key.trim().toUpperCase()
  }

  const validation = validateUpdate(data)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  const cleanData = {}
  if (data.position_key !== undefined) cleanData.position_key = data.position_key
  if (data.position_name !== undefined) cleanData.position_name = data.position_name.trim()
  if (data.hierarchy_level !== undefined) cleanData.hierarchy_level = Number(data.hierarchy_level)
  if (data.sort_order !== undefined) cleanData.sort_order = Number(data.sort_order)
  if (data.can_assign_tasks !== undefined) cleanData.can_assign_tasks = data.can_assign_tasks === true || data.can_assign_tasks === 'true'
  if (data.status !== undefined) cleanData.status = data.status

  try {
    return await positionRepo.update(id, cleanData)
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      if (dbErr.constraint?.includes('key') || dbErr.detail?.includes('position_key')) {
        const err = new Error(`A position with key "${data.position_key}" already exists.`)
        err.status = 409
        throw err
      }
      const err = new Error(`A position with name "${data.position_name}" already exists.`)
      err.status = 409
      throw err
    }
    throw dbErr
  }
}

/**
 * Set position status (ACTIVE | INACTIVE).
 * @param {number|string} id
 * @param {string} status
 */
export async function setPositionStatus(id, status) {
  await getPositionById(id)

  const validation = validateStatusUpdate({ status })
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  return await positionRepo.setStatus(id, status)
}
