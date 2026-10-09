/**
 * taskStatusHistoryRepository.js — Task Status History Repository
 * 
 * Manages insert-only status history auditing.
 */

import { toInt } from '../utils/mappers.js'

export async function create(client, { task_id, from_status = null, to_status, changed_by_user_id = null, reason = null }) {
  const query = `
    INSERT INTO adm_task_status_history (
      task_id,
      from_status,
      to_status,
      changed_by_user_id,
      reason
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING task_status_history_id, task_id, from_status, to_status, changed_by_user_id, reason, created_at
  `
  const result = await client.query(query, [
    task_id,
    from_status,
    to_status,
    changed_by_user_id,
    reason,
  ])
  return result.rows[0]
}

export async function findByTaskId(client, taskId) {
  const query = `
    SELECT
      h.task_status_history_id,
      h.task_id,
      h.from_status,
      h.to_status,
      h.changed_by_user_id,
      COALESCE(prof.full_name, mem.member_name) AS changed_by_user_name,
      h.reason,
      h.created_at
    FROM adm_task_status_history h
    LEFT JOIN core_user_profiles prof ON h.changed_by_user_id = prof.user_id
    LEFT JOIN core_members mem ON h.changed_by_user_id = mem.user_id
    WHERE h.task_id = $1
    ORDER BY h.created_at ASC, h.task_status_history_id ASC
  `
  const result = await client.query(query, [taskId])
  return result.rows.map((r) => ({
    ...r,
    task_status_history_id: toInt(r.task_status_history_id),
    task_id: toInt(r.task_id),
    changed_by_user_id: toInt(r.changed_by_user_id),
  }))
}
