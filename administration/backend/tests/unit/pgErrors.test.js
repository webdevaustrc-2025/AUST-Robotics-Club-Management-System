/**
 * pgErrors.test.js — Unit Tests for PostgreSQL Error Mapping
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mapPgError, AppError } from '../../utils/pgErrors.js'
import { ERROR_CODES } from '../../constants/taskConstants.js'

describe('pgErrors Utility Unit Suite', () => {
  it('passes through existing AppError instances unmodified', () => {
    const custom = new AppError('Custom forbidden', { status: 403, code: ERROR_CODES.FORBIDDEN })
    const mapped = mapPgError(custom)
    assert.equal(mapped, custom)
    assert.equal(mapped.status, 403)
    assert.equal(mapped.code, ERROR_CODES.FORBIDDEN)
  })

  it('maps 23503 foreign key violation to 422 REFERENCE_NOT_FOUND', () => {
    const pgErr = { code: '23503', message: 'foreign key constraint "fk_team" failed' }
    const mapped = mapPgError(pgErr)
    assert.equal(mapped.status, 422)
    assert.equal(mapped.code, ERROR_CODES.REFERENCE_NOT_FOUND)
  })

  it('maps 23503 in delete context to 409 ASSIGNEE_IN_USE', () => {
    const pgErr = { code: '23503', message: 'violates foreign key constraint' }
    const mapped = mapPgError(pgErr, { isDelete: true })
    assert.equal(mapped.status, 409)
    assert.equal(mapped.code, ERROR_CODES.ASSIGNEE_IN_USE)
  })

  it('maps 23505 unique constraint violation to 409 CONFLICT', () => {
    const pgErr = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const mapped = mapPgError(pgErr)
    assert.equal(mapped.status, 409)
    assert.equal(mapped.code, ERROR_CODES.CONFLICT)
  })

  it('maps 23514 check constraint violation to 400 VALIDATION_ERROR', () => {
    const pgErr = { code: '23514', message: 'check constraint failed' }
    const mapped = mapPgError(pgErr)
    assert.equal(mapped.status, 400)
    assert.equal(mapped.code, ERROR_CODES.VALIDATION_ERROR)
  })

  it('maps 22P02 and 22003 invalid syntax or overflow to 400 VALIDATION_ERROR', () => {
    const err1 = mapPgError({ code: '22P02' })
    assert.equal(err1.status, 400)
    assert.equal(err1.code, ERROR_CODES.VALIDATION_ERROR)

    const err2 = mapPgError({ code: '22003' })
    assert.equal(err2.status, 400)
    assert.equal(err2.code, ERROR_CODES.VALIDATION_ERROR)
  })

  it('maps unknown error to 500 INTERNAL_ERROR with generic message and no SQL text', () => {
    const unknown = { code: '42P01', message: 'relation "secret_table" does not exist' }
    const mapped = mapPgError(unknown)
    assert.equal(mapped.status, 500)
    assert.equal(mapped.code, ERROR_CODES.INTERNAL_ERROR)
    assert.equal(mapped.message, 'An unexpected database error occurred')
    assert.ok(!mapped.message.includes('secret_table'))
  })
})
