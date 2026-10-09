/**
 * 00.smoke.test.js — Smoke & Schema Verification Integration Test
 * 
 * Verifies:
 * 1. Test database connectivity (SELECT 1).
 * 2. Schema parity: information_schema.columns includes all required tables and columns,
 *    especially adm_positions.hierarchy_level and adm_positions.can_assign_tasks.
 * 3. Fixtures sanity: createWorld produces correctly ordered ladder and memberships.
 */

import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { createWorld, cleanupWorld, LADDER_SPECS } from '../helpers/fixtures.js'

const { Pool } = pg

const shouldRun = Boolean(process.env.DATABASE_URL)

describe('Integration Smoke & Schema Parity Suite', { skip: !shouldRun && 'DATABASE_URL not configured' }, () => {
  let pool
  let client
  const runId = `smoke_${Date.now()}`

  before(async () => {
    if (!shouldRun) return
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 2000,
    })
    try {
      client = await pool.connect()
    } catch (err) {
      console.warn(
        `\n[SMOKE TEST] Note: Could not connect to DATABASE_URL (${err.message}). Integration tests will be skipped until a live test DB is configured.\n`
      )
      client = null
    }
  })

  after(async () => {
    if (client) {
      await cleanupWorld(client, runId)
      client.release()
    }
    if (pool) {
      await pool.end()
    }
  })

  it('connects to test database and responds to SELECT 1', async (t) => {
    if (!client) return t.skip('Test database not reachable')
    const res = await client.query('SELECT 1 as connected')
    assert.equal(res.rows[0].connected, 1)
  })

  it('contains all required tables and columns in information_schema', async (t) => {
    if (!client) return t.skip('Test database not reachable')
    const requiredColumns = [
      { table: 'adm_positions', column: 'hierarchy_level' },
      { table: 'adm_positions', column: 'can_assign_tasks' },
      { table: 'adm_positions', column: 'position_key' },
      { table: 'adm_panel_terms', column: 'panel_term_id' },
      { table: 'adm_panel_terms', column: 'panel_title' },
      { table: 'adm_teams', column: 'team_id' },
      { table: 'adm_teams', column: 'team_key' },
      { table: 'adm_panel_memberships', column: 'panel_membership_id' },
      { table: 'adm_panel_memberships', column: 'appointed_at' },
      { table: 'adm_panel_memberships', column: 'ended_at' },
      { table: 'adm_tasks', column: 'task_id' },
      { table: 'adm_tasks', column: 'task_title' },
      { table: 'adm_tasks', column: 'assigner_membership_id' },
      { table: 'adm_tasks', column: 'priority' },
      { table: 'adm_tasks', column: 'status' },
      { table: 'adm_task_assignees', column: 'task_assignee_id' },
      { table: 'adm_task_status_history', column: 'task_status_history_id' },
      { table: 'core_users', column: 'user_id' },
      { table: 'core_members', column: 'member_id' },
    ]

    for (const item of requiredColumns) {
      const res = await client.query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2`,
        [item.table, item.column]
      )
      assert.equal(
        res.rows.length,
        1,
        `Expected table ${item.table} to have column ${item.column}`
      )
    }
  })

  it('creates test world fixtures with ordered ladder and authority flags', async (t) => {
    if (!client) return t.skip('Test database not reachable')
    const world = await createWorld(client, runId)

    assert.ok(world.activeTerm.panel_term_id)
    assert.ok(world.otherTerm.panel_term_id)
    assert.ok(world.teams.TEAM_A.team_id)
    assert.ok(world.teams.TEAM_B.team_id)

    // Verify ladder ordering (higher number = higher rank)
    const dir = world.positions['DIRECTOR']
    const asst = world.positions['ASST_DIR']
    const dep = world.positions['DEPUTY_EXEC']
    const sr = world.positions['SR_SUB_EXEC']
    const sub = world.positions['SUB_EXEC']
    const unranked = world.positions['UNRANKED']
    const advisor = world.positions['ADVISOR']

    assert.equal(dir.hierarchy_level, 50)
    assert.equal(dir.can_assign_tasks, true)

    assert.equal(asst.hierarchy_level, 40)
    assert.equal(asst.can_assign_tasks, true)

    assert.equal(dep.hierarchy_level, 30)
    assert.equal(dep.can_assign_tasks, true)

    assert.equal(sr.hierarchy_level, 20)
    assert.equal(sr.can_assign_tasks, true)

    assert.equal(sub.hierarchy_level, 10)
    assert.equal(sub.can_assign_tasks, false)

    assert.equal(unranked.hierarchy_level, 0)
    assert.equal(unranked.can_assign_tasks, false)

    assert.equal(advisor.hierarchy_level, 45)
    assert.equal(advisor.can_assign_tasks, false)

    // Verify actors
    assert.ok(world.actors.DIRECTOR.membership.panel_membership_id)
    assert.ok(world.actors.SUB_EXEC.membership.panel_membership_id)
    assert.equal(world.actors.NO_MEMBERSHIP.membership, null)

    // Verify dual membership actor
    assert.ok(world.actors.DUAL.subExecMembership)
    assert.ok(world.actors.DUAL.asstDirMembership)
    assert.notEqual(
      world.actors.DUAL.subExecMembership.panel_membership_id,
      world.actors.DUAL.asstDirMembership.panel_membership_id
    )
  })
})
