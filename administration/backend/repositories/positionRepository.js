import { query } from '../../../shared-features/backend/database/db.js'

/**
 * Return all positions ordered by hierarchy_level ASC, sort_order ASC.
 * Higher hierarchy_level = more senior in the org.
 */
export async function findAll() {
  const sql = `
    SELECT
      position_id,
      position_key,
      position_name,
      hierarchy_level,
      sort_order,
      can_assign_tasks,
      status,
      created_at,
      updated_at
    FROM adm_positions
    ORDER BY hierarchy_level DESC, sort_order ASC, position_name ASC
  `
  const result = await query(sql)
  return result.rows
}

/**
 * Return a single position by primary key, or null if not found.
 * @param {number|string} id
 */
export async function findById(id) {
  const sql = `
    SELECT
      position_id,
      position_key,
      position_name,
      hierarchy_level,
      sort_order,
      can_assign_tasks,
      status,
      created_at,
      updated_at
    FROM adm_positions
    WHERE position_id = $1
  `
  const result = await query(sql, [id])
  return result.rows[0] ?? null
}

/**
 * Insert a new position and return the created row.
 * @param {{ position_key: string, position_name: string, hierarchy_level?: number, sort_order?: number, can_assign_tasks?: boolean, status?: string }} data
 */
export async function create(data) {
  const {
    position_key,
    position_name,
    hierarchy_level = 0,
    sort_order = 0,
    can_assign_tasks = false,
    status = 'ACTIVE',
  } = data

  const sql = `
    INSERT INTO adm_positions
      (position_key, position_name, hierarchy_level, sort_order, can_assign_tasks, status)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING
      position_id,
      position_key,
      position_name,
      hierarchy_level,
      sort_order,
      can_assign_tasks,
      status,
      created_at,
      updated_at
  `
  const result = await query(sql, [
    position_key,
    position_name,
    hierarchy_level,
    sort_order,
    can_assign_tasks,
    status,
  ])
  return result.rows[0]
}

/**
 * Update mutable fields on a position. Returns updated row or null if not found.
 * @param {number|string} id
 * @param {object} data
 */
export async function update(id, data) {
  const fields = []
  const values = []
  let idx = 1

  if (data.position_key !== undefined) { fields.push(`position_key = $${idx++}`); values.push(data.position_key) }
  if (data.position_name !== undefined) { fields.push(`position_name = $${idx++}`); values.push(data.position_name) }
  if (data.hierarchy_level !== undefined) { fields.push(`hierarchy_level = $${idx++}`); values.push(data.hierarchy_level) }
  if (data.sort_order !== undefined) { fields.push(`sort_order = $${idx++}`); values.push(data.sort_order) }
  if (data.can_assign_tasks !== undefined) { fields.push(`can_assign_tasks = $${idx++}`); values.push(data.can_assign_tasks) }
  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status) }

  if (fields.length === 0) return findById(id)

  values.push(id)
  const sql = `
    UPDATE adm_positions
    SET ${fields.join(', ')}
    WHERE position_id = $${idx}
    RETURNING
      position_id,
      position_key,
      position_name,
      hierarchy_level,
      sort_order,
      can_assign_tasks,
      status,
      created_at,
      updated_at
  `
  const result = await query(sql, values)
  return result.rows[0] ?? null
}

/**
 * Set a position's status to ACTIVE or INACTIVE.
 * @param {number|string} id
 * @param {'ACTIVE'|'INACTIVE'} status
 */
export async function setStatus(id, status) {
  const sql = `
    UPDATE adm_positions
    SET status = $1
    WHERE position_id = $2
    RETURNING
      position_id,
      position_key,
      position_name,
      hierarchy_level,
      sort_order,
      can_assign_tasks,
      status,
      created_at,
      updated_at
  `
  const result = await query(sql, [status, id])
  return result.rows[0] ?? null
}
