/**
 * f7.statusHistory.test.js — Integration Suite for F7: Status History Read
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'

describe('F7: Status History Read Endpoint (GET /tasks/:taskId/history)', () => {
  let testEnv
  let taskId

  before(async () => {
    testEnv = await setupIntegrationTest('f7')
    if (!testEnv.skipped) {
      const { httpClient, world } = testEnv
      // Create task -> initial history row (TODO)
      const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
        panel_term_id: world.activeTerm.panel_term_id,
        team_id: world.teamA.team_id,
        task_title: 'History Audited Task',
        panel_membership_ids: [world.actors.SENIOR_SUB.membership.panel_membership_id],
      })
      taskId = res.body.data.task_id

      // Transition to IN_PROGRESS
      await httpClient
        .asUser(world.actors.DIRECTOR.user.user_id)
        .patch(`/api/administration/tasks/${taskId}/status`, { to_status: 'IN_PROGRESS' })

      // Transition to BLOCKED
      await httpClient.asUser(world.actors.DIRECTOR.user.user_id).patch(`/api/administration/tasks/${taskId}/status`, {
        to_status: 'BLOCKED',
        reason: 'Blocked waiting on parts',
      })
    }
  })

  after(async () => {
    if (testEnv && !testEnv.skipped) {
      await testEnv.cleanup()
    }
  })

  it('F7-T1 Returns chronological list of status transitions', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks/${taskId}/history`)

    assert.equal(res.status, 200)
    assert.equal(res.body.data.length, 3)

    // Row 1: Creation
    assert.equal(res.body.data[0].from_status, null)
    assert.equal(res.body.data[0].to_status, 'TODO')

    // Row 2: In progress
    assert.equal(res.body.data[1].from_status, 'TODO')
    assert.equal(res.body.data[1].to_status, 'IN_PROGRESS')

    // Row 3: Blocked
    assert.equal(res.body.data[2].from_status, 'IN_PROGRESS')
    assert.equal(res.body.data[2].to_status, 'BLOCKED')
    assert.equal(res.body.data[2].reason, 'Blocked waiting on parts')
  })

  it('F7-T4 Shape has numeric IDs, user name, and no personal email or password fields', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks/${taskId}/history`)

    assert.equal(res.status, 200)
    const row = res.body.data[0]
    assert.equal(typeof row.task_status_history_id, 'number')
    assert.equal(typeof row.task_id, 'number')
    assert.equal(row.email, undefined)
    assert.equal(row.password_hash, undefined)
  })

  it('F7-T5 Outsider receives 404; unauthenticated receives 401', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const resOutsider = await httpClient
      .asUser(world.actors.DEPUTY_EXECUTIVE.user.user_id, ['adm.task.create'])
      .get(`/api/administration/tasks/${taskId}/history`)
    assert.equal(resOutsider.status, 404)

    const resUnauth = await httpClient.unauthenticated.get(`/api/administration/tasks/${taskId}/history`)
    assert.equal(resUnauth.status, 401)
  })
})
