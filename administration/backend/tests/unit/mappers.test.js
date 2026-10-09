/**
 * mappers.test.js — Unit Tests for Database Row Mappers
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { toInt, mapTaskRow, mapAssigneeRow, mapStatusHistoryRow, mapEligibleAssigneeRow } from '../../utils/mappers.js'

describe('Mappers Unit Suite', () => {
  it('toInt converts BigInt string to number safely, preserving nulls', () => {
    assert.equal(toInt('42'), 42)
    assert.equal(toInt('0'), 0)
    assert.equal(toInt(100), 100)
    assert.equal(toInt(null), null)
    assert.equal(toInt(undefined), null)
    assert.equal(toInt('not_a_number'), null)
  })

  it('mapTaskRow maps BIGINT columns to numbers and dates to ISO strings', () => {
    const row = {
      task_id: '101',
      panel_term_id: '5',
      team_id: '12',
      assigner_membership_id: '77',
      task_title: 'Build Autonomous Robot',
      task_description: 'Full autonomy pipeline',
      priority: 'HIGH',
      status: 'TODO',
      due_at: new Date('2026-12-01T12:00:00Z'),
      blocked_reason: null,
      completed_at: null,
      created_at: new Date('2026-10-01T10:00:00Z'),
      updated_at: new Date('2026-10-02T10:00:00Z'),
      team_name: 'Software Team',
      assigner_name: 'Alice Director',
      assignees: [
        {
          task_assignee_id: '1',
          task_id: '101',
          panel_membership_id: '20',
          assigned_by_user_id: '5',
          assigned_at: new Date('2026-10-01T10:00:00Z'),
          status: 'ASSIGNED',
        },
      ],
    }

    const mapped = mapTaskRow(row)
    assert.equal(mapped.task_id, 101)
    assert.equal(mapped.panel_term_id, 5)
    assert.equal(mapped.team_id, 12)
    assert.equal(mapped.assigner_membership_id, 77)
    assert.equal(mapped.task_title, 'Build Autonomous Robot')
    assert.equal(mapped.due_at, '2026-12-01T12:00:00.000Z')
    assert.equal(mapped.team_name, 'Software Team')
    assert.equal(mapped.assignees[0].task_assignee_id, 1)
    assert.equal(mapped.assignees[0].panel_membership_id, 20)
  })

  it('mapTaskRow handles null row gracefully', () => {
    assert.equal(mapTaskRow(null), null)
  })

  it('mapAssigneeRow converts ids and handles member code fallback', () => {
    const row = {
      task_assignee_id: '44',
      task_id: '10',
      panel_membership_id: '33',
      assigned_by_user_id: '2',
      assigned_at: '2026-10-01T12:00:00.000Z',
      status: 'ASSIGNED',
      member_id: '8',
      member_name: 'Bob',
      member_code: 'MEM_008',
      position_id: '15',
      position_name: 'Sub Executive',
    }

    const mapped = mapAssigneeRow(row)
    assert.equal(mapped.task_assignee_id, 44)
    assert.equal(mapped.panel_membership_id, 33)
    assert.equal(mapped.member_id, 8)
    assert.equal(mapped.student_id, 'MEM_008')
    assert.equal(mapped.position_title, 'Sub Executive')
  })

  it('mapStatusHistoryRow converts ids and dates', () => {
    const row = {
      task_status_history_id: '99',
      task_id: '10',
      from_status: 'TODO',
      to_status: 'IN_PROGRESS',
      changed_by_user_id: '1',
      changed_by_user_name: 'Alice',
      reason: 'Starting development',
      created_at: '2026-10-05T08:00:00.000Z',
    }

    const mapped = mapStatusHistoryRow(row)
    assert.equal(mapped.task_status_history_id, 99)
    assert.equal(mapped.task_id, 10)
    assert.equal(mapped.from_status, 'TODO')
    assert.equal(mapped.to_status, 'IN_PROGRESS')
    assert.equal(mapped.changed_by_user_id, 1)
  })

  it('mapEligibleAssigneeRow converts ids and excludes private data', () => {
    const row = {
      panel_membership_id: '50',
      panel_term_id: '2',
      member_id: '12',
      member_name: 'Charlie',
      student_id: '2022-1-60-001',
      position_id: '7',
      position_title: 'Junior Exec',
      team_id: '3',
      team_name: 'Hardware',
      status: 'ACTIVE',
      email: 'secret@austrc.local', // should not be in mapped output
    }

    const mapped = mapEligibleAssigneeRow(row)
    assert.equal(mapped.panel_membership_id, 50)
    assert.equal(mapped.member_id, 12)
    assert.equal(mapped.student_id, '2022-1-60-001')
    assert.equal(mapped.email, undefined)
  })
})
