/**
 * Uses parameterized PostgreSQL queries via shared pool (db.js).
 * Matches canonical schema from current_schema.sql (lines 819–840).
 * Preserves historical records; supports joins with core_members, adm_positions, adm_teams, and adm_panel_terms.
  */

import { query } from '../../../shared-features/backend/database/db.js'

/**
 * Return a single membership by ID with fully joined related entities.
 * @param {number|string} id
 */
export async function findById(id) {
  const sql = `
    SELECT
      pm.panel_membership_id,
      pm.panel_term_id,
      pm.member_id,
      pm.position_id,
      pm.team_id,
      pm.appointed_at,
      pm.ended_at,
      pm.status,
      pm.notes,
      pm.created_at,
      pm.updated_at,
      cm.member_code,
      cm.member_name,
      cm.primary_email,
      pt.panel_title,
      pt.start_date AS term_start_date,
      pt.end_date AS term_end_date,
      pt.status AS term_status,
      pos.position_key,
      pos.position_name,
      pos.hierarchy_level,
      pos.sort_order,
      pos.can_assign_tasks,
      tm.team_key,
      tm.team_name
    FROM adm_panel_memberships pm
    JOIN core_members cm ON cm.member_id = pm.member_id
    JOIN adm_panel_terms pt ON pt.panel_term_id = pm.panel_term_id
    JOIN adm_positions pos ON pos.position_id = pm.position_id
    LEFT JOIN adm_teams tm ON tm.team_id = pm.team_id
    WHERE pm.panel_membership_id = $1
  `
  const result = await query(sql, [id])
  return result.rows[0] ?? null
}

/**
 * List all memberships for a given panel term .
 * @param {number|string} termId
 * @param {boolean} includeVoid - whether to include voided data-entry mistakes (default false)
 */
export async function findByTermId(termId, includeVoid = false) {
  const sql = `
    SELECT
      pm.panel_membership_id,
      pm.panel_term_id,
      pm.member_id,
      pm.position_id,
      pm.team_id,
      pm.appointed_at,
      pm.ended_at,
      pm.status,
      pm.notes,
      pm.created_at,
      pm.updated_at,
      cm.member_code,
      cm.member_name,
      cm.primary_email,
      pt.panel_title,
      pos.position_key,
      pos.position_name,
      pos.hierarchy_level,
      pos.sort_order,
      pos.can_assign_tasks,
      tm.team_key,
      tm.team_name
    FROM adm_panel_memberships pm
    JOIN core_members cm ON cm.member_id = pm.member_id
    JOIN adm_panel_terms pt ON pt.panel_term_id = pm.panel_term_id
    JOIN adm_positions pos ON pos.position_id = pm.position_id
    LEFT JOIN adm_teams tm ON tm.team_id = pm.team_id
    WHERE pm.panel_term_id = $1
      ${includeVoid ? '' : "AND pm.status <> 'VOID'"}
    ORDER BY pos.sort_order ASC, pos.hierarchy_level ASC, cm.member_name ASC
  `
  const result = await query(sql, [termId])
  return result.rows
}

/**
 * List full chronological membership history for a specific member.
 * Ordered newest term and appointment first.
 * @param {number|string} memberId
 */
export async function findByMemberId(memberId) {
  const sql = `
    SELECT
      pm.panel_membership_id,
      pm.panel_term_id,
      pm.member_id,
      pm.position_id,
      pm.team_id,
      pm.appointed_at,
      pm.ended_at,
      pm.status,
      pm.notes,
      pm.created_at,
      pm.updated_at,
      cm.member_code,
      cm.member_name,
      cm.primary_email,
      pt.panel_title,
      pt.start_date AS term_start_date,
      pt.end_date AS term_end_date,
      pt.status AS term_status,
      pos.position_key,
      pos.position_name,
      pos.hierarchy_level,
      pos.sort_order,
      pos.can_assign_tasks,
      tm.team_key,
      tm.team_name
    FROM adm_panel_memberships pm
    JOIN core_members cm ON cm.member_id = pm.member_id
    JOIN adm_panel_terms pt ON pt.panel_term_id = pm.panel_term_id
    JOIN adm_positions pos ON pos.position_id = pm.position_id
    LEFT JOIN adm_teams tm ON tm.team_id = pm.team_id
    WHERE pm.member_id = $1
      AND pm.status <> 'VOID'
    ORDER BY pt.start_date DESC, pm.appointed_at DESC
  `
  const result = await query(sql, [memberId])
  return result.rows
}

