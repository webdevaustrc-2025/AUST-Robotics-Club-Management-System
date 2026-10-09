/**
 * 02.concurrency.test.js — Phase B4 Cross-Cutting: Concurrency
 *
 * Tests that concurrent status transitions are serialized correctly:
 * - X3-concurrency: 10 parallel TODO→IN_PROGRESS → exactly 1 wins (200), 9 get 409 STATUS_UNCHANGED
 * - X3-chain: mixed concurrent transitions maintain I1 (no invalid status stored)
 */

import { describe, test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { setupIntegrationTest } from '../helpers/testDb.js'

const BASE = '/api/administration/tasks'

describe('B4: Concurrency Verification (X3 parallel transitions)', () => {
  let ctx

  before(async () => {
    ctx = await setupIntegrationTest('b4_cc')
    if (ctx.skipped) return
  })

  after(async () => {
    if (ctx && !ctx.skipped) await ctx.cleanup()
  })

  test('F6-T10: 10 parallel TODO→IN_PROGRESS — exactly 1 succeeds, 9 get 409 STATUS_UNCHANGED', async (t) => {
    if (ctx.skipped) return t.skip(ctx.reason)

    const { world, httpClient, client, runId } = ctx
    const { activeTerm, teamA, actors } = world
    const DIRECTOR = actors.DIRECTOR
    const ASSIGNEE_A = actors.ASSIGNEE_A

    // Create a fresh task starting at TODO
    const createRes = await httpClient.asUser(DIRECTOR.user.user_id).post(BASE, {
      panel_term_id: activeTerm.panel_term_id,
      team_id: teamA.team_id,
      task_title: 'Concurrency Test Task 1',
      panel_membership_ids: [ASSIGNEE_A.membership.panel_membership_id],
    })
    assert.equal(createRes.status, 201, `Create failed: ${JSON.stringify(createRes.body)}`)
    const taskId = createRes.body.data.task_id

    // Fire 10 parallel transitions: all TODO → IN_PROGRESS
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        httpClient.asUser(DIRECTOR.user.user_id).patch(`${BASE}/${taskId}/status`, {
          to_status: 'IN_PROGRESS',
        })
      )
    )

    const successes = results.filter((r) => r.status === 200)
    const conflicts = results.filter((r) => r.status === 409)

    assert.equal(successes.length, 1, `Expected exactly 1 success, got ${successes.length}`)
    assert.equal(conflicts.length, 9, `Expected exactly 9 conflicts, got ${conflicts.length}`)

    for (const c of conflicts) {
      assert.equal(c.body.error?.code, 'STATUS_UNCHANGED', `Expected STATUS_UNCHANGED, got: ${c.body.error?.code}`)
    }

    // Exactly 1 history row for this transition (create history row + 1 transition = 2 total)
    const histRes = await client.query(
      `SELECT * FROM adm_task_status_history WHERE task_id = $1 ORDER BY task_status_history_id ASC`,
      [taskId]
    )
    assert.equal(histRes.rows.length, 2, `Expected 2 history rows (create + one transition), got ${histRes.rows.length}`)
    assert.equal(histRes.rows[0].from_status, null)
    assert.equal(histRes.rows[0].to_status, 'TODO')
    assert.equal(histRes.rows[1].from_status, 'TODO')
    assert.equal(histRes.rows[1].to_status, 'IN_PROGRESS')
  })

  test('F6-T11: Mixed concurrent transitions maintain I1 — final status is always valid', async (t) => {
    if (ctx.skipped) return t.skip(ctx.reason)

    const { world, httpClient, client } = ctx
    const { activeTerm, teamA, actors } = world
    const DIRECTOR = actors.DIRECTOR
    const ASSIGNEE_A = actors.ASSIGNEE_A
    const ASSIGNEE_B = actors.ASSIGNEE_B

    // Create task starting at TODO
    const createRes = await httpClient.asUser(DIRECTOR.user.user_id).post(BASE, {
      panel_term_id: activeTerm.panel_term_id,
      team_id: teamA.team_id,
      task_title: 'Concurrency Test Task 2 Mixed',
      panel_membership_ids: [
        ASSIGNEE_A.membership.panel_membership_id,
        ASSIGNEE_B.membership.panel_membership_id,
      ],
    })
    assert.equal(createRes.status, 201, `Create failed: ${JSON.stringify(createRes.body)}`)
    const taskId = createRes.body.data.task_id

    // First get it into IN_PROGRESS so concurrent requests don't all fail immediately
    const moveRes = await httpClient.asUser(DIRECTOR.user.user_id).patch(`${BASE}/${taskId}/status`, {
      to_status: 'IN_PROGRESS',
    })
    assert.equal(moveRes.status, 200)

    // Fire mixed concurrent transitions — some will win, some will conflict
    const mixedTransitions = [
      // 5 → BLOCKED (with reason)
      ...Array.from({ length: 5 }, () =>
        httpClient.asUser(ASSIGNEE_A.user.user_id).patch(`${BASE}/${taskId}/status`, {
          to_status: 'BLOCKED',
          reason: 'Concurrent block reason',
        })
      ),
      // 5 → DONE
      ...Array.from({ length: 5 }, () =>
        httpClient.asUser(ASSIGNEE_B.user.user_id).patch(`${BASE}/${taskId}/status`, {
          to_status: 'DONE',
        })
      ),
    ]

    const results = await Promise.all(mixedTransitions)

    // Count successes and expected conflicts
    const successes = results.filter((r) => r.status === 200)
    const conflicts = results.filter((r) => r.status === 409)

    // Exactly one winner
    assert.equal(successes.length, 1, `Expected 1 winner from mixed concurrent transitions, got ${successes.length}`)
    assert.equal(conflicts.length, 9, `Expected 9 conflicts, got ${conflicts.length}`)

    // I1: final task status must be a valid status
    const taskRow = await client.query(`SELECT status, blocked_reason, completed_at FROM adm_tasks WHERE task_id = $1`, [taskId])
    const finalTask = taskRow.rows[0]

    const validStatuses = new Set(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'])
    assert.ok(validStatuses.has(finalTask.status), `I1 violation: invalid final status '${finalTask.status}'`)

    // I2: blocked_reason must be null unless BLOCKED
    if (finalTask.status !== 'BLOCKED') {
      assert.equal(finalTask.blocked_reason, null, 'I2 violation: blocked_reason should be null')
    }

    // I3: completed_at must be null unless DONE
    if (finalTask.status !== 'DONE') {
      assert.equal(finalTask.completed_at, null, 'I3 violation: completed_at should be null')
    }
  })
})
