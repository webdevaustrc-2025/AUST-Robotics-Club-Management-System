import * as membershipRepo from '../repositories/membershipRepository.js'
import * as panelTermRepo from '../repositories/panelTermRepository.js'
import * as positionRepo from '../repositories/positionRepository.js'
import * as teamRepo from '../repositories/teamRepository.js'
import {
  validateAssign,
  validateEndMembership,
  validateVoidMembership,
} from '../validators/membershipValidator.js'

/**
 * Assign an official club member to a panel term, position, and team.
 * @param {object} payload
 */
export async function assignMember(payload) {
  const validation = validateAssign(payload)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  const { panel_term_id, member_id, position_id, team_id, appointed_at, status, notes } = payload

  // 1. Verify Panel Term exists and is not ARCHIVED
  const term = await panelTermRepo.findById(panel_term_id)
  if (!term) {
    const err = new Error(`Panel term with ID ${panel_term_id} does not exist.`)
    err.status = 404
    throw err
  }
  if (term.status === 'ARCHIVED') {
    const err = new Error(`Cannot assign members to an ARCHIVED panel term ("${term.panel_title}").`)
    err.status = 422
    throw err
  }

  // 2. Verify Member exists in core_members and is ACTIVE
  const member = await membershipRepo.findMemberById(member_id)
  if (!member) {
    const err = new Error(`Official club member with ID ${member_id} does not exist.`)
    err.status = 404
    throw err
  }
  if (member.status !== 'ACTIVE') {
    const err = new Error(`Cannot assign member "${member.member_name}" because their membership status is ${member.status}.`)
    err.status = 422
    throw err
  }

  // 3. Verify Position exists and is ACTIVE
  const position = await positionRepo.findById(position_id)
  if (!position) {
    const err = new Error(`Position with ID ${position_id} does not exist.`)
    err.status = 404
    throw err
  }
  if (position.status !== 'ACTIVE') {
    const err = new Error(`Cannot assign to position "${position.position_name}" because it is INACTIVE.`)
    err.status = 422
    throw err
  }

  // 4. Verify Team (if provided) exists and is ACTIVE
  if (team_id) {
    const team = await teamRepo.findById(team_id)
    if (!team) {
      const err = new Error(`Team with ID ${team_id} does not exist.`)
      err.status = 404
      throw err
    }
    if (team.status !== 'ACTIVE') {
      const err = new Error(`Cannot assign to team "${team.team_name}" because it is INACTIVE.`)
      err.status = 422
      throw err
    }
  }

  // 5. Enforce single active position per member per panel term
  const existingActive = await membershipRepo.findActiveMembershipForMemberInTerm(member_id, panel_term_id)
  if (existingActive) {
    const err = new Error(
      `Member "${member.member_name}" already holds an active position in this panel term. Conclude their current appointment before assigning a new role.`
    )
    err.status = 409
    throw err
  }

  // 6. Insert new immutable membership record
  try {
    return await membershipRepo.create({
      panel_term_id: Number(panel_term_id),
      member_id: Number(member_id),
      position_id: Number(position_id),
      team_id: team_id ? Number(team_id) : null,
      appointed_at,
      status: status || 'ACTIVE',
      notes: notes ? notes.trim() : null,
    })
  } catch (dbErr) {
    if (dbErr.code === '23505') {
      const err = new Error(
        'An identical historical panel membership entry already exists for this member, term, position, team, and appointment date.'
      )
      err.status = 409
      throw err
    }
    throw dbErr
  }
}

/**
 * List all panel memberships for a given panel term (the roster).
 * @param {number|string} termId
 * @param {boolean} [includeVoid=false]
 */
export async function getMembershipsByTerm(termId, includeVoid = false) {
  const term = await panelTermRepo.findById(termId)
  if (!term) {
    const err = new Error(`Panel term with ID ${termId} not found.`)
    err.status = 404
    throw err
  }
  return await membershipRepo.findByTermId(termId, includeVoid)
}

/**
 * List full chronological history for a specific member across all terms.
 * @param {number|string} memberId
 */
export async function getHistoryByMember(memberId) {
  const member = await membershipRepo.findMemberById(memberId)
  if (!member) {
    const err = new Error(`Official club member with ID ${memberId} not found.`)
    err.status = 404
    throw err
  }
  const history = await membershipRepo.findByMemberId(memberId)
  return {
    member,
    history,
  }
}

/**
 * Get a single membership by ID.
 * @param {number|string} id
 */
export async function getMembershipById(id) {
  const membership = await membershipRepo.findById(id)
  if (!membership) {
    const err = new Error(`Panel membership with ID ${id} not found.`)
    err.status = 404
    throw err
  }
  return membership
}

/**
 * End an active membership (mid-term change or end of service).
 * Preserves the previous record permanently.
 * @param {number|string} id
 * @param {object} payload
 */
export async function endMembership(id, payload) {
  const validation = validateEndMembership(payload)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  const membership = await getMembershipById(id)
  if (membership.status === 'ENDED') {
    const err = new Error('This panel membership is already marked as ENDED.')
    err.status = 422
    throw err
  }
  if (membership.status === 'VOID') {
    const err = new Error('Cannot end a membership that has been VOIDED.')
    err.status = 422
    throw err
  }

  return await membershipRepo.endMembership(id, {
    ended_at: payload.ended_at,
    notes: payload.notes ? payload.notes.trim() : null,
  })
}

/**
 * Soft-void an erroneous panel membership entry.
 * @param {number|string} id
 * @param {object} payload
 */
export async function voidMembership(id, payload = {}) {
  const validation = validateVoidMembership(payload)
  if (!validation.valid) {
    const err = new Error('Validation failed.')
    err.status = 422
    err.details = validation.errors
    throw err
  }

  await getMembershipById(id)
  return await membershipRepo.voidMembership(id, {
    notes: payload.notes ? payload.notes.trim() : null,
  })
}

/**
 * Search/list official members for assignment picker.
 * @param {string} [search]
 */
export async function listOfficialMembers(search = '') {
  return await membershipRepo.searchOfficialMembers(search)
}
