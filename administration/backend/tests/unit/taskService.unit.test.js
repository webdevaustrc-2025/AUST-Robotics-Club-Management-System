import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import * as taskStatusHistoryRepository from '../../repositories/taskStatusHistoryRepository.js'
import * as taskRepository from '../../repositories/taskRepository.js'
import { createTask, transitionTaskStatus } from '../../services/taskService.js'

describe('Task Service Unit & Invariant Tests', () => {
  test('F6-T12: taskStatusHistoryRepository exports only create and findByTaskId', () => {
    const exportedKeys = Object.keys(taskStatusHistoryRepository).sort()
    assert.deepEqual(exportedKeys, ['create', 'findByTaskId'])
  })

  test('F4-T9: taskRepository.update allowlists columns and ignores hostile or non-allowlisted properties', async () => {
    const executedQueries = []
    const mockClient = {
      async query(sql, params) {
        executedQueries.push({ sql, params })
        return { rows: [{ task_id: 1, task_title: 'Updated' }] }
      },
    }

    // Hostile attempt to inject columns or forbidden fields
    const hostilePayload = {
      task_title: 'Safe Title',
      status: 'DONE',
      completed_at: new Date().toISOString(),
      assigner_membership_id: 999,
      panel_term_id: 123,
      "task_title = 'x', status": 'pwned',
      "admin = TRUE; --": 'bad',
    }

    await taskRepository.update(mockClient, 1, hostilePayload)

    assert.equal(executedQueries.length, 1)
    const { sql, params } = executedQueries[0]

    // Only task_title should be in the SET clause
    assert.match(sql, /UPDATE adm_tasks\s+SET task_title = \$2\s+WHERE task_id = \$1/i)
    assert.doesNotMatch(sql, /status/i)
    assert.doesNotMatch(sql, /completed_at/i)
    assert.doesNotMatch(sql, /assigner_membership_id/i)
    assert.doesNotMatch(sql, /admin/i)
    assert.deepEqual(params, [1, 'Safe Title'])
  })

  test('F2-T13: createTask rolls back transaction if assignee insertion throws', async () => {
    const queryLog = []
    let rolledBack = false
    let released = false

    const mockClient = {
      async query(sql, params) {
        queryLog.push(sql.trim().split('\n')[0].trim())
        if (sql.includes('BEGIN')) return {}
        if (sql.includes('ROLLBACK')) {
          rolledBack = true
          return {}
        }
        if (sql.includes('adm_panel_memberships m') && sql.includes('core_members mem')) {
          // findActiveMembershipsForUser
          return {
            rows: [
              {
                panel_membership_id: 10,
                member_id: 5,
                position_id: 2,
                hierarchy_level: 50,
                can_assign_tasks: true,
                status: 'ACTIVE',
                ended_at: null,
              },
            ],
          }
        }
        if (sql.includes('loadTargetsForAssignment') || sql.includes('ANY($1::bigint[])')) {
          return {
            rows: [
              {
                panel_membership_id: 20,
                panel_term_id: 1,
                member_id: 6,
                rank: 10,
                status: 'ACTIVE',
                ended_at: null,
                is_active: true,
              },
            ],
          }
        }
        if (sql.includes('INSERT INTO adm_tasks')) {
          return { rows: [{ task_id: 100 }] }
        }
        if (sql.includes('INSERT INTO adm_task_status_history')) {
          return { rows: [{ task_status_history_id: 1 }] }
        }
        if (sql.includes('INSERT INTO adm_task_assignees')) {
          throw new Error('Simulated DB error on assignee insert')
        }
        return { rows: [] }
      },
      release() {
        released = true
      },
    }

    const mockPool = {
      async connect() {
        return mockClient
      },
    }

    await assert.rejects(
      async () => {
        await createTask(
          {
            userId: 5,
            payload: {
              panel_term_id: 1,
              team_id: 1,
              task_title: 'Test Rollback',
              panel_membership_ids: [20],
            },
          },
          mockPool
        )
      },
      {
        name: 'AppError',
      }
    )

    assert.equal(rolledBack, true, 'Transaction should have rolled back')
    assert.equal(released, true, 'Client should have been released')
  })

  test('F6-T9: transitionTaskStatus rolls back status update if history insert throws', async () => {
    let rolledBack = false
    let released = false

    const mockClient = {
      async query(sql, params) {
        if (sql.includes('BEGIN')) return {}
        if (sql.includes('ROLLBACK')) {
          rolledBack = true
          return {}
        }
        if (sql.includes('FOR UPDATE')) {
          return {
            rows: [
              {
                task_id: 100,
                status: 'TODO',
                assigner_membership_id: 10,
                panel_term_id: 1,
                team_id: 1,
              },
            ],
          }
        }
        if (sql.includes('findAssigneesForTask') || sql.includes('FROM adm_task_assignees')) {
          return {
            rows: [
              {
                task_assignee_id: 1,
                panel_membership_id: 20,
                member_id: 6,
              },
            ],
          }
        }
        if (sql.includes('getUserMembershipIds') || (sql.includes('core_members mem') && sql.includes('mem.user_id = $1'))) {
          return { rows: [{ panel_membership_id: 10 }] }
        }
        if (sql.includes('UPDATE adm_tasks')) {
          return { rows: [{ task_id: 100, status: 'IN_PROGRESS' }] }
        }
        if (sql.includes('INSERT INTO adm_task_status_history')) {
          throw new Error('Simulated DB failure on status history insert')
        }
        return { rows: [] }
      },
      release() {
        released = true
      },
    }

    const mockPool = {
      async connect() {
        return mockClient
      },
    }

    await assert.rejects(
      async () => {
        await transitionTaskStatus(
          {
            userId: 5,
            taskId: 100,
            payload: {
              to_status: 'IN_PROGRESS',
            },
          },
          mockPool
        )
      },
      {
        name: 'AppError',
      }
    )

    assert.equal(rolledBack, true, 'Transaction should have rolled back')
    assert.equal(released, true, 'Client should have been released')
  })
})
