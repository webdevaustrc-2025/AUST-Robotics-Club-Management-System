/**
 * testDb.js — Integration Test Harness Helper
 * 
 * Provides unified world creation, HTTP test client setup, and cleanup
 * for integration tests against the isolated test database.
 */

import pg from 'pg'
import { createWorld, cleanupWorld } from './fixtures.js'
import { startTestServer } from './testApp.js'
import { createHttpClient } from './http.js'

const { Pool } = pg

export async function setupIntegrationTest(prefix = 'it') {
  const shouldRun = Boolean(process.env.DATABASE_URL)
  if (!shouldRun) {
    return { skipped: true, reason: 'DATABASE_URL not configured' }
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 2000,
  })

  let client
  try {
    client = await pool.connect()
  } catch (err) {
    await pool.end()
    return { skipped: true, reason: `Cannot connect to test DB: ${err.message}` }
  }

  const runId = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const world = await createWorld(client, runId)
  const server = await startTestServer()
  const httpClient = createHttpClient(server.baseUrl)

  return {
    skipped: false,
    pool,
    client,
    runId,
    world,
    server,
    httpClient,
    cleanup: async () => {
      try {
        await cleanupWorld(client, runId)
      } catch {
        // Ignore cleanup errors during teardown
      } finally {
        try {
          client.release()
        } catch {}
        try {
          await server.close()
        } catch {}
        try {
          await pool.end()
        } catch {}
      }
    },
  }
}
