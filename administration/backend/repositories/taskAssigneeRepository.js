/**
 * taskAssigneeRepository.js — Task Assignees Database Access
 */

import { getActiveMembershipSql } from '../services/taskAccess.js'
import { toInt } from '../utils/mappers.js'

export async function findEligibleMemberships(client, { panel_term_id, team_id } = {}) {
  const params = [panel_term_id]
  let teamFilter = ''

  if (team_id !== undefined && team_id !== null) {
    params.push(team_id)
    teamFilter = `AND m.team_id = $${params.length}`
  }

  const query = `
    SELECT
      m.panel_membership_id,
      m.panel_term_id,
      m.member_id,
      p.hierarchy_level AS rank,
      mem.member_name,
      mem.member_code AS student_id,
      p.position_name AS position_title,
      m.team_id,
      t.team_name,
      m.status
    FROM adm_panel_memberships m
    JOIN core_members mem ON m.member_id = mem.member_id
    JOIN adm_positions p ON m.position_id = p.position_id
    LEFT JOIN adm_teams t ON m.team_id = t.team_id
    WHERE m.panel_term_id = $1
      AND ${getActiveMembershipSql('m')}
      ${teamFilter}
    ORDER BY p.hierarchy_level DESC, mem.member_name ASC, m.panel_membership_id ASC
  `

  const result = await client.query(query, params)
  return result.rows.map((r) => ({
    ...r,
    panel_membership_id: toInt(r.panel_membership_id),
    panel_term_id: toInt(r.panel_term_id),
    member_id: toInt(r.member_id),
    position_id: toInt(r.position_id),
    team_id: toInt(r.team_id),
    rank: toInt(r.rank) || 0,
  }))
}

export async function loadTargetsForAssignment(client, panelTermId, panelMembershipIds = []) {
  if (panelMembershipIds.length === 0) return []

  const query = `
    SELECT
      m.panel_membership_id,
      m.panel_term_id,
      m.member_id,
      p.hierarchy_level AS rank,
      m.status,
      m.ended_at,
      ${getActiveMembershipSql('m')} AS is_active
    FROM adm_panel_memberships m
    JOIN adm_positions p ON m.position_id = p.position_id
    WHERE m.panel_membership_id = ANY($1::bigint[])
  `

  const result = await client.query(query, [panelMembershipIds])
  return result.rows.map((r) => ({
    ...r,
    panel_membership_id: toInt(r.panel_membership_id),
    panel_term_id: toInt(r.panel_term_id),
    member_id: toInt(r.member_id),
    rank: toInt(r.rank) || 0,
    is_active: Boolean(r.is_active && Number(r.panel_term_id) === Number(panelTermId)),
  }))
}

export async function findAssigneesForTask(client, taskId) {
  const query = `
    SELECT
      a.task_assignee_id,
      a.task_id,
      a.panel_membership_id,
      a.assigned_by_user_id,
      a.assigned_at,
      a.status,
      mem.member_id,
      mem.member_name,
      mem.member_code AS student_id,
      p.position_id,
      p.position_name AS position_title,
      m.team_id,
      t.team_name
    FROM adm_task_assignees a
    JOIN adm_panel_memberships m ON a.panel_membership_id = m.panel_membership_id
    JOIN core_members mem ON m.member_id = mem.member_id
    JOIN adm_positions p ON m.position_id = p.position_id
    LEFT JOIN adm_teams t ON m.team_id = t.team_id
    WHERE a.task_id = $1
    ORDER BY a.assigned_at ASC, a.task_assignee_id ASC
  `
  const result = await client.query(query, [taskId])
  return result.rows
}

export async function findAssigneesForTasks(client, taskIds = []) {
  if (taskIds.length === 0) return new Map()

  const query = `
    SELECT
      a.task_assignee_id,
      a.task_id,
      a.panel_membership_id,
      a.assigned_by_user_id,
      a.assigned_at,
      a.status,
      mem.member_id,
      mem.member_name,
      mem.member_code AS student_id,
      p.position_id,
      p.position_name AS position_title,
      m.team_id,
      t.team_name
    FROM adm_task_assignees a
    JOIN adm_panel_memberships m ON a.panel_membership_id = m.panel_membership_id
    JOIN core_members mem ON m.member_id = mem.member_id
    JOIN adm_positions p ON m.position_id = p.position_id
    LEFT JOIN adm_teams t ON m.team_id = t.team_id
    WHERE a.task_id = ANY($1::bigint[])
    ORDER BY a.assigned_at ASC, a.task_assignee_id ASC
  `
  const result = await client.query(query, [taskIds])
  const map = new Map()
  for (const row of result.rows) {
    const tid = toInt(row.task_id)
    if (!map.has(tid)) {
      map.set(tid, [])
    }
    map.get(tid).push(row)
  }
  return map
}

export async function addAssignees(client, taskId, panelMembershipIds = [], assignedByUserId = null) {
  if (panelMembershipIds.length === 0) return []

  const inserted = []
  for (const membershipId of panelMembershipIds) {
    const query = `
      INSERT INTO adm_task_assignees (task_id, panel_membership_id, assigned_by_user_id, status)
      VALUES ($1, $2, $3, 'ASSIGNED')
      ON CONFLICT (task_id, panel_membership_id) DO NOTHING
      RETURNING *
    `
    const res = await client.query(query, [taskId, membershipId, assignedByUserId])
    if (res.rows.length > 0) {
      inserted.push(res.rows[0])
    }
  }
  return inserted
}

export async function removeAssignee(client, taskId, panelMembershipId) {
  const query = `
    DELETE FROM adm_task_assignees
    WHERE task_id = $1 AND panel_membership_id = $2
    RETURNING *
  `
  const result = await client.query(query, [taskId, panelMembershipId])
  return result.rows[0] || null
}

/**
 * Returns all panel_membership_ids for a user across all terms.
 * Used by the service layer to determine task visibility.
 */
export async function findMembershipIdsForUser(client, userId) {
  const query = `
    SELECT m.panel_membership_id
    FROM adm_panel_memberships m
    JOIN core_members mem ON m.member_id = mem.member_id
    WHERE mem.user_id = $1
  `
  const res = await client.query(query, [userId])
  return res.rows.map((r) => Number(r.panel_membership_id))
}
