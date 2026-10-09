/**
 * mappers.js — Database Row to API Object Mappers
 * 
 * Safely converts PostgreSQL BIGINT string identifiers and count strings to Numbers,
 * while preserving nulls and ISO date strings.
 */

/**
 * Converts a BIGINT/numeric value to a JS Number, or null if null/undefined.
 */
export function toInt(value) {
  if (value === null || value === undefined) return null
  const num = Number(value)
  return Number.isNaN(num) ? null : num
}

/**
 * Maps an adm_tasks database row to the API task representation.
 */
export function mapTaskRow(row) {
  if (!row) return null

  return {
    task_id: toInt(row.task_id),
    panel_term_id: toInt(row.panel_term_id),
    team_id: toInt(row.team_id),
    assigner_membership_id: toInt(row.assigner_membership_id),
    task_title: row.task_title,
    task_description: row.task_description ?? null,
    priority: row.priority,
    status: row.status,
    due_at: row.due_at ? new Date(row.due_at).toISOString() : null,
    blocked_reason: row.blocked_reason ?? null,
    completed_at: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    // Optional enriched fields if joined
    team_name: row.team_name ?? undefined,
    assigner_name: row.assigner_name ?? undefined,
    assigner_position: row.assigner_position ?? undefined,
    assignees: Array.isArray(row.assignees) ? row.assignees.map(mapAssigneeRow) : undefined,
  }
}

/**
 * Maps an adm_task_assignees database row to the API representation.
 */
export function mapAssigneeRow(row) {
  if (!row) return null

  return {
    task_assignee_id: toInt(row.task_assignee_id),
    task_id: toInt(row.task_id),
    panel_membership_id: toInt(row.panel_membership_id),
    assigned_by_user_id: toInt(row.assigned_by_user_id),
    assigned_at: row.assigned_at ? new Date(row.assigned_at).toISOString() : null,
    status: row.status,
    // Optional enriched member/position fields
    member_id: toInt(row.member_id),
    member_name: row.member_name ?? undefined,
    student_id: row.student_id ?? row.member_code ?? undefined,
    position_id: toInt(row.position_id),
    position_title: row.position_title ?? row.position_name ?? undefined,
    team_id: toInt(row.team_id),
    team_name: row.team_name ?? undefined,
  }
}

/**
 * Maps an adm_task_status_history database row.
 */
export function mapStatusHistoryRow(row) {
  if (!row) return null

  return {
    task_status_history_id: toInt(row.task_status_history_id),
    task_id: toInt(row.task_id),
    from_status: row.from_status ?? null,
    to_status: row.to_status,
    changed_by_user_id: toInt(row.changed_by_user_id),
    changed_by_user_name: row.changed_by_user_name ?? undefined,
    reason: row.reason ?? null,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
  }
}

/**
 * Maps an eligible assignee candidate row for the eligible assignees list.
 */
export function mapEligibleAssigneeRow(row) {
  if (!row) return null

  return {
    panel_membership_id: toInt(row.panel_membership_id),
    panel_term_id: toInt(row.panel_term_id),
    member_id: toInt(row.member_id),
    member_name: row.member_name,
    student_id: row.student_id ?? row.member_code ?? null,
    position_id: toInt(row.position_id),
    position_title: row.position_title ?? row.position_name,
    team_id: toInt(row.team_id),
    team_name: row.team_name,
    status: row.status,
  }
}
