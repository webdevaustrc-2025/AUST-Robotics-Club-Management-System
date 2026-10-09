/**
 * hierarchyPolicy.js — Core Task Hierarchy Policy
 * 
 * Pure functions governing task assignment authority and rank hierarchy.
 * ZERO database dependencies. Direction: larger number = higher rank, <= 0 = unranked.
 */

import { AppError } from '../utils/pgErrors.js'
import { ERROR_CODES } from '../constants/taskConstants.js'

/**
 * Checks whether an actor rank strictly outranks a target rank.
 * Rank <= 0 means unranked (cannot outrank and cannot be outranked in hierarchy).
 */
export function outranks(actorRank, targetRank) {
  const a = Number(actorRank) || 0
  const t = Number(targetRank) || 0
  return a > t && a > 0 && t > 0
}

/**
 * Evaluates whether an actor may assign a task to a target member.
 * Returns { ok: true } or { ok: false, reason: string }.
 * 
 * Order of checks:
 * 1. Actor has rank <= 0: ACTOR_POSITION_NOT_IN_HIERARCHY
 * 2. Same person (member_id equal): SELF
 * 3. Target has rank <= 0: POSITION_NOT_IN_HIERARCHY
 * 4. Equal rank (actor.rank === target.rank): SAME_RANK
 * 5. Target higher (target.rank > actor.rank): HIGHER_RANK
 * 6. Else: { ok: true }
 */
export function classifyAssignment({ actor, target }) {
  const actorRank = Number(actor?.rank) || 0
  const targetRank = Number(target?.rank) || 0

  if (actorRank <= 0) {
    return { ok: false, reason: 'ACTOR_POSITION_NOT_IN_HIERARCHY' }
  }

  // SELF takes precedence over rank comparison
  if (
    actor?.member_id !== undefined &&
    target?.member_id !== undefined &&
    String(actor.member_id) === String(target.member_id)
  ) {
    return { ok: false, reason: 'SELF' }
  }

  if (targetRank <= 0) {
    return { ok: false, reason: 'POSITION_NOT_IN_HIERARCHY' }
  }

  if (actorRank === targetRank) {
    return { ok: false, reason: 'SAME_RANK' }
  }

  if (targetRank > actorRank) {
    return { ok: false, reason: 'HIGHER_RANK' }
  }

  return { ok: true }
}

/**
 * Asserts that the actor may assign to all target members.
 * Throws 403 POSITION_NOT_IN_HIERARCHY if actor has rank <= 0.
 * Throws 403 HIERARCHY_VIOLATION aggregating all failed targets in details.
 */
export function assertCanAssign(actor, targets = []) {
  const actorRank = Number(actor?.rank) || 0
  if (actorRank <= 0) {
    throw new AppError('Actor position is not ranked in hierarchy', {
      status: 403,
      code: ERROR_CODES.POSITION_NOT_IN_HIERARCHY,
    })
  }

  const failures = []

  for (const target of targets) {
    const res = classifyAssignment({ actor, target })
    if (!res.ok) {
      failures.push({
        panel_membership_id: target.panel_membership_id,
        member_id: target.member_id,
        reason: res.reason,
      })
    }
  }

  if (failures.length > 0) {
    throw new AppError('Hierarchy violation: one or more assignees cannot be assigned by this actor', {
      status: 403,
      code: ERROR_CODES.HIERARCHY_VIOLATION,
      details: failures,
    })
  }

  return true
}

/**
 * Filters a list of candidates returning only those the actor is permitted to assign.
 * Must use the exact same classifyAssignment logic.
 */
export function filterAssignable(actor, candidates = []) {
  return candidates.filter((candidate) => classifyAssignment({ actor, target: candidate }).ok)
}
