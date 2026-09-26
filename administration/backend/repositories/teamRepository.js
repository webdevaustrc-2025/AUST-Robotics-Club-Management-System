import { query } from '../../../shared-features/backend/database/db.js'

/**
 * Return all teams ordered alphabetically by team_name.
 */
export async function findAll() {
  const sql = `
    SELECT
      team_id,
      team_key,
      team_name,
      description,
      status,
      created_at,
      updated_at
    FROM adm_teams
    ORDER BY team_name ASC
  `
  const result = await query(sql)
  return result.rows
}

/**
 * Return a single team by primary key, or null if not found.
 * @param {number|string} id
 */
export async function findById(id) {
  const sql = `
    SELECT
      team_id,
      team_key,
      team_name,
      description,
      status,
      created_at,
      updated_at
    FROM adm_teams
    WHERE team_id = $1
  `
  const result = await query(sql, [id])
  return result.rows[0] ?? null
}

/**
 * Insert a new team and return the created row.
 * @param {{ team_key: string, team_name: string, description?: string, status?: string }} data
 */
export async function create(data) {
  const { team_key, team_name, description = null, status = 'ACTIVE' } = data
  const sql = `
    INSERT INTO adm_teams (team_key, team_name, description, status)
    VALUES ($1, $2, $3, $4)
    RETURNING
      team_id,
      team_key,
      team_name,
      description,
      status,
      created_at,
      updated_at
  `
  const result = await query(sql, [team_key, team_name, description, status])
  return result.rows[0]
}

/**
 * Update mutable fields on a team. Returns updated row or null if not found.
 * @param {number|string} id
 * @param {object} data
 */
export async function update(id, data) {
  const fields = []
  const values = []
  let idx = 1

  if (data.team_key !== undefined) { fields.push(`team_key = $${idx++}`); values.push(data.team_key) }
  if (data.team_name !== undefined) { fields.push(`team_name = $${idx++}`); values.push(data.team_name) }
  if (data.description !== undefined) { fields.push(`description = $${idx++}`); values.push(data.description) }
  if (data.status !== undefined) { fields.push(`status = $${idx++}`); values.push(data.status) }

  if (fields.length === 0) return findById(id)

  values.push(id)
  const sql = `
    UPDATE adm_teams
    SET ${fields.join(', ')}
    WHERE team_id = $${idx}
    RETURNING
      team_id,
      team_key,
      team_name,
      description,
      status,
      created_at,
      updated_at
  `
  const result = await query(sql, values)
  return result.rows[0] ?? null
}

/**
 * Set a team's status to ACTIVE or INACTIVE.
 * @param {number|string} id
 * @param {'ACTIVE'|'INACTIVE'} status
 */
export async function setStatus(id, status) {
  const sql = `
    UPDATE adm_teams
    SET status = $1
    WHERE team_id = $2
    RETURNING
      team_id,
      team_key,
      team_name,
      description,
      status,
      created_at,
      updated_at
  `
  const result = await query(sql, [status, id])
  return result.rows[0] ?? null
}
