/**
 * f2.createTask.test.js — Integration Suite for F2: Create Task
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'
import { ERROR_CODES } from '../../constants/taskConstants.js'

describe('F2: Create Task Endpoint (POST /tasks)', () => {
  let testEnv

  before(async () => {
    testEnv = await setupIntegrationTest('f2')
  })

  after(async () => {
    if (testEnv && !testEnv.skipped) {
      await testEnv.cleanup()
    }
  })

  it('F2-T1 Minimal body creates task with default status TODO, priority MEDIUM', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Minimal Task',
    })

    assert.equal(res.status, 201)
    const task = res.body.data
    assert.equal(task.task_title, 'Minimal Task')
    assert.equal(task.status, 'TODO')
    assert.equal(task.priority, 'MEDIUM')
    assert.equal(task.completed_at, null)
    assert.equal(task.blocked_reason, null)
    assert.equal(task.assigner_membership_id, world.actors.DIRECTOR.membership.panel_membership_id)
  })

  it('F2-T2 Creates exactly one history row for task creation', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world, client } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Task with History',
    })

    assert.equal(res.status, 201)
    const taskId = res.body.data.task_id

    const histRes = await client.query('SELECT * FROM adm_task_status_history WHERE task_id = $1', [taskId])
    assert.equal(histRes.rows.length, 1)
    assert.equal(histRes.rows[0].from_status, null)
    assert.equal(histRes.rows[0].to_status, 'TODO')
    assert.equal(histRes.rows[0].changed_by_user_id, world.actors.DIRECTOR.user.user_id)
  })

  it('F2-T3 DIRECTOR assigns junior members successfully', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    const assigneeIds = [
      world.actors.SENIOR_SUB.membership.panel_membership_id,
      world.actors.SUB_EXEC.membership.panel_membership_id,
      world.actors.ASSISTANT_DIRECTOR.membership.panel_membership_id,
    ]

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Director Assigned Task',
      panel_membership_ids: assigneeIds,
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.assignees.length, 3)
  })

  it('F2-T4 Duplicate assignee IDs in payload are de-duplicated', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id
    const subMemId = world.actors.SUB_EXEC.membership.panel_membership_id

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Dedup Task',
      panel_membership_ids: [subMemId, subMemId],
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.assignees.length, 1)
  })

  it('F2-T5 Ineligible assignee returns 422 and persists zero records', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world, client } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    const countBefore = await client.query('SELECT COUNT(*) FROM adm_tasks')

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Ineligible Target Task',
      panel_membership_ids: [world.actors.OTHER_TERM.membership.panel_membership_id],
    })

    assert.equal(res.status, 422)
    assert.equal(res.body.error.code, ERROR_CODES.INELIGIBLE_ASSIGNEE)

    const countAfter = await client.query('SELECT COUNT(*) FROM adm_tasks')
    assert.equal(countBefore.rows[0].count, countAfter.rows[0].count)
  })

  it('F2-T6 Forged fields in request body are ignored', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Forgery Test',
      status: 'DONE',
      completed_at: '2020-01-01T00:00:00Z',
      blocked_reason: 'I am blocked',
      assigner_membership_id: 99999,
    })

    assert.equal(res.status, 201)
    assert.equal(res.body.data.status, 'TODO')
    assert.equal(res.body.data.completed_at, null)
    assert.equal(res.body.data.blocked_reason, null)
    assert.equal(res.body.data.assigner_membership_id, world.actors.DIRECTOR.membership.panel_membership_id)
  })

  it('F2-H1 SENIOR_SUB assigning ASSISTANT_DIRECTOR yields 403 HIERARCHY_VIOLATION HIGHER_RANK', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    const res = await httpClient.asUser(world.actors.SENIOR_SUB.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Outrank Test',
      panel_membership_ids: [world.actors.ASSISTANT_DIRECTOR.membership.panel_membership_id],
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, ERROR_CODES.HIERARCHY_VIOLATION)
    assert.equal(res.body.error.details[0].reason, 'HIGHER_RANK')
  })

  it('F2-H2 DIRECTOR assigning peer DIRECTOR_2 yields 403 SAME_RANK', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Peer Test',
      panel_membership_ids: [world.actors.DIRECTOR_2.membership.panel_membership_id],
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, ERROR_CODES.HIERARCHY_VIOLATION)
    assert.equal(res.body.error.details[0].reason, 'SAME_RANK')
  })

  it('F2-H3 DIRECTOR assigning self yields 403 SELF', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    const res = await httpClient.asUser(world.actors.DIRECTOR.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Self Test',
      panel_membership_ids: [world.actors.DIRECTOR.membership.panel_membership_id],
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, ERROR_CODES.HIERARCHY_VIOLATION)
    assert.equal(res.body.error.details[0].reason, 'SELF')
  })

  it('F2-H9 Actor with can_assign_tasks = false returns 403 CANNOT_ASSIGN_TASKS on create', async (t) => {
    if (testEnv.skipped) return t.skip(testEnv.reason)
    const { httpClient, world } = testEnv
    const termId = world.activeTerm.panel_term_id
    const teamId = world.teamA.team_id

    // Sub Exec has can_assign_tasks = false
    const res = await httpClient.asUser(world.actors.SUB_EXEC.user.user_id).post('/api/administration/tasks', {
      panel_term_id: termId,
      team_id: teamId,
      task_title: 'Sub Exec Task Creation',
    })

    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, ERROR_CODES.CANNOT_ASSIGN_TASKS)
  })
})