/**
 * Check if a member already has an active (unended) membership in a specific panel term.
 * @param {number|string} memberId
 * @param {number|string} termId
 */
export async function findActiveMembershipForMemberInTerm(memberId, termId) {
  const sql = `
    SELECT
      panel_membership_id,
      panel_term_id,
      member_id,
      position_id,
      team_id,
      status,
      appointed_at,
      ended_at
    FROM adm_panel_memberships
    WHERE member_id = $1
      AND panel_term_id = $2
      AND status = 'ACTIVE'
      AND (ended_at IS NULL OR ended_at > CURRENT_DATE)
    LIMIT 1
  `
  const result = await query(sql, [memberId, termId])
  return result.rows[0] ?? null
}

/**
 * Insert a new panel membership row.
 * @param {{ panel_term_id: number, member_id: number, position_id: number, team_id?: number|null, appointed_at: string, status?: string, notes?: string|null }} data
 */
export async function create(data) {
  const {
    panel_term_id,
    member_id,
    position_id,
    team_id = null,
    appointed_at,
    status = 'ACTIVE',
    notes = null,
  } = data

  const sql = `
    INSERT INTO adm_panel_memberships (
      panel_term_id,
      member_id,
      position_id,
      team_id,
      appointed_at,
      status,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING panel_membership_id
  `
  const result = await query(sql, [
    panel_term_id,
    member_id,
    position_id,
    team_id,
    appointed_at,
    status,
    notes,
  ])

  // Return full joined row
  return findById(result.rows[0].panel_membership_id)
}

/**
 * End an active membership (mid-term change or term completion) without deleting history.
 * @param {number|string} id
 * @param {{ ended_at: string, notes?: string|null }} data
 */
export async function endMembership(id, { ended_at, notes = null }) {
  const sql = `
    UPDATE adm_panel_memberships
    SET
      ended_at = $1,
      status = 'ENDED',
      notes = CASE WHEN $2::varchar IS NOT NULL THEN $2 ELSE notes END
    WHERE panel_membership_id = $3
    RETURNING panel_membership_id
  `
  const result = await query(sql, [ended_at, notes, id])
  if (result.rowCount === 0) return null
  return findById(result.rows[0].panel_membership_id)
}

/**
 * Void an erroneous membership entry (soft correction).
 * @param {number|string} id
 * @param {{ notes?: string|null }} data
 */
export async function voidMembership(id, { notes = null } = {}) {
  const sql = `
    UPDATE adm_panel_memberships
    SET
      status = 'VOID',
      notes = CASE WHEN $1::varchar IS NOT NULL THEN $1 ELSE notes END
    WHERE panel_membership_id = $2
    RETURNING panel_membership_id
  `
  const result = await query(sql, [notes, id])
  if (result.rowCount === 0) return null
  return findById(result.rows[0].panel_membership_id)
}

/**
 * Search official club members from core_members for assignment selection.
 * @param {string} [search]
 */
export async function searchOfficialMembers(search = '') {
  let sql = `
    SELECT
      member_id,
      member_code,
      member_name,
      primary_email,
      joined_at,
      status
    FROM core_members
    WHERE status = 'ACTIVE'
  `
  const values = []

  if (search && search.trim()) {
    values.push(`%${search.trim()}%`)
    sql += ` AND (member_name ILIKE $1 OR member_code ILIKE $1 OR primary_email ILIKE $1)`
  }

  sql += ` ORDER BY member_name ASC LIMIT 100`

  const result = await query(sql, values)
  return result.rows
}

/**
 * Find single official member by ID.
 * @param {number|string} memberId
 */
export async function findMemberById(memberId) {
  const sql = `
    SELECT
      member_id,
      member_code,
      member_name,
      primary_email,
      joined_at,
      status
    FROM core_members
    WHERE member_id = $1
  `
  const result = await query(sql, [memberId])
  return result.rows[0] ?? null
}
