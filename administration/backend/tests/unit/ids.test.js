/**
 * ids.test.js — Unit Tests for BigInt ID Parsing
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseBigintId } from '../../utils/ids.js'

describe('IDs Utility Unit Suite', () => {
  it('accepts valid positive integers in string and numeric formats', () => {
    assert.equal(parseBigintId('12'), 12)
    assert.equal(parseBigintId(12), 12)
    assert.equal(parseBigintId('1'), 1)
    assert.equal(parseBigintId('9007199254740991'), 9007199254740991)
  })

  it('rejects missing or null parameters', () => {
    assert.throws(() => parseBigintId(undefined, 'taskId'), /Missing required parameter/)
    assert.throws(() => parseBigintId(null, 'taskId'), /Missing required parameter/)
  })

  it('rejects non-numeric characters', () => {
    assert.throws(() => parseBigintId('abc'), /must be a positive integer/)
    assert.throws(() => parseBigintId('12a'), /must be a positive integer/)
  })

  it('rejects zero and negative integers', () => {
    assert.throws(() => parseBigintId('0'), /must be strictly greater than 0/)
    assert.throws(() => parseBigintId('-1'), /must be a positive integer/)
  })

  it('rejects decimals and floating point strings', () => {
    assert.throws(() => parseBigintId('1.5'), /must be a positive integer/)
    assert.throws(() => parseBigintId('12.0'), /must be a positive integer/)
  })

  it('rejects leading zeros', () => {
    assert.throws(() => parseBigintId('012'), /leading zeros are not allowed/)
  })

  it('rejects integers exceeding safe integer range', () => {
    assert.throws(() => parseBigintId('99999999999999999999'), /value exceeds allowed integer range/)
  })
})
