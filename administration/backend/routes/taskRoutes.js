/**
 * taskRoutes.js — Administration Task Routes
 * 
 * Router factory that injects authentication and permission middleware.
 */

import { Router } from 'express'
import * as taskController from '../controllers/taskController.js'

export function createTaskRouter({ authenticate, requirePermission, service } = {}) {
  const router = Router()

  const authMiddleware = authenticate || ((req, res, next) => next())
  const permMiddleware = (perm) => (requirePermission ? requirePermission(perm) : ((req, res, next) => next()))
  const controller = service ? taskController.createTaskController(service) : taskController

  // Apply authentication to all task routes
  router.use(authMiddleware)

  // 1. Static paths declared BEFORE parameter paths (prevents /:taskId collision)
  router.get('/eligible-assignees', permMiddleware('adm.task.create'), controller.getEligibleAssignees)

  // 2. Collection routes
  router.post('/', permMiddleware('adm.task.create'), controller.createTask)
  router.get('/', controller.listTasks)

  // 3. Task item routes
  router.get('/:taskId', controller.getTask)
  router.patch('/:taskId', controller.updateTask)

  // 4. Assignee routes
  router.post('/:taskId/assignees', permMiddleware('adm.task.create'), controller.addAssignees)
  router.delete('/:taskId/assignees/:panelMembershipId', controller.removeAssignee)

  // 5. Status & history routes
  router.patch('/:taskId/status', controller.transitionStatus)
  router.get('/:taskId/history', controller.getStatusHistory)


  return router
}

export default createTaskRouter

