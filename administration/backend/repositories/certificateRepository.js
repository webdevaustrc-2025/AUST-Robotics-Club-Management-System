/**
 * Certificate Repository — adm_member_certificates
 *
 * Uses parameterized PostgreSQL queries via shared pool (db.js).
 * Matches canonical schema from current_schema.sql (lines 842–865).
 *
 * Snapshot discipline: snapshot fields (member_name_snapshot, term_snapshot,
 * position_snapshot, team_snapshot) are captured once at creation time and
 * are NEVER overwritten by later joins. This ensures historical accuracy even
 * if the underlying member/position/term/team records change later.
 *
 * Document integration: document_template_id and generated_document_id are
 * nullable FK integration points reserved for the future Shared/Core document
 * generation pipeline. This repository never writes to those columns directly —
 * only the Shared/Core layer may populate them.
 */

import { query } from '../../../shared-features/backend/database/db.js'

// ── Private helpers ──────────────────────────────────────────────────────────

/**
 * Base SELECT with all columns — used by findById and returned after mutations.
 * Does NOT join live member/position/term/team data — snapshots are sufficient.
 * @param {number|string} id
 * @returns {Promise<object|null>}
 */
async function _findById(id) {
  const sql = `
    SELECT
      mc.member_certificate_id,
      mc.panel_membership_id,
      mc.certificate_number,
      mc.document_template_id,
      mc.generated_document_id,
      mc.snapshot_date,
      mc.member_name_snapshot,
      mc.term_snapshot,
      mc.position_snapshot,
      mc.team_snapshot,
      mc.status,
      mc.issued_at,
      mc.available_at,
      mc.delivered_at,
      mc.created_at,
      mc.updated_at
    FROM adm_member_certificates mc
    WHERE mc.member_certificate_id = $1
  `
  const result = await query(sql, [id])
  return result.rows[0] ?? null
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Find a single certificate record by its primary key.
 * @param {number|string} id
 */
export async function findById(id) {
  return _findById(id)
}

/**
 * Find the certificate record for a given panel_membership_id.
 * Returns null if no certificate has been created for that membership yet.
 * @param {number|string} membershipId
 */
export async function findByMembershipId(membershipId) {
  const sql = `
    SELECT
      mc.member_certificate_id,
      mc.panel_membership_id,
      mc.certificate_number,
      mc.document_template_id,
      mc.generated_document_id,
      mc.snapshot_date,
      mc.member_name_snapshot,
      mc.term_snapshot,
      mc.position_snapshot,
      mc.team_snapshot,
      mc.status,
      mc.issued_at,
      mc.available_at,
      mc.delivered_at,
      mc.created_at,
      mc.updated_at
    FROM adm_member_certificates mc
    WHERE mc.panel_membership_id = $1
  `
  const result = await query(sql, [membershipId])
  return result.rows[0] ?? null
}

/**
 * List all certificate records for a given panel term.
 * Joins adm_panel_memberships to filter by term, but reads snapshot columns
 * from adm_member_certificates directly for display data.
 * @param {number|string} termId
 */
export async function findByTermId(termId) {
  const sql = `
    SELECT
      mc.member_certificate_id,
      mc.panel_membership_id,
      mc.certificate_number,
      mc.document_template_id,
      mc.generated_document_id,
      mc.snapshot_date,
      mc.member_name_snapshot,
      mc.term_snapshot,
      mc.position_snapshot,
      mc.team_snapshot,
      mc.status,
      mc.issued_at,
      mc.available_at,
      mc.delivered_at,
      mc.created_at,
      mc.updated_at
    FROM adm_member_certificates mc
    JOIN adm_panel_memberships pm ON pm.panel_membership_id = mc.panel_membership_id
    WHERE pm.panel_term_id = $1
    ORDER BY mc.member_name_snapshot ASC, mc.created_at ASC
  `
  const result = await query(sql, [termId])
  return result.rows
}

/**
 * List all memberships for a term that do NOT yet have a certificate record.
 * Used to populate the "issue certificate" action list for a term.
 * Returns full joined membership data (live) so the UI can show who is missing one.
 * @param {number|string} termId
 */
export async function findMembershipsWithoutCertificateByTerm(termId) {
  const sql = `
    SELECT
      pm.panel_membership_id,
      pm.panel_term_id,
      pm.member_id,
      pm.position_id,
      pm.team_id,
      pm.appointed_at,
      pm.ended_at,
      pm.status AS membership_status,
      cm.member_code,
      cm.member_name,
      cm.primary_email,
      pt.panel_title,
      pt.start_date AS term_start_date,
      pt.end_date   AS term_end_date,
      pos.position_name,
      pos.position_key,
      pos.hierarchy_level,
      tm.team_name,
      tm.team_key
    FROM adm_panel_memberships pm
    JOIN core_members cm   ON cm.member_id    = pm.member_id
    JOIN adm_panel_terms pt ON pt.panel_term_id = pm.panel_term_id
    JOIN adm_positions pos  ON pos.position_id  = pm.position_id
    LEFT JOIN adm_teams tm  ON tm.team_id       = pm.team_id
    WHERE pm.panel_term_id = $1
      AND pm.status <> 'VOID'
      AND NOT EXISTS (
        SELECT 1
        FROM adm_member_certificates mc
        WHERE mc.panel_membership_id = pm.panel_membership_id
      )
    ORDER BY pos.sort_order ASC, pos.hierarchy_level ASC, cm.member_name ASC
  `
  const result = await query(sql, [termId])
  return result.rows
}

/**
 * List all certificate records for a given member (across all terms).
 * Joins adm_panel_memberships to filter by member_id, but reads snapshot data
 * from adm_member_certificates — not live data.
 * @param {number|string} memberId
 */
export async function findByMemberId(memberId) {
  const sql = `
    SELECT
      mc.member_certificate_id,
      mc.panel_membership_id,
      mc.certificate_number,
      mc.document_template_id,
      mc.generated_document_id,
      mc.snapshot_date,
      mc.member_name_snapshot,
      mc.term_snapshot,
      mc.position_snapshot,
      mc.team_snapshot,
      mc.status,
      mc.issued_at,
      mc.available_at,
      mc.delivered_at,
      mc.created_at,
      mc.updated_at
    FROM adm_member_certificates mc
    JOIN adm_panel_memberships pm ON pm.panel_membership_id = mc.panel_membership_id
    WHERE pm.member_id = $1
    ORDER BY mc.snapshot_date DESC, mc.created_at DESC
  `
  const result = await query(sql, [memberId])
  return result.rows
}

/**
 * Insert a new certificate record.
 * Snapshot fields MUST be captured from the live membership at call time
 * by the service layer — this function receives them as plain strings and
 * stores them immutably.
 *
 * @param {{
 *   panel_membership_id: number,
 *   certificate_number:  string,
 *   snapshot_date:       string,   // YYYY-MM-DD
 *   member_name_snapshot: string,
 *   term_snapshot:        string,
 *   position_snapshot:    string,
 *   team_snapshot?:       string|null
 * }} data
 */
export async function create(data) {
  const {
    panel_membership_id,
    certificate_number,
    snapshot_date,
    member_name_snapshot,
    term_snapshot,
    position_snapshot,
    team_snapshot = null,
  } = data

  const sql = `
    INSERT INTO adm_member_certificates (
      panel_membership_id,
      certificate_number,
      snapshot_date,
      member_name_snapshot,
      term_snapshot,
      position_snapshot,
      team_snapshot,
      status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
    RETURNING member_certificate_id
  `
  const result = await query(sql, [
    panel_membership_id,
    certificate_number,
    snapshot_date,
    member_name_snapshot,
    term_snapshot,
    position_snapshot,
    team_snapshot,
  ])

  return _findById(result.rows[0].member_certificate_id)
}

/**
 * Update the status of a certificate record.
 * Also sets the corresponding timestamp column when transitioning to
 * ISSUED, AVAILABLE, or DELIVERED states.
 *
 * Allowed statuses (from schema DEFAULT and timestamp columns):
 *   PENDING  → ISSUED     (sets issued_at)
 *   ISSUED   → AVAILABLE  (sets available_at)
 *   AVAILABLE → DELIVERED (sets delivered_at)
 *
 * NOTE: document_template_id and generated_document_id are intentionally
 * NOT updated here — that is reserved for the Shared/Core document pipeline.
 * // TODO: Shared/Core integration point — populate generated_document_id
 * //        when the document generation pipeline completes its work.
 *
 * @param {number|string} id
 * @param {string} newStatus
 */
export async function updateStatus(id, newStatus) {
  // Set the appropriate timestamp based on the new status
  let timestampClause = ''
  if (newStatus === 'ISSUED') {
    timestampClause = ', issued_at = NOW()'
  } else if (newStatus === 'AVAILABLE') {
    timestampClause = ', available_at = NOW()'
  } else if (newStatus === 'DELIVERED') {
    timestampClause = ', delivered_at = NOW()'
  }

  const sql = `
    UPDATE adm_member_certificates
    SET status = $1${timestampClause}
    WHERE member_certificate_id = $2
    RETURNING member_certificate_id
  `
  const result = await query(sql, [newStatus, id])
  if (result.rowCount === 0) return null
  return _findById(result.rows[0].member_certificate_id)
}
