/**
 * f4.updateTask.test.js — Integration Suite for F4: Update Task
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'

describe('F4: Update Task Endpoint (PATCH /tasks/:taskId)', () => {
  let testEnv
  let taskId

  before(async () => {
    testEnv = await setupIntegrationTest('f4')
    if (!testEnv.skipped) {
      const { httpClient, world } = testEnv
      const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
        panel_term_id: world.activeTerm.panel_term_id,
        team_id: world.teamA.team_id,
        task_title: 'Original Title',
        task_description: 'Original Description',
        priority: 'MEDIUM',
        due_at: '2026-11-01T12:00:00.000Z',
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

  it('F4-T1 Partial update updates only sent fields', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).patch(`/api/administration/tasks/${taskId}`, {
      task_title: 'Updated Title',
      priority: 'CRITICAL',
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.task_title, 'Updated Title')
    assert.equal(res.body.data.priority, 'CRITICAL')
    assert.equal(res.body.data.task_description, 'Original Description')
  })

  it('F4-T3 Body status, completed_at, and assigner_membership_id are ignored', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).patch(`/api/administration/tasks/${taskId}`, {
      status: 'DONE',
      completed_at: '2020-01-01T00:00:00Z',
      assigner_membership_id: 1,
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.status, 'TODO')
    assert.equal(res.body.data.completed_at, null)
    assert.equal(res.body.data.assigner_membership_id, world.actors.DIRECTOR.membership.panel_membership_id)
  })

  it('F4-T4 Clearing due_at and task_description with null works', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).patch(`/api/administration/tasks/${taskId}`, {
      due_at: null,
      task_description: null,
    })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.due_at, null)
    assert.equal(res.body.data.task_description, null)
  })

  it('F4-T6 Empty update body returns 400', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .patch(`/api/administration/tasks/${taskId}`, {})

    assert.equal(res.status, 400)
  })

  it('F4-T7 Assignee gets 403; outsider gets 404; unauthenticated gets 401', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    // Assignee (Senior Sub) cannot mutate task metadata -> 403
    const resAssignee = await httpClient
      .asUser(world.actors.SENIOR_SUB.user.user_id, ['adm.task.create'])
      .patch(`/api/administration/tasks/${taskId}`, { task_title: 'Hacked Title' })
    assert.equal(resAssignee.status, 403)

    // Outsider -> 404
    const resOutsider = await httpClient
      .asUser(world.actors.DEPUTY_EXECUTIVE.user.user_id, ['adm.task.create'])
      .patch(`/api/administration/tasks/${taskId}`, { task_title: 'Hacked Title' })
    assert.equal(resOutsider.status, 404)

    // Unauthenticated -> 401
    const resUnauth = await httpClient.unauthenticated.patch(`/api/administration/tasks/${taskId}`, {
      task_title: 'Hacked Title',
    })
    assert.equal(resUnauth.status, 401)
  })
})
