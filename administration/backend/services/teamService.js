import * as teamRepo from '../repositories/teamRepository.js'
import { validateCreate, validateUpdate, validateStatusUpdate } from '../validators/teamValidator.js'

/**
 * Derive an UPPER_SNAKE_CASE slug from a team name.
 * e.g. "Tech Team" -> "TECH_TEAM"
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
 * List all teams ordered alphabetically.
 */
export async function listTeams() {
  return await teamRepo.findAll()
}

/**
 * Get a single team by primary key.
 * @param {number|string} id
 */
export async function getTeamById(id) {
  const team = await teamRepo.findById(id)
  if (!team) {
    const err = new Error(`Team with ID ${id} not found.`)
    err.status = 404
    throw err
  }
  return team
}

/**
 * Create a new team after validation and optional key auto-derivation.
 * @param {object} payload
 */
export async function createTeam(payload) {
  const data = { ...payload }

  // Auto-derive team_key if omitted or empty
  if (!data.team_key || typeof data.team_key !== 'string' || data.team_key.trim() === '') {
    data.team_key = deriveKeyFromName(data.team_name)
  } else {
    data.team_key = data.team_key.trim().toUpperCase()
  }

  const validation = validateCreate(data)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  try {
    return await teamRepo.create({
      team_key: data.team_key,
      team_name: data.team_name.trim(),
      description: data.description ? data.description.trim() : null,
      status: data.status || 'ACTIVE',
    })
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      if (dbErr.constraint?.includes('key') || dbErr.detail?.includes('team_key')) {
        const err = new Error(`A team with key "${data.team_key}" already exists.`)
        err.status = 409
        throw err
      }
      const err = new Error(`A team with name "${data.team_name}" already exists.`)
      err.status = 409
      throw err
    }
    throw dbErr
  }
}

/**
 * Update an existing team.
 * @param {number|string} id
 * @param {object} payload
 */
export async function updateTeam(id, payload) {
  await getTeamById(id)

  const data = { ...payload }
  if (data.team_key !== undefined) {
    data.team_key = data.team_key.trim().toUpperCase()
  }

  const validation = validateUpdate(data)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  const cleanData = {}
  if (data.team_key !== undefined) cleanData.team_key = data.team_key
  if (data.team_name !== undefined) cleanData.team_name = data.team_name.trim()
  if (data.description !== undefined) cleanData.description = data.description ? data.description.trim() : null
  if (data.status !== undefined) cleanData.status = data.status

  try {
    return await teamRepo.update(id, cleanData)
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      if (dbErr.constraint?.includes('key') || dbErr.detail?.includes('team_key')) {
        const err = new Error(`A team with key "${data.team_key}" already exists.`)
        err.status = 409
        throw err
      }
      const err = new Error(`A team with name "${data.team_name}" already exists.`)
      err.status = 409
      throw err
    }
    throw dbErr
  }
}

/**
 * Set team status (ACTIVE | INACTIVE).
 * @param {number|string} id
 * @param {string} status
 */
export async function setTeamStatus(id, status) {
  await getTeamById(id)

  const validation = validateStatusUpdate({ status })
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  return await teamRepo.setStatus(id, status)
}
