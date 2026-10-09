/**
 * f6.statusTransition.test.js — Integration Suite for F6: Status Transition
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'
import { ERROR_CODES } from '../../constants/taskConstants.js'

describe('F6: Status Transition Endpoint (PATCH /tasks/:taskId/status)', () => {
  let testEnv
  let taskId

  before(async () => {
    testEnv = await setupIntegrationTest('f6')
    if (!testEnv.skipped) {
      const { httpClient, world } = testEnv
      const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
        panel_term_id: world.activeTerm.panel_term_id,
        team_id: world.teamA.team_id,
        task_title: 'Transition Test Task',
        panel_membership_ids: [world.actors.SENIOR_SUB.membership.panel_membership_id],
      })
      taskId = res.body.data.task_id
    }
  })

  after(async () => {
    if (testEnv && !testEnv.skipped) {
      await testEnv.cleanup()
    }
  })

  it('F6-T1 Transitions TODO -> IN_PROGRESS and creates a history row', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .patch(`/api/administration/tasks/${taskId}/status`, { to_status: 'IN_PROGRESS' })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.task.status, 'IN_PROGRESS')
    assert.equal(res.body.data.history.from_status, 'TODO')
    assert.equal(res.body.data.history.to_status, 'IN_PROGRESS')
  })

  it('F6-T2 Transition to BLOCKED without reason returns 400', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .patch(`/api/administration/tasks/${taskId}/status`, { to_status: 'BLOCKED' })

    assert.equal(res.status, 400)
  })

  it('F6-T3 Transition to BLOCKED with reason sets blocked_reason', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).patch(`/api/administration/tasks/${taskId}/status`, {
      to_status: 'BLOCKED',
      reason: 'Awaiting sensor shipment',
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.task.status, 'BLOCKED')
    assert.equal(res.body.data.task.blocked_reason, 'Awaiting sensor shipment')
  })

  it('F6-T4 Transition BLOCKED -> IN_PROGRESS clears blocked_reason', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .patch(`/api/administration/tasks/${taskId}/status`, { to_status: 'IN_PROGRESS' })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.task.status, 'IN_PROGRESS')
    assert.equal(res.body.data.task.blocked_reason, null)
  })

  it('F6-T5 Transition to DONE sets completed_at timestamp', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .patch(`/api/administration/tasks/${taskId}/status`, { to_status: 'DONE' })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.task.status, 'DONE')
    assert.ok(res.body.data.task.completed_at)
  })

  it('F6-T7 Same-status transition returns 409 STATUS_UNCHANGED', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .patch(`/api/administration/tasks/${taskId}/status`, { to_status: 'DONE' })

    assert.equal(res.status, 409)
    assert.equal(res.body.error.code, ERROR_CODES.STATUS_UNCHANGED)
  })
})
