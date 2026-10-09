/**
 * withTransaction.js — Transaction Helper
 * 
 * Safely executes database operations inside a BEGIN ... COMMIT block.
 * Automatically performs ROLLBACK on error and guarantees client release.
 */

import pool from '../../../shared-features/backend/database/db.js'

/**
 * Runs an asynchronous callback inside a database transaction.
 * Accepts an optional pool/client, defaulting to the shared connection pool.
 */
export async function withTransaction(callback, customPool = pool) {
  // If customPool has a connect method, it is a Pool
  const client = typeof customPool.connect === 'function' ? await customPool.connect() : customPool
  const isPooledClient = typeof customPool.connect === 'function'

  try {
    await client.query('BEGIN')
    const result = await callback(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {
      // Ignore rollback failure if connection was lost
    }
    throw err
  } finally {
    if (isPooledClient && typeof client.release === 'function') {
      client.release()
    }
  }
}

export default withTransaction
