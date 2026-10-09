/**
 * 01.lifecycle.test.js — Phase B4 Cross-Cutting: X1, X2, X3, X6, X9
 *
 * X1: Authorization matrix — every endpoint × actor role → expected HTTP status.
 * X2: Invariant sweep — I1 (status is a valid value), I2 (blocked_reason null unless BLOCKED),
 *     I3 (completed_at null unless DONE) for every task in the test world.
 * X3: Full lifecycle — create → IN_PROGRESS → BLOCKED → IN_PROGRESS → DONE with correct history.
 * X6: Error contract — every 4xx/5xx returns { error: { code, message } }; 500 exposes no stack/SQL.
 * X9: Hierarchy sweep — every assignee row was created by someone with strictly higher rank.
 */

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'
import { TASK_STATUSES } from '../../constants/taskConstants.js'

const BASE = '/api/administration/tasks'

describe('B4: X1 Authorization Matrix + X3 Full Lifecycle + X2/X6/X9 Invariants', () => {
  let ctx

  before(async () => {
    ctx = await setupIntegrationTest('b4_lc')
    if (ctx.skipped) return
  })

  after(async () => {
    if (ctx && !ctx.skipped) await ctx.cleanup()
  })

  // -------------------------------------------------------------------------
  // X3: Full Task Lifecycle
  // -------------------------------------------------------------------------
  test('X3: Full lifecycle TODO→IN_PROGRESS→BLOCKED→IN_PROGRESS→DONE has 5 ordered history rows', async (t) => {
    if (ctx.skipped) return t.skip(ctx.reason)

    const { world, httpClient } = ctx
    const { activeTerm, teamA, actors } = world
    const DIRECTOR = actors.DIRECTOR
    const ASSIGNEE_A = actors.ASSIGNEE_A   // SENIOR_SUB (rank 20)
    const ASSIGNEE_B = actors.ASSIGNEE_B   // SUB_EXEC (rank 10)

    // Create a task with 2 lower-ranked assignees
    const createRes = await httpClient.asUser(DIRECTOR.user.user_id).post(BASE, {
      panel_term_id: activeTerm.panel_term_id,
      team_id: teamA.team_id,
      task_title: 'X3 Lifecycle Task',
      task_description: 'Testing the complete lifecycle',
      panel_membership_ids: [
        ASSIGNEE_A.membership.panel_membership_id,
        ASSIGNEE_B.membership.panel_membership_id,
      ],
    })
    assert.equal(createRes.status, 201, `Create failed: ${JSON.stringify(createRes.body)}`)
    const taskId = createRes.body.data.task_id
    assert.ok(taskId, 'task_id should be present')
    assert.equal(createRes.body.data.status, 'TODO')
    assert.equal(createRes.body.data.assignees.length, 2)

    // Transition: TODO → IN_PROGRESS (by ASSIGNEE_A)
    const toInProgress = await httpClient.asUser(ASSIGNEE_A.user.user_id).patch(
      `${BASE}/${taskId}/status`,
      { to_status: 'IN_PROGRESS' }
    )
    assert.equal(toInProgress.status, 200, `TODO→IN_PROGRESS failed: ${JSON.stringify(toInProgress.body)}`)
    assert.equal(toInProgress.body.data.task.status, 'IN_PROGRESS')
    assert.equal(toInProgress.body.data.task.completed_at, null)
    assert.equal(toInProgress.body.data.task.blocked_reason, null)

    // Transition: IN_PROGRESS → BLOCKED (with reason, by ASSIGNEE_B)
    const toBlocked = await httpClient.asUser(ASSIGNEE_B.user.user_id).patch(
      `${BASE}/${taskId}/status`,
      { to_status: 'BLOCKED', reason: 'Waiting for hardware delivery' }
    )
    assert.equal(toBlocked.status, 200, `IN_PROGRESS→BLOCKED failed: ${JSON.stringify(toBlocked.body)}`)
    assert.equal(toBlocked.body.data.task.status, 'BLOCKED')
    assert.equal(toBlocked.body.data.task.blocked_reason, 'Waiting for hardware delivery')
    assert.equal(toBlocked.body.data.task.completed_at, null)

    // Transition: BLOCKED → IN_PROGRESS (clears blocked_reason)
    const toInProgress2 = await httpClient.asUser(DIRECTOR.user.user_id).patch(
      `${BASE}/${taskId}/status`,
      { to_status: 'IN_PROGRESS' }
    )
    assert.equal(toInProgress2.status, 200, `BLOCKED→IN_PROGRESS failed: ${JSON.stringify(toInProgress2.body)}`)
    assert.equal(toInProgress2.body.data.task.status, 'IN_PROGRESS')
    assert.equal(toInProgress2.body.data.task.blocked_reason, null, 'blocked_reason must be cleared (I2)')

    // Transition: IN_PROGRESS → DONE (sets completed_at)
    const toDone = await httpClient.asUser(ASSIGNEE_A.user.user_id).patch(
      `${BASE}/${taskId}/status`,
      { to_status: 'DONE' }
    )
    assert.equal(toDone.status, 200, `IN_PROGRESS→DONE failed: ${JSON.stringify(toDone.body)}`)
    assert.equal(toDone.body.data.task.status, 'DONE')
    assert.ok(toDone.body.data.task.completed_at, 'completed_at must be set when DONE (I3)')
    assert.equal(toDone.body.data.task.blocked_reason, null)

    // Verify history: 5 rows in order
    const histRes = await httpClient.asUser(DIRECTOR.user.user_id).get(`${BASE}/${taskId}/history`)
    assert.equal(histRes.status, 200, `History fetch failed: ${JSON.stringify(histRes.body)}`)
    const history = histRes.body.data
    assert.equal(history.length, 5, `Expected 5 history rows, got ${history.length}`)

    // Row 0: NULL → TODO (task creation)
    assert.equal(history[0].from_status, null)
    assert.equal(history[0].to_status, 'TODO')

    // Row 1: TODO → IN_PROGRESS (ASSIGNEE_A)
    assert.equal(history[1].from_status, 'TODO')
    assert.equal(history[1].to_status, 'IN_PROGRESS')
    assert.ok(history[1].changed_by_user_name, 'actor name must be populated')

    // Row 2: IN_PROGRESS → BLOCKED with reason (ASSIGNEE_B)
    assert.equal(history[2].from_status, 'IN_PROGRESS')
    assert.equal(history[2].to_status, 'BLOCKED')
    assert.equal(history[2].reason, 'Waiting for hardware delivery')

    // Row 3: BLOCKED → IN_PROGRESS
    assert.equal(history[3].from_status, 'BLOCKED')
    assert.equal(history[3].to_status, 'IN_PROGRESS')

    // Row 4: IN_PROGRESS → DONE
    assert.equal(history[4].from_status, 'IN_PROGRESS')
    assert.equal(history[4].to_status, 'DONE')

    // Chronological order (IDs must be increasing)
    for (let i = 1; i < history.length; i++) {
      assert.ok(
        history[i].task_status_history_id > history[i - 1].task_status_history_id,
        `History rows out of order at index ${i}`
      )
    }
  })

  // -------------------------------------------------------------------------
  // X1: Authorization Matrix
  // -------------------------------------------------------------------------
  test('X1: Authorization matrix — create endpoint', async (t) => {
    if (ctx.skipped) return t.skip(ctx.reason)

    const { world, httpClient } = ctx
    const { activeTerm, teamA, actors } = world

    const minimalPayload = {
      panel_term_id: activeTerm.panel_term_id,
      team_id: teamA.team_id,
      task_title: 'Auth Matrix Test Task',
    }

    // DIRECTOR (can_assign_tasks=true, rank=50) → 201
    const dirRes = await httpClient.asUser(actors.DIRECTOR.user.user_id).post(BASE, minimalPayload)
    assert.equal(dirRes.status, 201, `DIRECTOR create should be 201: ${JSON.stringify(dirRes.body)}`)

    // SUB_EXEC (can_assign_tasks=false) → 403 CANNOT_ASSIGN_TASKS
    const subRes = await httpClient.asUser(actors.SUB_EXEC.user.user_id).post(BASE, minimalPayload)
    assert.equal(subRes.status, 403, `SUB_EXEC create should be 403: ${JSON.stringify(subRes.body)}`)
    assert.equal(subRes.body.error?.code, 'CANNOT_ASSIGN_TASKS')

    // NO_MEMBERSHIP → 403 NO_ACTIVE_MEMBERSHIP
    const noMemRes = await httpClient.asUser(actors.NO_MEMBERSHIP.user.user_id).post(BASE, minimalPayload)
    assert.equal(noMemRes.status, 403, `NO_MEMBERSHIP create should be 403: ${JSON.stringify(noMemRes.body)}`)
    assert.equal(noMemRes.body.error?.code, 'NO_ACTIVE_MEMBERSHIP')

    // Unauthenticated → 401
    const unauthRes = await httpClient.unauthenticated.post(BASE, minimalPayload)
    assert.equal(unauthRes.status, 401, `Unauthenticated create should be 401: ${JSON.stringify(unauthRes.body)}`)
    assert.equal(unauthRes.body.error?.code, 'UNAUTHENTICATED')

    // No permission → 403 FORBIDDEN (explicit empty perms via header)
    const noPermRes = await httpClient.asUser(actors.DIRECTOR.user.user_id, []).post(BASE, minimalPayload)
    assert.equal(noPermRes.status, 403, `No-perm create should be 403: ${JSON.stringify(noPermRes.body)}`)
  })

  test('X1: Authorization matrix — list endpoint', async (t) => {
    if (ctx.skipped) return t.skip(ctx.reason)

    const { world, httpClient } = ctx
    const { actors } = world

    // MANAGER (read_all) → 200
    const mgrRes = await httpClient.asUser(actors.MANAGER.user.user_id, ['adm.task.view_all', 'adm.task.manage']).get(BASE)
    assert.equal(mgrRes.status, 200, `MANAGER list should be 200: ${JSON.stringify(mgrRes.body)}`)
    assert.ok(Array.isArray(mgrRes.body.data), 'data should be array')

    // DIRECTOR (no special perms) → 200 (sees own tasks)
    const dirRes = await httpClient.asUser(actors.DIRECTOR.user.user_id).get(BASE)
    assert.equal(dirRes.status, 200, `DIRECTOR list should be 200: ${JSON.stringify(dirRes.body)}`)

    // Unauthenticated → 401
    const unauthRes = await httpClient.unauthenticated.get(BASE)
    assert.equal(unauthRes.status, 401)
  })

  test('X1: Authorization matrix — status transition endpoint', async (t) => {
    if (ctx.skipped) return t.skip(ctx.reason)

    const { world, httpClient } = ctx
    const { activeTerm, teamA, actors } = world

    // Create a task with DIRECTOR as assigner and ASSIGNEE_A as assigned member
    const createRes = await httpClient.asUser(actors.DIRECTOR.user.user_id).post(BASE, {
      panel_term_id: activeTerm.panel_term_id,
      team_id: teamA.team_id,
      task_title: 'X1 Auth Matrix Status Task',
      panel_membership_ids: [actors.ASSIGNEE_A.membership.panel_membership_id],
    })
    assert.equal(createRes.status, 201)
    const taskId = createRes.body.data.task_id

    // OUTSIDER (DEPUTY_EXECUTIVE — not assigned, not assigner) → 404
    const outsiderRes = await httpClient.asUser(actors.OUTSIDER.user.user_id).patch(
      `${BASE}/${taskId}/status`,
      { to_status: 'IN_PROGRESS' }
    )
    assert.equal(outsiderRes.status, 404, `OUTSIDER status should be 404: ${JSON.stringify(outsiderRes.body)}`)

    // ASSIGNEE_A → 200 (is an assignee → can transition)
    const assigneeRes = await httpClient.asUser(actors.ASSIGNEE_A.user.user_id).patch(
      `${BASE}/${taskId}/status`,
      { to_status: 'IN_PROGRESS' }
    )
    assert.equal(assigneeRes.status, 200, `ASSIGNEE_A status should be 200: ${JSON.stringify(assigneeRes.body)}`)

    // Unauthenticated → 401
    const unauthRes = await httpClient.unauthenticated.patch(
      `${BASE}/${taskId}/status`,
      { to_status: 'DONE' }
    )
    assert.equal(unauthRes.status, 401)
  })

  // -------------------------------------------------------------------------
  // X2: Invariant Sweep (I1, I2, I3) over all tasks in the test world
  // -------------------------------------------------------------------------
  test('X2: Invariant sweep — I1/I2/I3 across all tasks created by this test run', async (t) => {
    if (ctx.skipped) return t.skip(ctx.reason)

    const { client, runId } = ctx

    // Fetch all tasks created by this test run (they all have the runId in team/term names)
    const taskRes = await client.query(`
      SELECT t.task_id, t.status, t.blocked_reason, t.completed_at
      FROM adm_tasks t
      WHERE t.panel_term_id IN (
        SELECT panel_term_id FROM adm_panel_terms WHERE panel_title LIKE $1
      )
    `, [`${runId}%`])

    const validStatuses = new Set(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'])
    const i1Violations = []
    const i2Violations = []
    const i3Violations = []

    for (const row of taskRes.rows) {
      const tid = row.task_id

      // I1: status must be a valid value
      if (!validStatuses.has(row.status)) {
        i1Violations.push({ task_id: tid, status: row.status })
      }

      // I2: blocked_reason must be null unless status is BLOCKED
      if (row.status !== 'BLOCKED' && row.blocked_reason !== null) {
        i2Violations.push({ task_id: tid, status: row.status, blocked_reason: row.blocked_reason })
      }

      // I3: completed_at must be null unless status is DONE
      if (row.status !== 'DONE' && row.completed_at !== null) {
        i3Violations.push({ task_id: tid, status: row.status, completed_at: row.completed_at })
      }
    }

    assert.equal(i1Violations.length, 0, `I1 violations — invalid statuses: ${JSON.stringify(i1Violations)}`)
    assert.equal(i2Violations.length, 0, `I2 violations — blocked_reason set when not BLOCKED: ${JSON.stringify(i2Violations)}`)
    assert.equal(i3Violations.length, 0, `I3 violations — completed_at set when not DONE: ${JSON.stringify(i3Violations)}`)
  })

  // -------------------------------------------------------------------------
  // X6: Error contract validation
  // -------------------------------------------------------------------------
  test('X6: Error contract — all 4xx responses have { error: { code, message } }', async (t) => {
    if (ctx.skipped) return t.skip(ctx.reason)

    const { httpClient } = ctx

    const errorCases = [
      // 401 Unauthenticated
      { desc: '401 unauthenticated', fn: () => httpClient.unauthenticated.get(BASE) },
      // 400 bad ID
      { desc: '400 bad task ID', fn: () => httpClient.asUser(1).get(`${BASE}/abc`) },
      // 404 unknown task
      { desc: '404 unknown task', fn: () => httpClient.asUser(1).get(`${BASE}/99999999`) },
      // 400 validation — missing title
      { desc: '400 missing title on create', fn: () => httpClient.asUser(1).post(BASE, { panel_term_id: 1, team_id: 1 }) },
    ]

    for (const { desc, fn } of errorCases) {
      const res = await fn()
      assert.ok(
        res.body && typeof res.body === 'object' && 'error' in res.body,
        `${desc}: response must have { error } top-level key, got: ${JSON.stringify(res.body)}`
      )
      const err = res.body.error
      assert.ok(typeof err.code === 'string' && err.code.length > 0, `${desc}: error.code must be a non-empty string`)
      assert.ok(typeof err.message === 'string' && err.message.length > 0, `${desc}: error.message must be a non-empty string`)
      // Must NOT contain stack traces or SQL
      const errorStr = JSON.stringify(res.body)
      assert.doesNotMatch(errorStr, /at Object\./, `${desc}: response contains stack trace`)
      assert.doesNotMatch(errorStr, /SELECT|INSERT|UPDATE|DELETE|FROM adm_/i, `${desc}: response leaks SQL`)
    }
  })

  // -------------------------------------------------------------------------
  // X9: Hierarchy sweep — every assignee row was created by someone with strictly higher rank
  // -------------------------------------------------------------------------
  test('X9: Hierarchy sweep — every task_assignee was created by a higher-ranked actor', async (t) => {
    if (ctx.skipped) return t.skip(ctx.reason)

    const { client, runId } = ctx

    const assigneeRows = await client.query(`
      SELECT
        ta.task_assignee_id,
        ta.task_id,
        ta.assigned_by_user_id,
        assigner_pos.hierarchy_level AS assigner_rank,
        assignee_pos.hierarchy_level AS assignee_rank
      FROM adm_task_assignees ta
      -- Resolve task's assigner membership and their position rank
      JOIN adm_tasks t ON ta.task_id = t.task_id
      JOIN adm_panel_memberships assigner_mem ON t.assigner_membership_id = assigner_mem.panel_membership_id
      JOIN adm_positions assigner_pos ON assigner_mem.position_id = assigner_pos.position_id
      -- Resolve the assignee's position rank
      JOIN adm_panel_memberships assignee_mem ON ta.panel_membership_id = assignee_mem.panel_membership_id
      JOIN adm_positions assignee_pos ON assignee_mem.position_id = assignee_pos.position_id
      WHERE t.panel_term_id IN (
        SELECT panel_term_id FROM adm_panel_terms WHERE panel_title LIKE $1
      )
    `, [`${runId}%`])

    const violations = []
    for (const row of assigneeRows.rows) {
      const assignerRank = Number(row.assigner_rank)
      const assigneeRank = Number(row.assignee_rank)

      // assigner rank must be strictly higher (> 0 both)
      if (assignerRank <= 0 || assigneeRank < 0 || assignerRank <= assigneeRank) {
        violations.push({
          task_assignee_id: row.task_assignee_id,
          task_id: row.task_id,
          assigner_rank: assignerRank,
          assignee_rank: assigneeRank,
        })
      }
    }

    assert.equal(
      violations.length,
      0,
      `X9 violations — assignees with rank >= assigner rank: ${JSON.stringify(violations)}`
    )
  })
})
