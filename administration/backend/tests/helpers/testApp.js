/**
 * testApp.js — Test Express App Helper
 * 
 * Factory for creating an Express test app with injected fake authentication
 * and permission middleware.
 */

import express from 'express'
import { createTaskRouter } from '../../routes/taskRoutes.js'

/**
 * Creates an Express test app configured with fake authentication.
 */
export function createTestApp(options = {}) {
  const app = express()
  app.use(express.json())

  // Fake authentication: reads user ID from x-test-user-id or x-acting-user-id header
  const fakeAuthenticate = (req, res, next) => {
    const userId = req.headers['x-test-user-id'] || req.headers['x-acting-user-id']
    if (!userId) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required: missing x-test-user-id header',
        },
      })
    }
    req.user = { user_id: Number(userId) || userId }
    next()
  }

  // Fake requirePermission: reads perms from x-test-perms header
  // Default test perms include 'adm.task.create' per B1.4
  const fakeRequirePermission = (requiredPerm) => (req, res, next) => {
    const permsHeader = req.headers['x-test-perms']
    let perms = []
    if (permsHeader === undefined) {
      // Default permissions: every actor gets adm.task.create to test hierarchy in isolation
      perms = ['adm.task.create']
    } else if (permsHeader) {
      perms = permsHeader.split(',').map((p) => p.trim())
    }

    if (!perms.includes(requiredPerm)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Permission denied: required "${requiredPerm}"`,
        },
      })
    }
    next()
  }

  const router = createTaskRouter({
    authenticate: fakeAuthenticate,
    requirePermission: fakeRequirePermission,
    ...options.routerOptions,
  })

  app.use('/api/administration/tasks', router)

  // Standard JSON error handler
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500
    const code = err.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR')
    res.status(status).json({
      error: {
        code,
        message: err.message || 'An unexpected error occurred',
        details: err.details,
      },
    })
  })

  return { app, router }
}

/**
 * Starts the test app on an ephemeral port (port 0).
 * Returns { app, server, port, baseUrl, close }.
 */
export async function startTestServer(options = {}) {
  const { app, router } = createTestApp(options)

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })

  const address = server.address()
  const port = address.port
  const baseUrl = `http://127.0.0.1:${port}`

  return {
    app,
    router,
    server,
    port,
    baseUrl,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()))
      }),
  }
}
