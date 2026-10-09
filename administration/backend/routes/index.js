/**
 * index.js — Administration Backend Routes Aggregator
 */

import { Router } from 'express'
import { createTaskRouter } from './taskRoutes.js'

export function createAdministrationRouter(options = {}) {
  const router = Router()

  router.use('/tasks', createTaskRouter(options))

  return router
}

export default createAdministrationRouter
