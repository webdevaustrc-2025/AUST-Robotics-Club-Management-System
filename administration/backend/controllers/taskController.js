/**
 * taskController.js — Administration Task HTTP Controller
 * 
 * Unpacks requests, executes validation, coordinates task service,
 * and formats standardized JSON responses.
 */

import * as defaultTaskService from '../services/taskService.js'
import {
  validateCreate,
  validateUpdate,
  validateAssign,
  validateTransition,
  validateListQuery,
  validateEligibleQuery,
} from '../validators/taskValidator.js'
import { parseBigintId } from '../utils/ids.js'
import { AppError } from '../utils/pgErrors.js'

function getUserId(req) {
  return req.user?.user_id
}

function getUserPerms(req) {
  const header = req.headers['x-test-perms']
  if (header) {
    return header.split(',').map((p) => p.trim())
  }
  return req.user?.permissions || ['adm.task.create']
}

export function createTaskController(service = defaultTaskService) {
  return {
    async getEligibleAssignees(req, res, next) {
      try {
        const { value, errors } = validateEligibleQuery(req.query)
        if (errors) {
          throw new AppError('Validation failed', { status: 400, details: errors })
        }

        const data = await service.listEligibleAssignees({
          userId: getUserId(req),
          panelTermId: value.panel_term_id,
          teamId: value.team_id,
          perms: getUserPerms(req),
        })

        res.json({ data })
      } catch (err) {
        next(err)
      }
    },

    async createTask(req, res, next) {
      try {
        const { value, errors } = validateCreate(req.body)
        if (errors) {
          throw new AppError('Validation failed', { status: 400, details: errors })
        }

        const data = await service.createTask({
          userId: getUserId(req),
          payload: value,
          perms: getUserPerms(req),
        })

        res.status(201).json({ data })
      } catch (err) {
        next(err)
      }
    },

    async listTasks(req, res, next) {
      try {
        const { value, errors } = validateListQuery(req.query)
        if (errors) {
          throw new AppError('Validation failed', { status: 400, details: errors })
        }

        const result = await service.listTasks({
          userId: getUserId(req),
          query: value,
          perms: getUserPerms(req),
        })

        res.json(result)
      } catch (err) {
        next(err)
      }
    },

    async getTask(req, res, next) {
      try {
        const taskId = parseBigintId(req.params.taskId, 'taskId')
        const data = await service.getTask({
          userId: getUserId(req),
          taskId,
          perms: getUserPerms(req),
        })

        res.json({ data })
      } catch (err) {
        next(err)
      }
    },

    async updateTask(req, res, next) {
      try {
        const taskId = parseBigintId(req.params.taskId, 'taskId')
        const { value, errors } = validateUpdate(req.body)
        if (errors) {
          throw new AppError('Validation failed', { status: 400, details: errors })
        }

        const data = await service.updateTask({
          userId: getUserId(req),
          taskId,
          payload: value,
          perms: getUserPerms(req),
        })

        res.json({ data })
      } catch (err) {
        next(err)
      }
    },

    async addAssignees(req, res, next) {
      try {
        const taskId = parseBigintId(req.params.taskId, 'taskId')
        const { value, errors } = validateAssign(req.body)
        if (errors) {
          throw new AppError('Validation failed', { status: 400, details: errors })
        }

        const data = await service.addAssignees({
          userId: getUserId(req),
          taskId,
          panelMembershipIds: value.panel_membership_ids,
          perms: getUserPerms(req),
        })

        res.json({ data })
      } catch (err) {
        next(err)
      }
    },

    async removeAssignee(req, res, next) {
      try {
        const taskId = parseBigintId(req.params.taskId, 'taskId')
        const panelMembershipId = parseBigintId(req.params.panelMembershipId, 'panelMembershipId')

        const data = await service.removeAssignee({
          userId: getUserId(req),
          taskId,
          panelMembershipId,
          perms: getUserPerms(req),
        })

        res.json({ data })
      } catch (err) {
        next(err)
      }
    },

    async transitionStatus(req, res, next) {
      try {
        const taskId = parseBigintId(req.params.taskId, 'taskId')
        const { value, errors } = validateTransition(req.body)
        if (errors) {
          throw new AppError('Validation failed', { status: 400, details: errors })
        }

        const data = await service.transitionTaskStatus({
          userId: getUserId(req),
          taskId,
          payload: value,
          perms: getUserPerms(req),
        })

        res.json({ data })
      } catch (err) {
        next(err)
      }
    },

    async getStatusHistory(req, res, next) {
      try {
        const taskId = parseBigintId(req.params.taskId, 'taskId')
        const data = await service.listTaskStatusHistory({
          userId: getUserId(req),
          taskId,
          perms: getUserPerms(req),
        })

        res.json({ data })
      } catch (err) {
        next(err)
      }
    },
  }
}

// Default controller singleton
const defaultController = createTaskController(defaultTaskService)
export const getEligibleAssignees = defaultController.getEligibleAssignees
export const createTask = defaultController.createTask
export const listTasks = defaultController.listTasks
export const getTask = defaultController.getTask
export const updateTask = defaultController.updateTask
export const addAssignees = defaultController.addAssignees
export const removeAssignee = defaultController.removeAssignee
export const transitionStatus = defaultController.transitionStatus
export const getStatusHistory = defaultController.getStatusHistory
