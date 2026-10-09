/**
 * f3.listAndDetail.test.js — Integration Suite for F3: List & Detail
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'

describe('F3: List and Detail Endpoints (GET /tasks, GET /tasks/:taskId)', () => {
  let testEnv
  let createdTask

  before(async () => {
    testEnv = await setupIntegrationTest('f3')
    if (!testEnv.skipped) {
      const { httpClient, world } = testEnv
      // Create a test task assigned to SENIOR_SUB
      const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
        panel_term_id: world.activeTerm.panel_term_id,
        team_id: world.teamA.team_id,
        task_title: 'Special Autonomous Pipeline %_test',
        task_description: 'Detailed description for search',
        priority: 'HIGH',
        panel_membership_ids: [world.actors.SENIOR_SUB.membership.panel_membership_id],
      })
      createdTask = res.body.data
    }
  })

  after(async () => {
    if (testEnv && !testEnv.skipped) {
      await testEnv.cleanup()
    }
  })

  it('F3-T1 MANAGER sees all tasks; ASSIGNEE_A sees their assigned task; OUTSIDER sees none', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    // Manager
    const mgrRes = await httpClient
      .asUser(world.actors.MANAGER.user.user_id, ['adm.task.manage'])
      .get('/api/administration/tasks')
    assert.equal(mgrRes.status, 200)
    assert.ok(mgrRes.body.data.length >= 1)

    // Assignee (Senior Sub)
    const assigneeRes = await httpClient
      .asUser(world.actors.SENIOR_SUB.user.user_id, ['adm.task.create'])
      .get('/api/administration/tasks')
    assert.equal(assigneeRes.status, 200)
    assert.ok(assigneeRes.body.data.some((t) => t.task_id === createdTask.task_id))

    // Outsider (Deputy Executive)
    const outsiderRes = await httpClient
      .asUser(world.actors.DEPUTY_EXECUTIVE.user.user_id, ['adm.task.create'])
      .get('/api/administration/tasks')
    assert.equal(outsiderRes.status, 200)
    assert.ok(!outsiderRes.body.data.some((t) => t.task_id === createdTask.task_id))
  })

  it('F3-T2 Filter by team_id and priority works correctly', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks?team_id=${world.teamA.team_id}&priority=HIGH`)
    assert.equal(res.status, 200)
    assert.ok(res.body.data.length >= 1)
    assert.equal(res.body.data[0].priority, 'HIGH')
  })

  it('F3-T3 Search matches title and description with literal % and _ handling', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    // Literal match of %_test
    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get('/api/administration/tasks?search=%_test')
    assert.equal(res.status, 200)
    assert.ok(res.body.data.some((t) => t.task_id === createdTask.task_id))

    // SQL injection pattern returns empty array safely
    const sqlInj = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get("/api/administration/tasks?search='; DROP TABLE adm_tasks; --")
    assert.equal(sqlInj.status, 200)
    assert.equal(sqlInj.body.data.length, 0)
  })

  it('F3-T7 Detail endpoint returns full task with assignees and assigner', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get(`/api/administration/tasks/${createdTask.task_id}`)
    assert.equal(res.status, 200)
    const task = res.body.data
    assert.equal(task.task_id, createdTask.task_id)
    assert.ok(Array.isArray(task.assignees))
    assert.equal(task.assignees.length, 1)
    assert.equal(task.assignees[0].panel_membership_id, world.actors.SENIOR_SUB.membership.panel_membership_id)
  })

  it('F3-T8 Detail endpoint returns 404 for nonexistent task or unauthorized outsider', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    // Unknown task -> 404
    const resUnknown = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .get('/api/administration/tasks/999999')
    assert.equal(resUnknown.status, 404)

    // Outsider on real task -> 404 (prevents existence probing)
    const resOutsider = await httpClient
      .asUser(world.actors.DEPUTY_EXECUTIVE.user.user_id, ['adm.task.create'])
      .get(`/api/administration/tasks/${createdTask.task_id}`)
    assert.equal(resOutsider.status, 404)
  })
})
