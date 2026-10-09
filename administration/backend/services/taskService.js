/**
 * taskService.js — Administration Task Business Logic Service
 * 
 * Orchestrates repositories, validations, authorization checks,
 * hierarchy policies, and transaction boundaries.
 */

import pool from '../../../shared-features/backend/database/db.js'
import { withTransaction } from '../utils/withTransaction.js'
import { AppError, mapPgError } from '../utils/pgErrors.js'
import { ERROR_CODES } from '../constants/taskConstants.js'
import * as taskRepository from '../repositories/taskRepository.js'
import * as taskAssigneeRepository from '../repositories/taskAssigneeRepository.js'
import * as taskStatusHistoryRepository from '../repositories/taskStatusHistoryRepository.js'
import {
  findActiveMembershipsForUser,
  resolveActingMembership,
  assertCanAssignTasks,
  canViewAll,
  canManage,
  canViewTask,
  canMutateTask,
  canTransition,
} from './taskAccess.js'
import { assertCanAssign, filterAssignable } from './hierarchyPolicy.js'
import {
  mapTaskRow,
  mapAssigneeRow,
  mapStatusHistoryRow,
  mapEligibleAssigneeRow,
} from '../utils/mappers.js'


export async function listEligibleAssignees({ userId, panelTermId, teamId, perms = [] }, client = pool) {
  const activeMemberships = await findActiveMembershipsForUser(client, userId, panelTermId)
  const actingMembership = resolveActingMembership(activeMemberships)

  // Enforces H2, H10 (can_assign_tasks = true), rank > 0
  assertCanAssignTasks(actingMembership)

  const candidates = await taskAssigneeRepository.findEligibleMemberships(client, {
    panel_term_id: panelTermId,
    team_id: teamId,
  })

  // Strictly filter candidates to only those lower-ranked and different person (H3)
  const filtered = filterAssignable(actingMembership, candidates)
  return filtered.map(mapEligibleAssigneeRow)
}

export async function createTask({ userId, payload, perms = [] }, customPool = pool) {
  return withTransaction(async (client) => {
    try {
      const activeMemberships = await findActiveMembershipsForUser(client, userId, payload.panel_term_id)
      const actingMembership = resolveActingMembership(activeMemberships)

      // Must have active membership with can_assign_tasks = true (H10) even with no assignees
      assertCanAssignTasks(actingMembership)

      const assigneeIds = payload.panel_membership_ids || []

      if (assigneeIds.length > 0) {
        // 1. Load targets and verify active eligibility in term first (H7)
        const targets = await taskAssigneeRepository.loadTargetsForAssignment(
          client,
          payload.panel_term_id,
          assigneeIds
        )

        const foundIds = new Set(targets.filter((t) => t.is_active).map((t) => t.panel_membership_id))
        const ineligible = assigneeIds.filter((id) => !foundIds.has(id))

        if (ineligible.length > 0) {
          throw new AppError('One or more assignees are ineligible, inactive, or not in this panel term', {
            status: 422,
            code: ERROR_CODES.INELIGIBLE_ASSIGNEE,
            details: ineligible,
          })
        }

        // 2. Enforce hierarchy policy across all targets (H6)
        assertCanAssign(actingMembership, targets)
      }

      // 3. Create task record
      const task = await taskRepository.create(client, {
        panel_term_id: payload.panel_term_id,
        team_id: payload.team_id,
        assigner_membership_id: actingMembership.panel_membership_id,
        task_title: payload.task_title,
        task_description: payload.task_description,
        priority: payload.priority,
        due_at: payload.due_at,
      })

      // 4. Record initial status history
      await taskStatusHistoryRepository.create(client, {
        task_id: task.task_id,
        from_status: null,
        to_status: 'TODO',
        changed_by_user_id: userId,
        reason: 'Task created',
      })

      // 5. Add assignees
      if (assigneeIds.length > 0) {
        await taskAssigneeRepository.addAssignees(client, task.task_id, assigneeIds, userId)
      }

      // 6. Return enriched created task
      const fullTask = await taskRepository.findById(client, task.task_id)
      const assignees = await taskAssigneeRepository.findAssigneesForTask(client, task.task_id)
      return mapTaskRow({ ...fullTask, assignees })
    } catch (err) {
      throw mapPgError(err)
    }
  }, customPool)
}

