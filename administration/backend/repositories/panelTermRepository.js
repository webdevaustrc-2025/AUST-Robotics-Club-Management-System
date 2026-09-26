import { query } from '../../../shared-features/backend/database/db.js'

/**
 * Return all panel terms ordered newest first (by start_date desc, then created_at desc).
 */
export async function findAll() {
  const sql = `
    SELECT
      panel_term_id,
      panel_title,
      start_date,
      end_date,
      status,
      notes,
      created_at,
      updated_at
    FROM adm_panel_terms
    ORDER BY start_date DESC, created_at DESC
  `
  const result = await query(sql)
  return result.rows
}

/**
 * Return a single panel term by primary key, or null if not found.
 * @param {number|string} id
 */
export async function findById(id) {
  const sql = `
    SELECT
      panel_term_id,
      panel_title,
      start_date,
      end_date,
      status,
      notes,
      created_at,
      updated_at
    FROM adm_panel_terms
    WHERE panel_term_id = $1
  `
  const result = await query(sql, [id])
  return result.rows[0] ?? null
}

/**
 * Insert a new panel term and return the created row.
 * @param {{ panel_title: string, start_date: string, end_date: string, status?: string, notes?: string }} data
 */
export async function create(data) {
  const { panel_title, start_date, end_date, status = 'PLANNED', notes = null } = data
  const sql = `
    INSERT INTO adm_panel_terms (panel_title, start_date, end_date, status, notes)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      panel_term_id,
      panel_title,
      start_date,
      end_date,
      status,
      notes,
      created_at,
      updated_at
  `
  const result = await query(sql, [panel_title, start_date, end_date, status, notes])
  return result.rows[0]
}

/**
 * Update mutable fields on a panel term. Returns updated row or null if not found.
 * @param {number|string} id
 * @param {{ panel_title?: string, start_date?: string, end_date?: string, status?: string, notes?: string }} data
 */
export async function update(id, data) {
  // Build SET clause dynamically from provided keys only.
  const fields = []
  const values = []
  let idx = 1

  if (data.panel_title !== undefined) { fields.push(`panel_title = $${idx++}`); values.push(data.panel_title) }
  if (data.start_date !== undefined) { fields.push(`start_date = $${idx++}`); values.push(data.start_date) }
  if (data.end_date !== undefined) { fields.push(`end_date = $${idx++}`); values.push(data.end_date) }
  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status) }
  if (data.notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(data.notes) }

  if (fields.length === 0) return findById(id)

  values.push(id)
  const sql = `
    UPDATE adm_panel_terms
    SET ${fields.join(', ')}
    WHERE panel_term_id = $${idx}
    RETURNING
      panel_term_id,
      panel_title,
      start_date,
      end_date,
      status,
      notes,
      created_at,
      updated_at
  `
  const result = await query(sql, values)
  return result.rows[0] ?? null
}

/**
 * Set a panel term's status to ARCHIVED (soft delete — preserves FK integrity for adm_panel_memberships).
 * @param {number|string} id
 */
export async function archive(id) {
  const sql = `
    UPDATE adm_panel_terms
    SET status = 'ARCHIVED'
    WHERE panel_term_id = $1
    RETURNING
      panel_term_id,
      panel_title,
      start_date,
      end_date,
      status,
      notes,
      created_at,
      updated_at
  `
  const result = await query(sql, [id])
  return result.rows[0] ?? null
}
