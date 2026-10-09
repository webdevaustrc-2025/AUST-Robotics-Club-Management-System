/**
 * testApp.test.js — Unit test for testApp and http test client
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { startTestServer } from '../helpers/testApp.js'
import { createHttpClient } from '../helpers/http.js'

const mockService = {
  listTasks: async () => ({ data: [], pagination: { total: 0, limit: 100, offset: 0 } }),
  listEligibleAssignees: async () => [],
}

describe('TestApp & HTTP Client Harness', () => {
  it('returns 401 UNAUTHENTICATED when unauthenticated client calls /eligible-assignees', async () => {
    const { baseUrl, close } = await startTestServer({ routerOptions: { service: mockService } })
    try {
      const client = createHttpClient(baseUrl)
      const res = await client.unauthenticated.get('/api/administration/tasks/eligible-assignees')
      assert.equal(res.status, 401)
      assert.equal(res.body.error.code, 'UNAUTHENTICATED')
    } finally {
      await close()
    }
  })

  it('returns 401 UNAUTHENTICATED when unauthenticated client calls protected endpoint', async () => {
    const { baseUrl, close } = await startTestServer({ routerOptions: { service: mockService } })
    try {
      const client = createHttpClient(baseUrl)
      const res = await client.unauthenticated.get('/api/administration/tasks')
      assert.equal(res.status, 401)
      assert.equal(res.body.error.code, 'UNAUTHENTICATED')
    } finally {
      await close()
    }
  })

  it('allows authenticated client with default permissions', async () => {
    const { baseUrl, close } = await startTestServer({ routerOptions: { service: mockService } })
    try {
      const client = createHttpClient(baseUrl)
      const res = await client.asUser(1).get('/api/administration/tasks')
      assert.equal(res.status, 200)
      assert.deepEqual(res.body.data, [])
    } finally {
      await close()
    }
  })

  it('rejects with 403 FORBIDDEN when user lacks required permission', async () => {
    const { baseUrl, close } = await startTestServer({ routerOptions: { service: mockService } })
    try {
      const client = createHttpClient(baseUrl)
      // Pass perms without 'adm.task.create'
      const res = await client.asUser(1, ['adm.task.read_only']).post('/api/administration/tasks', {})
      assert.equal(res.status, 403)
      assert.equal(res.body.error.code, 'FORBIDDEN')
    } finally {
      await close()
    }
  })

  it('routes to static path /eligible-assignees without colliding with /:taskId', async () => {
    const { baseUrl, close } = await startTestServer({ routerOptions: { service: mockService } })
    try {
      const client = createHttpClient(baseUrl)
      const res = await client.asUser(1).get('/api/administration/tasks/eligible-assignees?panel_term_id=1')
      assert.equal(res.status, 200)
      assert.deepEqual(res.body.data, [])
    } finally {
      await close()
    }
  })
})

