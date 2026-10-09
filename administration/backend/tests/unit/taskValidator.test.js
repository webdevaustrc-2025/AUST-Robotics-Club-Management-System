/**
 * taskValidator.test.js — Table-Driven Unit Tests for Task Input Validators
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateCreate,
  validateUpdate,
  validateAssign,
  validateTransition,
  validateListQuery,
  validateEligibleQuery,
} from '../../validators/taskValidator.js'

describe('taskValidator Unit Suite', () => {
  describe('validateCreate', () => {
    it('passes on valid complete payload and de-duplicates assignees', () => {
      const payload = {
        panel_term_id: 1,
        team_id: 2,
        task_title: '  Build Robot Chassis  ',
        task_description: 'CAD and laser cut parts',
        priority: 'HIGH',
        due_at: '2026-11-01T15:00:00.000Z',
        panel_membership_ids: [10, 20, 10, 30],
      }
      const { value, errors } = validateCreate(payload)
      assert.equal(errors, null)
      assert.equal(value.task_title, 'Build Robot Chassis')
      assert.equal(value.priority, 'HIGH')
      assert.deepEqual(value.panel_membership_ids, [10, 20, 30])
    })

    it('rejects missing or empty required fields', () => {
      const { errors } = validateCreate({})
      assert.ok(errors.panel_term_id)
      assert.ok(errors.team_id)
      assert.ok(errors.task_title)
    })

    it('rejects whitespace-only task title', () => {
      const { errors } = validateCreate({ panel_term_id: 1, team_id: 1, task_title: '    ' })
      assert.ok(errors.task_title)
    })

    it('rejects invalid priority', () => {
      const { errors } = validateCreate({ panel_term_id: 1, team_id: 1, task_title: 'T', priority: 'SUPER_URGENT' })
      assert.ok(errors.priority)
    })

    it('rejects non-ISO due_at', () => {
      const { errors } = validateCreate({ panel_term_id: 1, team_id: 1, task_title: 'T', due_at: 'tomorrow morning' })
      assert.ok(errors.due_at)
    })
  })

  describe('validateUpdate', () => {
    it('rejects empty update payload', () => {
      const { errors } = validateUpdate({})
      assert.ok(errors._general)
    })

    it('allows clearing task_description and due_at with null', () => {
      const { value, errors } = validateUpdate({
        task_description: null,
        due_at: null,
      })
      assert.equal(errors, null)
      assert.equal(value.task_description, null)
      assert.equal(value.due_at, null)
    })

    it('updates priority and title', () => {
      const { value, errors } = validateUpdate({
        task_title: 'Updated title',
        priority: 'CRITICAL',
      })
      assert.equal(errors, null)
      assert.equal(value.task_title, 'Updated title')
      assert.equal(value.priority, 'CRITICAL')
    })
  })

  describe('validateAssign', () => {
    it('passes with positive integers and de-duplicates', () => {
      const { value, errors } = validateAssign({ panel_membership_ids: [1, 2, 2, 3] })
      assert.equal(errors, null)
      assert.deepEqual(value.panel_membership_ids, [1, 2, 3])
    })

    it('rejects non-array or empty array', () => {
      assert.ok(validateAssign({}).errors.panel_membership_ids)
      assert.ok(validateAssign({ panel_membership_ids: [] }).errors.panel_membership_ids)
    })

    it('rejects non-positive ids', () => {
      const { errors } = validateAssign({ panel_membership_ids: [1, -5] })
      assert.ok(errors.panel_membership_ids)
    })
  })

  describe('validateTransition', () => {
    it('requires reason when transitioning to BLOCKED', () => {
      const res1 = validateTransition({ to_status: 'BLOCKED' })
      assert.ok(res1.errors.reason)

      const res2 = validateTransition({ to_status: 'BLOCKED', reason: 'Waiting for parts' })
      assert.equal(res2.errors, null)
      assert.equal(res2.value.reason, 'Waiting for parts')
    })

    it('passes for non-BLOCKED transition without reason', () => {
      const { value, errors } = validateTransition({ to_status: 'IN_PROGRESS' })
      assert.equal(errors, null)
      assert.equal(value.to_status, 'IN_PROGRESS')
      assert.equal(value.reason, null)
    })

    it('rejects unknown to_status', () => {
      const { errors } = validateTransition({ to_status: 'FINISHED' })
      assert.ok(errors.to_status)
    })
  })

  describe('validateListQuery', () => {
    it('applies default limit and offset', () => {
      const { value, errors } = validateListQuery({})
      assert.equal(errors, null)
      assert.equal(value.limit, 100)
      assert.equal(value.offset, 0)
    })

    it('validates custom limit and offset within bounds', () => {
      const { value, errors } = validateListQuery({ limit: '25', offset: '50' })
      assert.equal(errors, null)
      assert.equal(value.limit, 25)
      assert.equal(value.offset, 50)
    })

    it('rejects invalid limit exceeding 100', () => {
      const { errors } = validateListQuery({ limit: '150' })
      assert.ok(errors.limit)
    })
  })

  describe('validateEligibleQuery', () => {
    it('requires panel_term_id', () => {
      assert.ok(validateEligibleQuery({}).errors.panel_term_id)
    })

    it('passes on valid panel_term_id and optional team_id', () => {
      const { value, errors } = validateEligibleQuery({ panel_term_id: '5', team_id: '2' })
      assert.equal(errors, null)
      assert.equal(value.panel_term_id, 5)
      assert.equal(value.team_id, 2)
    })
  })
})
