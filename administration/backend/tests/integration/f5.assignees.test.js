/**
 * f5.assignees.test.js — Integration Suite for F5: Assign / Unassign Members
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'
import { ERROR_CODES } from '../../constants/taskConstants.js'

describe('F5: Assign and Unassign Endpoints (POST/DELETE /tasks/:taskId/assignees)', () => {
  let testEnv
  let taskId

  before(async () => {
    testEnv = await setupIntegrationTest('f5')
    if (!testEnv.skipped) {
      const { httpClient, world } = testEnv
      // Create base task
      const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
        panel_term_id: world.activeTerm.panel_term_id,
        team_id: world.teamA.team_id,
        task_title: 'Assignee Management Task',
      })
      taskId = res.body.data.task_id
    }
  })

  after(async () => {
    if (testEnv && !testEnv.skipped) {
      await testEnv.cleanup()
    }
  })

  it('F5-T1 Adds new assignees and returns full assignee array', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .post(`/api/administration/tasks/${taskId}/assignees`, {
        panel_membership_ids: [world.actors.SENIOR_SUB.membership.panel_membership_id],
      })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.length, 1)
    assert.equal(res.body.data[0].panel_membership_id, world.actors.SENIOR_SUB.membership.panel_membership_id)
  })

  it('F5-T2 Re-adding existing assignee is idempotent', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .post(`/api/administration/tasks/${taskId}/assignees`, {
        panel_membership_ids: [
          world.actors.SENIOR_SUB.membership.panel_membership_id,
          world.actors.SUB_EXEC.membership.panel_membership_id,
        ],
      })

    assert.equal(res.status, 200)
    assert.equal(res.body.data.length, 2)
  })

  it('F5-T3 Ineligible ID in batch fails atomically with 422', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .post(`/api/administration/tasks/${taskId}/assignees`, {
        panel_membership_ids: [world.actors.OTHER_TERM.membership.panel_membership_id],
      })

    assert.equal(res.status, 422)
    assert.equal(res.body.error.code, ERROR_CODES.INELIGIBLE_ASSIGNEE)
  })

  it('F5-T5 Unassign removes assignee and last assignee can be removed', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    // Remove SUB_EXEC
    const res = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .delete(`/api/administration/tasks/${taskId}/assignees/${world.actors.SUB_EXEC.membership.panel_membership_id}`)

    assert.equal(res.status, 200)
    assert.equal(res.body.data.assignees.length, 1)

    // Remove SENIOR_SUB (last assignee)
    const resLast = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .delete(`/api/administration/tasks/${taskId}/assignees/${world.actors.SENIOR_SUB.membership.panel_membership_id}`)

    assert.equal(resLast.status, 200)
    assert.equal(resLast.body.data.assignees.length, 0)

    // Unassign non-assignee -> 404
    const resNon = await httpClient
      .asUser(world.actors.DIRECTOR.user.user_id)
      .delete(`/api/administration/tasks/${taskId}/assignees/${world.actors.SUB_EXEC.membership.panel_membership_id}`)
    assert.equal(resNon.status, 404)
  })

  it('F5-H1 ASSISTANT_DIRECTOR adding DIRECTOR fails with 403 HIGHER_RANK', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    // Create task owned by Assistant Director
    const createRes = await httpClient.asUser(world.actors.ASSISTANT_DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: world.activeTerm.panel_term_id,
      team_id: world.teamA.team_id,
      task_title: 'Asst Dir Task',
    })
    const asstTaskId = createRes.body.data.task_id

    const addRes = await httpClient
      .asUser(world.actors.ASSISTANT_DIRECTOR.user.user_id)
      .post(`/api/administration/tasks/${asstTaskId}/assignees`, {
        panel_membership_ids: [world.actors.DIRECTOR.membership.panel_membership_id],
      })

    assert.equal(addRes.status, 403)
    assert.equal(addRes.body.error.code, ERROR_CODES.HIERARCHY_VIOLATION)
    assert.equal(addRes.body.error.details[0].reason, 'HIGHER_RANK')
  })

  it('F5-H8 ADVISOR_ACTOR (can_assign_tasks = false) gets 403 CANNOT_ASSIGN_TASKS on assign', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv

    const res = await httpClient
      .asUser(world.actors.ADVISOR_ACTOR.user.user_id)
      .post(`/api/administration/tasks/${taskId}/assignees`, {
        panel_membership_ids: [world.actors.SUB_EXEC.membership.panel_membership_id],
      })

    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, ERROR_CODES.CANNOT_ASSIGN_TASKS)
  })
})
