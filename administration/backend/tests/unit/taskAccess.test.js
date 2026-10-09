/**
 * taskAccess.test.js — Unit Tests for Task Access Context & Authorization
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getActiveMembershipSql,
  isMembershipActive,
  resolveActingMembership,
  assertCanAssignTasks,
  canViewAll,
  canManage,
  canViewTask,
  canMutateTask,
  canTransition,
} from '../../services/taskAccess.js'
import { ERROR_CODES } from '../../constants/taskConstants.js'

describe('taskAccess Service Unit Suite', () => {
  it('getActiveMembershipSql returns canonical SQL condition', () => {
    const sql = getActiveMembershipSql('mem')
    assert.ok(sql.includes("mem.status = 'ACTIVE'"))
    assert.ok(sql.includes('mem.ended_at IS NULL OR mem.ended_at >= CURRENT_DATE'))
  })

  it('isMembershipActive validates boundaries around reference date', () => {
    const today = new Date('2026-10-09T00:00:00Z')
    const yesterday = '2026-10-08'
    const todayStr = '2026-10-09'
    const tomorrow = '2026-10-10'

    // Status not ACTIVE
    assert.equal(isMembershipActive({ status: 'INACTIVE', ended_at: null }, today), false)

    // Active with null ended_at
    assert.equal(isMembershipActive({ status: 'ACTIVE', ended_at: null }, today), true)

    // Active with ended_at yesterday -> false
    assert.equal(isMembershipActive({ status: 'ACTIVE', ended_at: yesterday }, today), false)

    // Active with ended_at today -> true
    assert.equal(isMembershipActive({ status: 'ACTIVE', ended_at: todayStr }, today), true)

    // Active with ended_at tomorrow -> true
    assert.equal(isMembershipActive({ status: 'ACTIVE', ended_at: tomorrow }, today), true)
  })

  it('resolveActingMembership selects highest rank and breaks ties with lowest ID', () => {
    // Empty / null
    assert.equal(resolveActingMembership([]), null)
    assert.equal(resolveActingMembership(null), null)

    // Single
    const single = [{ panel_membership_id: 5, rank: 20 }]
    assert.deepEqual(resolveActingMembership(single), single[0])

    // Dual: highest rank wins (Assistant Director 40 beats Sub Exec 10)
    const dual = [
      { panel_membership_id: 10, rank: 10 },
      { panel_membership_id: 11, rank: 40 },
    ]
    assert.equal(resolveActingMembership(dual).panel_membership_id, 11)

    // Tie in rank: lowest panel_membership_id wins
    const tied = [
      { panel_membership_id: 25, rank: 50 },
      { panel_membership_id: 15, rank: 50 },
      { panel_membership_id: 30, rank: 50 },
    ]
    assert.equal(resolveActingMembership(tied).panel_membership_id, 15)
  })

  it('assertCanAssignTasks enforces H10 and hierarchy ranking rules', () => {
    // Missing active membership -> 403 NO_ACTIVE_MEMBERSHIP
    assert.throws(
      () => assertCanAssignTasks(null),
      (err) => err.status === 403 && err.code === ERROR_CODES.NO_ACTIVE_MEMBERSHIP
    )

    // can_assign_tasks is false (e.g. Sub Exec or Advisor) -> 403 CANNOT_ASSIGN_TASKS
    assert.throws(
      () => assertCanAssignTasks({ can_assign_tasks: false, rank: 45 }),
      (err) => err.status === 403 && err.code === ERROR_CODES.CANNOT_ASSIGN_TASKS
    )

    // rank <= 0 -> 403 POSITION_NOT_IN_HIERARCHY
    assert.throws(
      () => assertCanAssignTasks({ can_assign_tasks: true, rank: 0 }),
      (err) => err.status === 403 && err.code === ERROR_CODES.POSITION_NOT_IN_HIERARCHY
    )

    // Valid -> returns true
    assert.equal(assertCanAssignTasks({ can_assign_tasks: true, rank: 50 }), true)
  })

  it('evaluates permission and task visibility truth tables', () => {
    const task = {
      assigner_membership_id: 10,
      assignees: [{ panel_membership_id: 20 }],
    }

    // canViewAll / canManage
    assert.equal(canViewAll(['adm.task.view_all']), true)
    assert.equal(canViewAll(['adm.task.manage']), true)
    assert.equal(canViewAll(['adm.task.create']), false)

    assert.equal(canManage(['adm.task.manage']), true)
    assert.equal(canManage(['adm.task.view_all']), false)

    // canViewTask
    assert.equal(canViewTask({ task, perms: ['adm.task.view_all'] }), true)
    assert.equal(canViewTask({ task, actorMembershipIds: [10], perms: [] }), true) // assigner
    assert.equal(canViewTask({ task, actorMembershipIds: [20], perms: [] }), true) // assignee
    assert.equal(canViewTask({ task, actorMembershipIds: [99], perms: [] }), false) // outsider

    // canMutateTask
    assert.equal(canMutateTask({ task, perms: ['adm.task.manage'] }), true)
    assert.equal(canMutateTask({ task, actorMembershipIds: [10], perms: [] }), true) // assigner
    assert.equal(canMutateTask({ task, actorMembershipIds: [20], perms: [] }), false) // assignee cannot mutate
    assert.equal(canMutateTask({ task, actorMembershipIds: [99], perms: [] }), false) // outsider

    // canTransition
    assert.equal(canTransition({ task, perms: ['adm.task.manage'] }), true)
    assert.equal(canTransition({ task, actorMembershipIds: [10], perms: [] }), true) // assigner
    assert.equal(canTransition({ task, actorMembershipIds: [20], perms: [] }), true) // assignee
    assert.equal(canTransition({ task, actorMembershipIds: [99], perms: [] }), false) // outsider
  })
})
