/**
 * taskAccess.js — Task Access Context & Authorization
 * 
 * Provides:
 * 1. Shared active-membership SQL fragment and boundary evaluator.
 * 2. Repository reader for active user memberships.
 * 3. H2 acting membership resolver.
 * 4. H10 assignment authority assertion.
 * 5. Pure task permission and ownership evaluators.
 */

import { AppError } from '../utils/pgErrors.js'
import { ERROR_CODES, TASK_PERMISSIONS } from '../constants/taskConstants.js'

/**
 * Single canonical SQL fragment for active panel memberships.
 * Boundary: ended_at IS NULL or ended_at >= CURRENT_DATE.
 */
export function getActiveMembershipSql(tableAlias = 'm') {
  const prefix = tableAlias ? `${tableAlias}.` : ''
  return `(${prefix}status = 'ACTIVE' AND (${prefix}ended_at IS NULL OR ${prefix}ended_at >= CURRENT_DATE))`
}

/**
 * Pure boundary checker for active membership status.
 */
export function isMembershipActive(membership, referenceDate = new Date()) {
  if (!membership || membership.status !== 'ACTIVE') return false
  if (!membership.ended_at) return true

  // Standardize reference date to midnight UTC/local
  const ref = new Date(referenceDate)
  ref.setHours(0, 0, 0, 0)

  const ended = new Date(membership.ended_at)
  ended.setHours(0, 0, 0, 0)

  return ended.getTime() >= ref.getTime()
}

/**
 * Reads all active memberships for a user in a given panel term.
 */
export async function findActiveMembershipsForUser(client, userId, panelTermId) {
  const query = `
    SELECT
      m.panel_membership_id,
      m.panel_term_id,
      m.member_id,
      m.position_id,
      m.team_id,
      p.hierarchy_level AS rank,
      p.can_assign_tasks,
      p.position_name,
      p.position_key,
      mem.member_name
    FROM adm_panel_memberships m
    JOIN core_members mem ON m.member_id = mem.member_id
    JOIN adm_positions p ON m.position_id = p.position_id
    WHERE mem.user_id = $1
      AND m.panel_term_id = $2
      AND ${getActiveMembershipSql('m')}
    ORDER BY p.hierarchy_level DESC, m.panel_membership_id ASC
  `
  const result = await client.query(query, [userId, panelTermId])
  return result.rows.map((row) => ({
    ...row,
    panel_membership_id: Number(row.panel_membership_id),
    panel_term_id: Number(row.panel_term_id),
    member_id: Number(row.member_id),
    position_id: Number(row.position_id),
    team_id: row.team_id ? Number(row.team_id) : null,
    rank: Number(row.rank) || 0,
    can_assign_tasks: Boolean(row.can_assign_tasks),
  }))
}

/**
 * Rule H2: Resolves the acting membership from a user's active memberships.
 * Highest rank wins (larger number = higher rank).
 * Ties are broken by lowest panel_membership_id.
 * Returns null if memberships list is empty.
 */
export function resolveActingMembership(memberships) {
  if (!Array.isArray(memberships) || memberships.length === 0) {
    return null
  }

  return [...memberships].sort((a, b) => {
    const rankDiff = (Number(b.rank) || 0) - (Number(a.rank) || 0)
    if (rankDiff !== 0) return rankDiff
    return (Number(a.panel_membership_id) || 0) - (Number(b.panel_membership_id) || 0)
  })[0]
}

/**
 * Asserts that the acting membership has task assignment authority.
 * Checks H10 (can_assign_tasks === true) and rank > 0.
 */
export function assertCanAssignTasks(actingMembership) {
  if (!actingMembership) {
    throw new AppError('Active panel membership required to manage tasks in this term', {
      status: 403,
      code: ERROR_CODES.NO_ACTIVE_MEMBERSHIP,
    })
  }

  if (actingMembership.can_assign_tasks !== true) {
    throw new AppError('Position does not have authority to assign tasks', {
      status: 403,
      code: ERROR_CODES.CANNOT_ASSIGN_TASKS,
    })
  }

  if (Number(actingMembership.rank) <= 0) {
    throw new AppError('Acting position is not ranked in the task hierarchy', {
      status: 403,
      code: ERROR_CODES.POSITION_NOT_IN_HIERARCHY,
    })
  }

  return true
}

// =========================================================================
// Pure Permission & Ownership Helpers
// =========================================================================

export function canViewAll(perms = []) {
  const p = Array.isArray(perms) ? perms : []
  return p.includes(TASK_PERMISSIONS.VIEW_ALL) || p.includes(TASK_PERMISSIONS.MANAGE)
}

export function canManage(perms = []) {
  const p = Array.isArray(perms) ? perms : []
  return p.includes(TASK_PERMISSIONS.MANAGE)
}

export function canViewTask({ task, actorMembershipIds = [], perms = [] }) {
  if (!task) return false
  if (canViewAll(perms)) return true

  const memIds = (actorMembershipIds || []).map(Number)
  const isAssigner = memIds.includes(Number(task.assigner_membership_id))

  const assigneeIds = (task.assignees || []).map((a) => Number(a.panel_membership_id))
  const isAssignee = memIds.some((id) => assigneeIds.includes(id))

  return isAssigner || isAssignee
}

export function canMutateTask({ task, actorMembershipIds = [], perms = [] }) {
  if (!task) return false
  if (canManage(perms)) return true

  const memIds = (actorMembershipIds || []).map(Number)
  return memIds.includes(Number(task.assigner_membership_id))
}

export function canTransition({ task, actorMembershipIds = [], perms = [] }) {
  if (!task) return false
  if (canManage(perms)) return true

  const memIds = (actorMembershipIds || []).map(Number)
  const isAssigner = memIds.includes(Number(task.assigner_membership_id))

  const assigneeIds = (task.assignees || []).map((a) => Number(a.panel_membership_id))
  const isAssignee = memIds.some((id) => assigneeIds.includes(id))

  return isAssigner || isAssignee
}