export async function listTasks({ userId, query = {}, perms = [] }, client = pool) {
  try {
    const isManager = canViewAll(perms)
    let actorMembershipIds = []

    if (!isManager) {
      actorMembershipIds = await taskAssigneeRepository.findMembershipIdsForUser(client, userId)
    }

    const { tasks, total } = await taskRepository.findAll(client, {
      filters: query,
      visibility: {
        canViewAll: isManager,
        actorMembershipIds,
      },
      limit: query.limit,
      offset: query.offset,
    })

    if (tasks.length === 0) {
      return { data: [], pagination: { total: 0, limit: query.limit || 100, offset: query.offset || 0 } }
    }

    // Batch query assignees (zero N+1)
    const taskIds = tasks.map((t) => Number(t.task_id))
    const assigneeMap = await taskAssigneeRepository.findAssigneesForTasks(client, taskIds)

    const data = tasks.map((t) => {
      const taskAssignees = assigneeMap.get(Number(t.task_id)) || []
      return mapTaskRow({ ...t, assignees: taskAssignees })
    })

    return {
      data,
      pagination: {
        total,
        limit: query.limit || 100,
        offset: query.offset || 0,
      },
    }
  } catch (err) {
    throw mapPgError(err)
  }
}

export async function getTask({ userId, taskId, perms = [] }, client = pool) {
  try {
    const task = await taskRepository.findById(client, taskId)
    if (!task) {
      throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
    }

    const assignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)
    const enriched = { ...task, assignees }

    if (!canViewAll(perms)) {
      const actorMembershipIds = await taskAssigneeRepository.findMembershipIdsForUser(client, userId)
      if (!canViewTask({ task: enriched, actorMembershipIds, perms })) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }
    }

    return mapTaskRow(enriched)
  } catch (err) {
    throw mapPgError(err)
  }
}

export async function updateTask({ userId, taskId, payload, perms = [] }, customPool = pool) {
  return withTransaction(async (client) => {
    try {
      const task = await taskRepository.findById(client, taskId)
      if (!task) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }

      const assignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)
      const actorMembershipIds = await taskAssigneeRepository.findMembershipIdsForUser(client, userId)

      if (!canViewTask({ task: { ...task, assignees }, actorMembershipIds, perms })) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }

      if (!canMutateTask({ task, actorMembershipIds, perms })) {
        throw new AppError('You are not authorized to update this task', {
          status: 403,
          code: ERROR_CODES.FORBIDDEN,
        })
      }

      await taskRepository.update(client, taskId, payload)
      const updated = await taskRepository.findById(client, taskId)
      const currentAssignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)
      return mapTaskRow({ ...updated, assignees: currentAssignees })
    } catch (err) {
      throw mapPgError(err)
    }
  }, customPool)
}

export async function addAssignees({ userId, taskId, panelMembershipIds = [], perms = [] }, customPool = pool) {
  return withTransaction(async (client) => {
    try {
      const task = await taskRepository.findById(client, taskId)
      if (!task) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }

      const existingAssignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)
      const actorMembershipIds = await taskAssigneeRepository.findMembershipIdsForUser(client, userId)

      if (!canViewTask({ task: { ...task, assignees: existingAssignees }, actorMembershipIds, perms })) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }

      if (!canMutateTask({ task, actorMembershipIds, perms })) {
        throw new AppError('You are not authorized to assign members to this task', {
          status: 403,
          code: ERROR_CODES.FORBIDDEN,
        })
      }

      // Acting membership in the task's panel term
      const activeMemberships = await findActiveMembershipsForUser(client, userId, task.panel_term_id)
      const actingMembership = resolveActingMembership(activeMemberships)

      // H10 check
      assertCanAssignTasks(actingMembership)

      // Verify target eligibility in task's term
      const targets = await taskAssigneeRepository.loadTargetsForAssignment(
        client,
        task.panel_term_id,
        panelMembershipIds
      )

      const foundIds = new Set(targets.filter((t) => t.is_active).map((t) => t.panel_membership_id))
      const ineligible = panelMembershipIds.filter((id) => !foundIds.has(id))

      if (ineligible.length > 0) {
        throw new AppError('One or more assignees are ineligible, inactive, or from another term', {
          status: 422,
          code: ERROR_CODES.INELIGIBLE_ASSIGNEE,
          details: ineligible,
        })
      }

      // Verify hierarchy rule
      assertCanAssign(actingMembership, targets)

      // Insert assignees
      await taskAssigneeRepository.addAssignees(client, taskId, panelMembershipIds, userId)

      // Return complete current assignees
      const updatedAssignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)
      return updatedAssignees.map(mapAssigneeRow)
    } catch (err) {
      throw mapPgError(err)
    }
  }, customPool)
}

