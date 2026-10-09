/**
 * withTransaction.test.js — Unit Tests for withTransaction Helper
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { withTransaction } from '../../utils/withTransaction.js'

describe('withTransaction Utility Unit Suite', () => {
  it('commits on success and releases the pooled client', async () => {
    const executed = []
    let released = false

    const fakeClient = {
      query: async (sql) => {
        executed.push(sql)
        return { rows: [] }
      },
      release: () => {
        released = true
      },
    }

    const fakePool = {
      connect: async () => fakeClient,
    }

    const result = await withTransaction(async (client) => {
      await client.query('SELECT 1')
      return 'success_val'
    }, fakePool)

    assert.equal(result, 'success_val')
    assert.deepEqual(executed, ['BEGIN', 'SELECT 1', 'COMMIT'])
    assert.equal(released, true)
  })

  it('rolls back on error, rethrows, and always releases client', async () => {
    const executed = []
    let released = false

    const fakeClient = {
      query: async (sql) => {
        executed.push(sql)
        return { rows: [] }
      },
      release: () => {
        released = true
      },
    }

    const fakePool = {
      connect: async () => fakeClient,
    }

    await assert.rejects(
      async () => {
        await withTransaction(async (client) => {
          await client.query('INSERT INTO fail')
          throw new Error('boom')
        }, fakePool)
      },
      /boom/
    )

    assert.deepEqual(executed, ['BEGIN', 'INSERT INTO fail', 'ROLLBACK'])
    assert.equal(released, true)
  })
})
