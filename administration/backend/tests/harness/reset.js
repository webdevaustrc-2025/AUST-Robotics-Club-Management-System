/**
 * reset.js — Seed Reset Script for Admin Tasks Dev Harness
 * 
 * Safely removes only seeded rows in reverse FK order without affecting other data.
 * Strictly verifies safety guard before running.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { verifySafetyGuard } from '../setup/guard.js'

const { Pool } = pg

// Safety Guard Verification
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

export async function runReset() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    console.log('[RESET] Resetting Admin Tasks seed data...')

    // 1. Task status history
    await client.query(`
      DELETE FROM adm_task_status_history
      WHERE task_id IN (SELECT task_id FROM adm_tasks WHERE task_title LIKE 'SEED Task%')
    `)

    // 2. Task assignees
    await client.query(`
      DELETE FROM adm_task_assignees
      WHERE task_id IN (SELECT task_id FROM adm_tasks WHERE task_title LIKE 'SEED Task%')
         OR panel_membership_id IN (SELECT panel_membership_id FROM adm_panel_memberships WHERE notes = 'SEED_ROW')
    `)

    // 3. Tasks
    await client.query(`
      DELETE FROM adm_tasks
      WHERE task_title LIKE 'SEED Task%'
    `)

    // 4. Panel memberships
    await client.query(`
      DELETE FROM adm_panel_memberships
      WHERE notes = 'SEED_ROW'
         OR panel_term_id IN (SELECT panel_term_id FROM adm_panel_terms WHERE panel_title LIKE 'SEED %')
    `)

    // 5. Positions
    await client.query(`
      DELETE FROM adm_positions
      WHERE position_key LIKE 'SEED_POS_%'
    `)

    // 6. Teams
    await client.query(`
      DELETE FROM adm_teams
      WHERE team_key LIKE 'SEED_TEAM_%'
    `)

    // 7. Panel terms
    await client.query(`
      DELETE FROM adm_panel_terms
      WHERE panel_title LIKE 'SEED %'
    `)

    // 8. Core members
    await client.query(`
      DELETE FROM core_members
      WHERE member_code LIKE 'SEED_MEM_%'
    `)

    // 9. Core users
    await client.query(`
      DELETE FROM core_users
      WHERE email LIKE 'seed_%@austrc.local'
    `)

    await client.query('COMMIT')
    console.log('[RESET] Success: Admin Tasks seed data cleared.')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('[RESET] Error resetting seed data:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

if (process.argv[1] && process.argv[1].endsWith('reset.js')) {
  runReset().catch(() => process.exit(1))
}
