/**
 * hierarchyPolicy.test.js — Unit Tests for Core Hierarchy Policy
 * 
 * Verifies the mathematical truth table for rank outranking, self-assignment checks,
 * unranked edge cases, batch failure aggregation, and filter consistency.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  outranks,
  classifyAssignment,
  assertCanAssign,
  filterAssignable,
} from '../../services/hierarchyPolicy.js'
import { ERROR_CODES } from '../../constants/taskConstants.js'

describe('hierarchyPolicy Service Unit Suite', () => {
  // Ladder ranks including newly incorporated executive ranks
  const ladderRanks = [100, 90, 80, 70, 50, 40, 30, 20, 10, 0]

  describe('outranks truth table', () => {
    it('returns true only when actorRank > targetRank and both > 0', () => {
      for (const actorRank of ladderRanks) {
        for (const targetRank of ladderRanks) {
          const expected = actorRank > targetRank && actorRank > 0 && targetRank > 0
          assert.equal(
            outranks(actorRank, targetRank),
            expected,
            `Failed for actor ${actorRank} vs target ${targetRank}`
          )
        }
      }
    })

    it('unranked (0) never outranks anything and cannot be outranked', () => {
      assert.equal(outranks(0, 10), false)
      assert.equal(outranks(10, 0), false)
      assert.equal(outranks(0, 0), false)
    })
  })

  describe('classifyAssignment', () => {
    it('returns ACTOR_POSITION_NOT_IN_HIERARCHY when actor rank <= 0', () => {
      const res = classifyAssignment({
        actor: { rank: 0, member_id: 1 },
        target: { rank: 10, member_id: 2 },
      })
      assert.deepEqual(res, { ok: false, reason: 'ACTOR_POSITION_NOT_IN_HIERARCHY' })
    })

    it('returns SELF when actor and target have same member_id, even if ranks differ or match', () => {
      const resEqual = classifyAssignment({
        actor: { rank: 50, member_id: 10 },
        target: { rank: 50, member_id: 10 },
      })
      assert.deepEqual(resEqual, { ok: false, reason: 'SELF' })

      const resDifferent = classifyAssignment({
        actor: { rank: 50, member_id: 10 },
        target: { rank: 20, member_id: 10 },
      })
      assert.deepEqual(resDifferent, { ok: false, reason: 'SELF' })
    })

    it('returns POSITION_NOT_IN_HIERARCHY when target rank <= 0', () => {
      const res = classifyAssignment({
        actor: { rank: 50, member_id: 1 },
        target: { rank: 0, member_id: 2 },
      })
      assert.deepEqual(res, { ok: false, reason: 'POSITION_NOT_IN_HIERARCHY' })
    })

    it('returns SAME_RANK when actor and target have equal positive rank', () => {
      const res = classifyAssignment({
        actor: { rank: 50, member_id: 1 },
        target: { rank: 50, member_id: 2 },
      })
      assert.deepEqual(res, { ok: false, reason: 'SAME_RANK' })
    })

    it('returns HIGHER_RANK when target outranks actor', () => {
      const res = classifyAssignment({
        actor: { rank: 20, member_id: 1 },
        target: { rank: 40, member_id: 2 },
      })
      assert.deepEqual(res, { ok: false, reason: 'HIGHER_RANK' })
    })

    it('returns { ok: true } when actor strictly outranks target with different member_id', () => {
      const res = classifyAssignment({
        actor: { rank: 50, member_id: 1 },
        target: { rank: 20, member_id: 2 },
      })
      assert.deepEqual(res, { ok: true })
    })
  })

  describe('filterAssignable', () => {
    it('filters candidates strictly adhering to classifyAssignment', () => {
      const actor = { rank: 50, member_id: 1 }
      const candidates = [
        { rank: 50, member_id: 1, name: 'Self' },
        { rank: 100, member_id: 2, name: 'President' },
        { rank: 50, member_id: 3, name: 'Peer Director' },
        { rank: 40, member_id: 4, name: 'Assistant Director' },
        { rank: 20, member_id: 5, name: 'Senior Sub' },
        { rank: 0, member_id: 6, name: 'Unranked' },
      ]

      const assignable = filterAssignable(actor, candidates)
      assert.equal(assignable.length, 2)
      assert.deepEqual(
        assignable.map((c) => c.name),
        ['Assistant Director', 'Senior Sub']
      )
    })
  })

  describe('assertCanAssign', () => {
    it('throws 403 POSITION_NOT_IN_HIERARCHY if actor rank <= 0', () => {
      assert.throws(
        () => assertCanAssign({ rank: 0, member_id: 1 }, [{ rank: 10, member_id: 2 }]),
        (err) => err.status === 403 && err.code === ERROR_CODES.POSITION_NOT_IN_HIERARCHY
      )
    })

    it('aggregates all failing targets in error details', () => {
      const actor = { rank: 50, member_id: 1 }
      const targets = [
        { panel_membership_id: 10, rank: 50, member_id: 1 }, // SELF
        { panel_membership_id: 11, rank: 50, member_id: 2 }, // SAME_RANK
        { panel_membership_id: 12, rank: 90, member_id: 3 }, // HIGHER_RANK
        { panel_membership_id: 13, rank: 20, member_id: 4 }, // OK
      ]

      assert.throws(
        () => assertCanAssign(actor, targets),
        (err) => {
          assert.equal(err.status, 403)
          assert.equal(err.code, ERROR_CODES.HIERARCHY_VIOLATION)
          assert.equal(err.details.length, 3)
          assert.deepEqual(err.details[0], { panel_membership_id: 10, member_id: 1, reason: 'SELF' })
          assert.deepEqual(err.details[1], { panel_membership_id: 11, member_id: 2, reason: 'SAME_RANK' })
          assert.deepEqual(err.details[2], { panel_membership_id: 12, member_id: 3, reason: 'HIGHER_RANK' })
          return true
        }
      )
    })

    it('passes when all targets are valid', () => {
      const actor = { rank: 50, member_id: 1 }
      const targets = [
        { panel_membership_id: 21, rank: 20, member_id: 2 },
        { panel_membership_id: 22, rank: 10, member_id: 3 },
      ]
      assert.equal(assertCanAssign(actor, targets), true)
    })
  })
})
