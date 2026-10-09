/**
 * seed.js — Idempotent Seed Script for Admin Tasks Dev Harness
 * 
 * Populates deterministic rows in the test database for manual testing.
 * Strictly verifies the safety guard before executing.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { verifySafetyGuard } from '../setup/guard.js'

const { Pool } = pg

// 1. Safety Guard Verification
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../')
const devEnvPath = path.join(rootDir, '.env')
let devEnvContent = null
if (fs.existsSync(devEnvPath)) {
  try {
    devEnvContent = fs.readFileSync(devEnvPath, 'utf8')
  } catch {
    // Ignore
  }
}

verifySafetyGuard({
  nodeEnv: process.env.NODE_ENV || 'test',
  testDbUrl: process.env.DATABASE_URL,
  devEnvContent,
})

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export async function runSeed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    console.log('[SEED] Starting idempotent seed for Admin Tasks harness...')

    // 1. Active Panel Term
    const termRes = await client.query(
      `INSERT INTO adm_panel_terms (panel_title, start_date, end_date, status, notes)
       VALUES ('SEED Executive Panel 2025-2026', '2025-07-01', '2026-06-30', 'ACTIVE', 'SEED_ROW')
       ON CONFLICT (panel_title) DO UPDATE
       SET status = 'ACTIVE'
       RETURNING panel_term_id`
    )
    const termId = termRes.rows[0].panel_term_id

    // 2. Teams
    const teamSpecs = [
      { key: 'SEED_TEAM_SW', name: 'SEED Software & Autonomous Systems', desc: 'Robotics Software' },
      { key: 'SEED_TEAM_HW', name: 'SEED Hardware, Embedded & Robotics', desc: 'Robotics Hardware' },
    ]
    const teams = {}
    for (const t of teamSpecs) {
      const res = await client.query(
        `INSERT INTO adm_teams (team_key, team_name, description, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         ON CONFLICT (team_key) DO UPDATE
         SET team_name = EXCLUDED.team_name
         RETURNING team_id`,
        [t.key, t.name, t.desc]
      )
      teams[t.key] = res.rows[0].team_id
    }

    // 3. Positions ladder
    const posSpecs = [
      { key: 'SEED_POS_PRESIDENT', name: 'SEED President', level: 100, canAssign: true },
      { key: 'SEED_POS_VP', name: 'SEED Vice President', level: 90, canAssign: true },
      { key: 'SEED_POS_GEN_SEC', name: 'SEED General Secretary', level: 80, canAssign: true },
      { key: 'SEED_POS_JOINT_SEC', name: 'SEED Joint Secretary', level: 70, canAssign: true },
      { key: 'SEED_POS_DIR', name: 'SEED Director', level: 50, canAssign: true },
      { key: 'SEED_POS_ASST_DIR', name: 'SEED Assistant Director', level: 40, canAssign: true },
      { key: 'SEED_POS_DEPUTY', name: 'SEED Deputy Executive', level: 30, canAssign: true },
      { key: 'SEED_POS_SR_SUB', name: 'SEED Senior Sub Executive', level: 20, canAssign: true },
      { key: 'SEED_POS_SUB', name: 'SEED Sub Executive', level: 10, canAssign: false },
      { key: 'SEED_POS_UNRANKED', name: 'SEED Unranked Position', level: 0, canAssign: false },
    ]
    const positions = {}
    for (const p of posSpecs) {
      const res = await client.query(
        `INSERT INTO adm_positions (position_key, position_name, hierarchy_level, sort_order, can_assign_tasks, status)
         VALUES ($1, $2, $3, $3, $4, 'ACTIVE')
         ON CONFLICT (position_key) DO UPDATE
         SET hierarchy_level = EXCLUDED.hierarchy_level,
             can_assign_tasks = EXCLUDED.can_assign_tasks
         RETURNING position_id`,
        [p.key, p.name, p.level, p.canAssign]
      )
      positions[p.key] = res.rows[0].position_id
    }

    // 4. Users and Members (~12 members)
    const memberSpecs = [
      { alias: 'president', name: 'Preston President', posKey: 'SEED_POS_PRESIDENT', teamKey: 'SEED_TEAM_SW' },
      { alias: 'vp', name: 'Vera Vice President', posKey: 'SEED_POS_VP', teamKey: 'SEED_TEAM_SW' },
      { alias: 'gen_sec', name: 'George General Secretary', posKey: 'SEED_POS_GEN_SEC', teamKey: 'SEED_TEAM_SW' },
      { alias: 'joint_sec', name: 'Jessica Joint Secretary', posKey: 'SEED_POS_JOINT_SEC', teamKey: 'SEED_TEAM_SW' },
      { alias: 'director', name: 'Alice Director', posKey: 'SEED_POS_DIR', teamKey: 'SEED_TEAM_SW' },
      { alias: 'asst_dir', name: 'Bob Asst Director', posKey: 'SEED_POS_ASST_DIR', teamKey: 'SEED_TEAM_SW' },
      { alias: 'deputy', name: 'Charlie Deputy', posKey: 'SEED_POS_DEPUTY', teamKey: 'SEED_TEAM_HW' },
      { alias: 'sr_sub', name: 'David Senior Sub', posKey: 'SEED_POS_SR_SUB', teamKey: 'SEED_TEAM_SW' },
      { alias: 'sub1', name: 'Emma Sub Exec', posKey: 'SEED_POS_SUB', teamKey: 'SEED_TEAM_SW' },
      { alias: 'sub2', name: 'Frank Sub Exec', posKey: 'SEED_POS_SUB', teamKey: 'SEED_TEAM_HW' },
      { alias: 'dual', name: 'Grace Dual Member', posKey: 'SEED_POS_ASST_DIR', teamKey: 'SEED_TEAM_SW' }, // Also sub exec
      { alias: 'unranked', name: 'Henry Unranked', posKey: 'SEED_POS_UNRANKED', teamKey: 'SEED_TEAM_HW' },
    ]

    const seededMemberships = {}
    for (let i = 0; i < memberSpecs.length; i++) {
      const m = memberSpecs[i]
      const email = `seed_${m.alias}@austrc.local`
      const memCode = `SEED_MEM_${String(i + 1).padStart(2, '0')}`

      const userRes = await client.query(
        `INSERT INTO core_users (email, password_hash, auth_provider, status)
         VALUES ($1, 'seed_hash', 'LOCAL', 'ACTIVE')
         ON CONFLICT (email) DO UPDATE SET status = 'ACTIVE'
         RETURNING user_id`,
        [email]
      )
      const userId = userRes.rows[0].user_id

      const memberRes = await client.query(
        `INSERT INTO core_members (user_id, member_code, member_name, primary_email, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         ON CONFLICT (member_code) DO UPDATE SET member_name = EXCLUDED.member_name
         RETURNING member_id`,
        [userId, memCode, m.name, email]
      )
      const memberId = memberRes.rows[0].member_id

      const memRes = await client.query(
        `INSERT INTO adm_panel_memberships (panel_term_id, member_id, position_id, team_id, appointed_at, status, notes)
         VALUES ($1, $2, $3, $4, '2025-07-01', 'ACTIVE', 'SEED_ROW')
         ON CONFLICT (panel_term_id, member_id, position_id, team_id, appointed_at) DO UPDATE
         SET status = 'ACTIVE', notes = 'SEED_ROW'
         RETURNING panel_membership_id`,
        [termId, memberId, positions[m.posKey], teams[m.teamKey]]
      )
      seededMemberships[m.alias] = {
        userId,
        memberId,
        membershipId: memRes.rows[0].panel_membership_id,
      }

      // If dual, add second membership for Grace
      if (m.alias === 'dual') {
        const dualSubRes = await client.query(
          `INSERT INTO adm_panel_memberships (panel_term_id, member_id, position_id, team_id, appointed_at, status, notes)
           VALUES ($1, $2, $3, $4, '2025-08-01', 'ACTIVE', 'SEED_ROW')
           ON CONFLICT (panel_term_id, member_id, position_id, team_id, appointed_at) DO UPDATE
           SET status = 'ACTIVE', notes = 'SEED_ROW'
           RETURNING panel_membership_id`,
          [termId, memberId, positions['SEED_POS_SUB'], teams['SEED_TEAM_HW']]
        )
        seededMemberships['dual_secondary'] = {
          userId,
          memberId,
          membershipId: dualSubRes.rows[0].panel_membership_id,
        }
      }
    }

    // 5. Realistic Seed Tasks
    // Task 1: Autonomous Navigation
    const task1Res = await client.query(
      `INSERT INTO adm_tasks (panel_term_id, team_id, assigner_membership_id, task_title, task_description, priority, status, due_at)
       VALUES ($1, $2, $3, 'SEED Task: Autonomous Navigation Pipeline', 'Implement LiDAR SLAM and path planning', 'HIGH', 'TODO', NOW() + interval '7 days')
       RETURNING task_id`,
      [termId, teams['SEED_TEAM_SW'], seededMemberships['director'].membershipId]
    )
    const task1Id = task1Res.rows[0].task_id

    // Assignees for Task 1
    await client.query(
      `INSERT INTO adm_task_assignees (task_id, panel_membership_id, assigned_by_user_id, status)
       VALUES ($1, $2, $3, 'ASSIGNED')
       ON CONFLICT (task_id, panel_membership_id) DO NOTHING`,
      [task1Id, seededMemberships['sub1'].membershipId, seededMemberships['director'].userId]
    )
    await client.query(
      `INSERT INTO adm_task_assignees (task_id, panel_membership_id, assigned_by_user_id, status)
       VALUES ($1, $2, $3, 'ASSIGNED')
       ON CONFLICT (task_id, panel_membership_id) DO NOTHING`,
      [task1Id, seededMemberships['sr_sub'].membershipId, seededMemberships['director'].userId]
    )

    // History for Task 1
    await client.query(
      `INSERT INTO adm_task_status_history (task_id, from_status, to_status, changed_by_user_id, reason)
       VALUES ($1, NULL, 'TODO', $2, 'Initial task creation')`,
      [task1Id, seededMemberships['director'].userId]
    )

    // Task 2: Motor Driver Assembly
    const task2Res = await client.query(
      `INSERT INTO adm_tasks (panel_term_id, team_id, assigner_membership_id, task_title, task_description, priority, status, due_at)
       VALUES ($1, $2, $3, 'SEED Task: Motor Driver PCB Assembly', 'Solder SMD components on rev 2 board', 'MEDIUM', 'IN_PROGRESS', NOW() + interval '3 days')
       RETURNING task_id`,
      [termId, teams['SEED_TEAM_HW'], seededMemberships['deputy'].membershipId]
    )
    const task2Id = task2Res.rows[0].task_id

    await client.query(
      `INSERT INTO adm_task_assignees (task_id, panel_membership_id, assigned_by_user_id, status)
       VALUES ($1, $2, $3, 'ASSIGNED')
       ON CONFLICT (task_id, panel_membership_id) DO NOTHING`,
      [task2Id, seededMemberships['sub2'].membershipId, seededMemberships['deputy'].userId]
    )

    await client.query(
      `INSERT INTO adm_task_status_history (task_id, from_status, to_status, changed_by_user_id, reason)
       VALUES ($1, NULL, 'TODO', $2, 'Created by Deputy'),
              ($1, 'TODO', 'IN_PROGRESS', $2, 'Work started by team')`,
      [task2Id, seededMemberships['deputy'].userId]
    )

    await client.query('COMMIT')
    console.log('[SEED] Success: Admin Tasks seed data populated.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[SEED] Error seeding data:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

// Run directly when invoked from CLI
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runSeed().catch(() => process.exit(1))
}