export async function removeAssignee({ userId, taskId, panelMembershipId, perms = [] }, customPool = pool) {
  return withTransaction(async (client) => {
    try {
      const task = await taskRepository.findById(client, taskId)
      if (!task) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }

      const existingAssignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)
      const actorMembershipIds = await taskAssigneeRepository.findMembershipIdsForUser(client, userId)

      if (!canViewTask({ task: { ...task, assignees: existingAssignees }, actorMembershipIds, perms })) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }

      if (!canMutateTask({ task, actorMembershipIds, perms })) {
        throw new AppError('You are not authorized to unassign members from this task', {
          status: 403,
          code: ERROR_CODES.FORBIDDEN,
        })
      }

      const removed = await taskAssigneeRepository.removeAssignee(client, taskId, panelMembershipId)
      if (!removed) {
        throw new AppError('Assignee not found on this task', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }

      const currentTask = await taskRepository.findById(client, taskId)
      const currentAssignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)
      return mapTaskRow({ ...currentTask, assignees: currentAssignees })
    } catch (err) {
      throw mapPgError(err, { isDelete: true })
    }
  }, customPool)
}

export async function transitionTaskStatus({ userId, taskId, payload, perms = [] }, customPool = pool) {
  return withTransaction(async (client) => {
    try {
      // Row lock (FOR UPDATE) serializes concurrent transitions
      const task = await taskRepository.findByIdForUpdate(client, taskId)
      if (!task) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }

      const assignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)
      const actorMembershipIds = await taskAssigneeRepository.findMembershipIdsForUser(client, userId)

      if (!canViewTask({ task: { ...task, assignees }, actorMembershipIds, perms })) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }

      if (!canTransition({ task, actorMembershipIds, perms })) {
        throw new AppError('You are not authorized to transition the status of this task', {
          status: 403,
          code: ERROR_CODES.FORBIDDEN,
        })
      }

      if (task.status === payload.to_status) {
        throw new AppError('Task is already in the requested status', {
          status: 409,
          code: ERROR_CODES.STATUS_UNCHANGED,
        })
      }

      const blockedReason = payload.to_status === 'BLOCKED' ? payload.reason : null
      const completedAt = payload.to_status === 'DONE' ? new Date().toISOString() : null

      await taskRepository.updateStatus(client, taskId, {
        status: payload.to_status,
        blocked_reason: blockedReason,
        completed_at: completedAt,
      })

      const history = await taskStatusHistoryRepository.create(client, {
        task_id: taskId,
        from_status: task.status,
        to_status: payload.to_status,
        changed_by_user_id: userId,
        reason: payload.reason,
      })

      const updatedTask = await taskRepository.findById(client, taskId)
      const updatedAssignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)

      return {
        task: mapTaskRow({ ...updatedTask, assignees: updatedAssignees }),
        history: mapStatusHistoryRow(history),
      }
    } catch (err) {
      throw mapPgError(err)
    }
  }, customPool)
}

export async function listTaskStatusHistory({ userId, taskId, perms = [] }, client = pool) {
  try {
    const task = await taskRepository.findById(client, taskId)
    if (!task) {
      throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
    }

    if (!canViewAll(perms)) {
      const assignees = await taskAssigneeRepository.findAssigneesForTask(client, taskId)
      const actorMembershipIds = await taskAssigneeRepository.findMembershipIdsForUser(client, userId)
      if (!canViewTask({ task: { ...task, assignees }, actorMembershipIds, perms })) {
        throw new AppError('Task not found', { status: 404, code: ERROR_CODES.TASK_NOT_FOUND })
      }
    }

    const history = await taskStatusHistoryRepository.findByTaskId(client, taskId)
    return history.map(mapStatusHistoryRow)
  } catch (err) {
    throw mapPgError(err)
  }
}
