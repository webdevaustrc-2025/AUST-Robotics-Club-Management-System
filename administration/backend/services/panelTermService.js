import * as panelTermRepo from '../repositories/panelTermRepository.js'
import { validateCreate, validateUpdate } from '../validators/panelTermValidator.js'

/**
 * List all panel terms.
 */
export async function listPanelTerms() {
  return await panelTermRepo.findAll()
}

/**
 * Get a single panel term by primary key.
 * @param {number|string} id
 */
export async function getPanelTermById(id) {
  const term = await panelTermRepo.findById(id)
  if (!term) {
    const err = new Error(`Panel term with ID ${id} not found.`)
    err.status = 404
    throw err
  }
  return term
}

/**
 * Create a new panel term after validation.
 * @param {object} payload
 */
export async function createPanelTerm(payload) {
  const validation = validateCreate(payload)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  try {
    return await panelTermRepo.create({
      panel_title: payload.panel_title.trim(),
      start_date: payload.start_date,
      end_date: payload.end_date,
      status: payload.status || 'PLANNED',
      notes: payload.notes ? payload.notes.trim() : null,
    })
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      const err = new Error(`A panel term with the title "${payload.panel_title}" already exists.`)
      err.status = 409
      throw err
    }
    throw dbErr
  }
}

/**
 * Update an existing panel term after validation.
 * @param {number|string} id
 * @param {object} payload
 */
export async function updatePanelTerm(id, payload) {
  // Ensure the term exists
  await getPanelTermById(id)

  const validation = validateUpdate(payload)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  const cleanData = {}
  if (payload.panel_title !== undefined) cleanData.panel_title = payload.panel_title.trim()
  if (payload.start_date !== undefined) cleanData.start_date = payload.start_date
  if (payload.end_date !== undefined) cleanData.end_date = payload.end_date
  if (payload.status !== undefined) cleanData.status = payload.status
  if (payload.notes !== undefined) cleanData.notes = payload.notes ? payload.notes.trim() : null

  try {
    return await panelTermRepo.update(id, cleanData)
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      const err = new Error(`A panel term with the title "${payload.panel_title}" already exists.`)
      err.status = 409
      throw err
    }
    throw dbErr
  }
}

/**
 * Archive a panel term (soft delete preserving membership FKs).
 * @param {number|string} id
 */
export async function archivePanelTerm(id) {
  // Ensure the term exists
  await getPanelTermById(id)
  return await panelTermRepo.archive(id)
}
