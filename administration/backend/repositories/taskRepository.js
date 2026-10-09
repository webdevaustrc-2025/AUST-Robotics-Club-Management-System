/**
 * taskRepository.js — Task Database Operations
 */

import { toInt } from '../utils/mappers.js'

function escapeLike(str) {
  return str.replace(/([%_\\])/g, '\\$1')
}

export async function create(
  client,
  { panel_term_id, team_id, assigner_membership_id, task_title, task_description = null, priority = 'MEDIUM', due_at = null }
) {
  const query = `
    INSERT INTO adm_tasks (
      panel_term_id,
      team_id,
      assigner_membership_id,
      task_title,
      task_description,
      priority,
      status,
      due_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'TODO', $7)
    RETURNING *
  `
  const result = await client.query(query, [
    panel_term_id,
    team_id,
    assigner_membership_id,
    task_title,
    task_description,
    priority,
    due_at,
  ])
  return result.rows[0]
}

export async function findById(client, taskId) {
  const query = `
    SELECT
      t.*,
      tm.team_name,
      mem.member_name AS assigner_name,
      p.position_name AS assigner_position
    FROM adm_tasks t
    JOIN adm_teams tm ON t.team_id = tm.team_id
    JOIN adm_panel_memberships m ON t.assigner_membership_id = m.panel_membership_id
    JOIN core_members mem ON m.member_id = mem.member_id
    JOIN adm_positions p ON m.position_id = p.position_id
    WHERE t.task_id = $1
  `
  const result = await client.query(query, [taskId])
  return result.rows[0] || null
}

export async function findByIdForUpdate(client, taskId) {
  const query = `
    SELECT task_id, status, assigner_membership_id, panel_term_id, team_id
    FROM adm_tasks
    WHERE task_id = $1
    FOR UPDATE
  `
  const result = await client.query(query, [taskId])
  return result.rows[0] || null
}

export async function findAll(client, { filters = {}, visibility = {}, limit = 100, offset = 0 } = {}) {
  const conditions = []
  const params = []

  // Visibility: if not canViewAll, user only sees tasks they assigned or are assigned to
  if (!visibility.canViewAll) {
    const memIds = visibility.actorMembershipIds || []
    if (memIds.length === 0) {
      // User has no memberships -> sees nothing
      return { tasks: [], total: 0 }
    }
    params.push(memIds)
    conditions.push(`(
      t.assigner_membership_id = ANY($${params.length}::bigint[])
      OR t.task_id IN (
        SELECT task_id FROM adm_task_assignees WHERE panel_membership_id = ANY($${params.length}::bigint[])
      )
    )`)
  }

  // Filters
  if (filters.panel_term_id !== undefined && filters.panel_term_id !== null) {
    params.push(filters.panel_term_id)
    conditions.push(`t.panel_term_id = $${params.length}`)
  }

  if (filters.team_id !== undefined && filters.team_id !== null) {
    params.push(filters.team_id)
    conditions.push(`t.team_id = $${params.length}`)
  }

  if (filters.status) {
    params.push(filters.status)
    conditions.push(`t.status = $${params.length}`)
  }

  if (filters.priority) {
    params.push(filters.priority)
    conditions.push(`t.priority = $${params.length}`)
  }

  if (filters.search && typeof filters.search === 'string' && filters.search.trim()) {
    const escaped = `%${escapeLike(filters.search.trim())}%`
    params.push(escaped)
    conditions.push(`(t.task_title ILIKE $${params.length} OR COALESCE(t.task_description, '') ILIKE $${params.length})`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Total count query
  const countQuery = `SELECT COUNT(*)::bigint AS total FROM adm_tasks t ${whereClause}`
  const countResult = await client.query(countQuery, params)
  const total = toInt(countResult.rows[0]?.total) || 0

  if (total === 0) {
    return { tasks: [], total: 0 }
  }

  // Data query with sorting
  const dataParams = [...params, limit, offset]
  const limitIdx = dataParams.length - 1
  const offsetIdx = dataParams.length

  const dataQuery = `
    SELECT
      t.*,
      tm.team_name,
      mem.member_name AS assigner_name,
      p.position_name AS assigner_position
    FROM adm_tasks t
    JOIN adm_teams tm ON t.team_id = tm.team_id
    JOIN adm_panel_memberships m ON t.assigner_membership_id = m.panel_membership_id
    JOIN core_members mem ON m.member_id = mem.member_id
    JOIN adm_positions p ON m.position_id = p.position_id
    ${whereClause}
    ORDER BY t.created_at DESC, t.task_id DESC
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `
  const dataResult = await client.query(dataQuery, dataParams)

  return {
    tasks: dataResult.rows,
    total,
  }
}

export async function update(client, taskId, fields = {}) {
  const allowlist = ['task_title', 'task_description', 'priority', 'due_at', 'team_id']
  const setClauses = []
  const params = [taskId]

  for (const key of allowlist) {
    if (Object.prototype.hasOwnProperty.call(fields, key) && fields[key] !== undefined) {
      params.push(fields[key])
      setClauses.push(`${key} = $${params.length}`)
    }
  }

  if (setClauses.length === 0) return null

  const query = `
    UPDATE adm_tasks
    SET ${setClauses.join(', ')}
    WHERE task_id = $1
    RETURNING *
  `
  const result = await client.query(query, params)
  return result.rows[0] || null
}

export async function updateStatus(client, taskId, { status, blocked_reason = null, completed_at = null }) {
  const query = `
    UPDATE adm_tasks
    SET status = $2,
        blocked_reason = $3,
        completed_at = $4
    WHERE task_id = $1
    RETURNING *
  `
  const result = await client.query(query, [taskId, status, blocked_reason, completed_at])
  return result.rows[0] || null
}
