/**
 * hierarchy.matrix.test.js — Cross-Endpoint Hierarchy Enforcement Matrix
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'
import { ERROR_CODES } from '../../constants/taskConstants.js'

describe('FH: Cross-Endpoint Hierarchy Matrix Suite', () => {
  let testEnv

  before(async () => {
    testEnv = await setupIntegrationTest('fh')
  })

  after(async () => {
    if (testEnv && !testEnv.skipped) {
      await testEnv.cleanup()
    }
  })

  it('FH-T1 & FH-T2 Create and Assign matrix: higher rank assigns lower rank; same/higher rank fails', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    // Test cases: [Actor, Target, ExpectedStatus, ExpectedReason]
    const cases = [
      // Director (50) -> Assistant Director (40) => OK
      { actor: world.actors.DIRECTOR, target: world.actors.ASSISTANT_DIRECTOR, ok: true },
      // Assistant Director (40) -> Senior Sub (20) => OK
      { actor: world.actors.ASSISTANT_DIRECTOR, target: world.actors.SENIOR_SUB, ok: true },
      // Assistant Director (40) -> Director (50) => FAIL HIGHER_RANK
      { actor: world.actors.ASSISTANT_DIRECTOR, target: world.actors.DIRECTOR, ok: false, reason: 'HIGHER_RANK' },
      // Director (50) -> Peer Director 2 (50) => FAIL SAME_RANK
      { actor: world.actors.DIRECTOR, target: world.actors.DIRECTOR_2, ok: false, reason: 'SAME_RANK' },
      // Director (50) -> Director (50) => FAIL SELF
      { actor: world.actors.DIRECTOR, target: world.actors.DIRECTOR, ok: false, reason: 'SELF' },
    ]

    for (const c of cases) {
      // 1. Test on POST /tasks
      const createRes = await httpClient.asUser(c.actor.user.user_id).post('/api/administration/tasks', {
        panel_term_id: termId,
        team_id: teamId,
        task_title: `Matrix Test ${Date.now()}`,
        panel_membership_ids: [c.target.membership.panel_membership_id],
      })

      if (c.ok) {
        assert.equal(createRes.status, 201, `Expected 201 for ${c.actor.alias} -> ${c.target.alias}`)
      } else {
        assert.equal(createRes.status, 403, `Expected 403 for ${c.actor.alias} -> ${c.target.alias}`)
        assert.equal(createRes.body.error.code, ERROR_CODES.HIERARCHY_VIOLATION)
        assert.equal(createRes.body.error.details[0].reason, c.reason)
      }
    }
  })

  it('FH-T3 UI Eligible Assignees list agrees with server assignment rules', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)

    assert.equal(res.status, 200)
    const returnedIds = res.body.data.map((m) => m.panel_membership_id)

    // Allowed targets MUST be present in returned list
    assert.ok(returnedIds.includes(world.actors.ASSISTANT_DIRECTOR.membership.panel_membership_id))
    assert.ok(returnedIds.includes(world.actors.SENIOR_SUB.membership.panel_membership_id))
    assert.ok(returnedIds.includes(world.actors.SUB_EXEC.membership.panel_membership_id))

    // Disallowed targets MUST NOT be present
    assert.ok(!returnedIds.includes(world.actors.DIRECTOR.membership.panel_membership_id))
    assert.ok(!returnedIds.includes(world.actors.DIRECTOR_2.membership.panel_membership_id))
  })

  it('FH-T4 Status transition is not gated by hierarchy (assignee can transition task)', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    // Director creates task assigned to Sub Exec
    const createRes = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: world.activeTerm.panel_term_id,
      team_id: world.teamA.team_id,
      task_title: 'Transition Gating Test',
      panel_membership_ids: [world.actors.SUB_EXEC.membership.panel_membership_id],
    })
    const taskId = createRes.body.data.task_id

    // Sub Exec transitions task to IN_PROGRESS (allowed even though Sub Exec cannot assign tasks)
    const transRes = await httpClient
      .asUser(world.actors.SUB_EXEC.user.user_id, ['adm.task.create'])
      .patch(`/api/administration/tasks/${taskId}/status`, { to_status: 'IN_PROGRESS' })

    assert.equal(transRes.status, 200)
    assert.equal(transRes.body.data.task.status, 'IN_PROGRESS')
  })

  it('FH-T8 Authority flag H10: can_assign_tasks = false receives 403 CANNOT_ASSIGN_TASKS', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id

    // Advisor has high rank (95) but can_assign_tasks = false
    const res = await httpClient
      .asUser(world.actors.ADVISOR_ACTOR.user.user_id)
      .get(`/api/administration/tasks/eligible-assignees?panel_term_id=${termId}`)

    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, ERROR_CODES.CANNOT_ASSIGN_TASKS)
  })
})
