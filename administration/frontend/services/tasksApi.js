/**
 * tasksApi.js — Task Management Dummy API Service
 * 
 * NOTE: DUMMY — replace with real apiClient calls in Connect phase.
 * 
 * Follows the canonical PostgreSQL schema for:
 * - adm_tasks
 * - adm_task_assignees
 * - adm_panel_memberships
 */

// Initial seed data representing real AUSTRC teams, panel members, and tasks
const DUMMY_TEAMS = [
  { team_id: '1', team_name: 'Software & Autonomous Systems', team_key: 'SOFTWARE' },
  { team_id: '2', team_name: 'Hardware, Embedded & Robotics', team_key: 'HARDWARE' },
  { team_id: '3', team_name: 'Event Operations & Logistics', team_key: 'LOGISTICS' },
  { team_id: '4', team_name: 'Media, Branding & Public Relations', team_key: 'PR_MEDIA' },
  { team_id: '5', team_name: 'Research & Project Development', team_key: 'RESEARCH' },
]

const DUMMY_PANEL_TERMS = [
  { panel_term_id: '1', term_name: 'Executive Panel 2025-2026', academic_year: '2025-2026', status: 'ACTIVE' },
]

export const DUMMY_ELIGIBLE_PANEL_MEMBERS = [
  {
    panel_membership_id: '99',
    panel_term_id: '1',
    member_id: '99',
    member_name: 'Mahir Labib',
    student_id: '01.01.04.099',
    position_id: '1',
    position_title: 'President',
    hierarchy_level: 100,
    can_assign_tasks: true,
    team_id: '1',
    team_name: 'Software & Autonomous Systems',
    status: 'ACTIVE',
  },
  {
    panel_membership_id: '101',
    panel_term_id: '1',
    member_id: '1',
    member_name: 'Tahmidur Rahman',
    student_id: '01.01.04.101',
    position_id: '2',
    position_title: 'Director',
    hierarchy_level: 50,
    can_assign_tasks: true,
    team_id: '1',
    team_name: 'Software & Autonomous Systems',
    status: 'ACTIVE',
  },
  {
    panel_membership_id: '102',
    panel_term_id: '1',
    member_id: '2',
    member_name: 'Sadia Afroz',
    student_id: '01.01.04.102',
    position_id: '3',
    position_title: 'Assistant Director',
    hierarchy_level: 40,
    can_assign_tasks: true,
    team_id: '1',
    team_name: 'Software & Autonomous Systems',
    status: 'ACTIVE',
  },
  {
    panel_membership_id: '103',
    panel_term_id: '1',
    member_id: '3',
    member_name: 'Fahim Ishrak',
    student_id: '01.01.04.103',
    position_id: '4',
    position_title: 'Senior Sub-Executive',
    hierarchy_level: 20,
    can_assign_tasks: true,
    team_id: '1',
    team_name: 'Software & Autonomous Systems',
    status: 'ACTIVE',
  },
  {
    panel_membership_id: '104',
    panel_term_id: '1',
    member_id: '4',
    member_name: 'Nusrat Jahan',
    student_id: '01.01.04.104',
    position_id: '5',
    position_title: 'Sub-Executive',
    hierarchy_level: 10,
    can_assign_tasks: false,
    team_id: '2',
    team_name: 'Hardware, Embedded & Robotics',
    status: 'ACTIVE',
  },
  {
    panel_membership_id: '105',
    panel_term_id: '1',
    member_id: '5',
    member_name: 'Tanvir Hossain',
    student_id: '01.01.04.105',
    position_id: '4',
    position_title: 'Senior Sub-Executive',
    hierarchy_level: 20,
    can_assign_tasks: true,
    team_id: '2',
    team_name: 'Hardware, Embedded & Robotics',
    status: 'ACTIVE',
  },
  {
    panel_membership_id: '106',
    panel_term_id: '1',
    member_id: '6',
    member_name: 'Mehedi Hasan',
    student_id: '01.01.04.106',
    position_id: '3',
    position_title: 'Assistant Director',
    hierarchy_level: 40,
    can_assign_tasks: true,
    team_id: '3',
    team_name: 'Event Operations & Logistics',
    status: 'ACTIVE',
  },
  {
    panel_membership_id: '107',
    panel_term_id: '1',
    member_id: '7',
    member_name: 'Zarin Tasnim',
    student_id: '01.01.04.107',
    position_id: '5',
    position_title: 'Sub-Executive',
    hierarchy_level: 10,
    can_assign_tasks: false,
    team_id: '4',
    team_name: 'Media, Branding & Public Relations',
    status: 'ACTIVE',
  },
  {
    panel_membership_id: '108',
    panel_term_id: '1',
    member_id: '8',
    member_name: 'Abrar Shahriar',
    student_id: '01.01.04.108',
    position_id: '5',
    position_title: 'Sub-Executive',
    hierarchy_level: 10,
    can_assign_tasks: false,
    team_id: '5',
    team_name: 'Research & Project Development',
    status: 'ACTIVE',
  },
  {
    panel_membership_id: '109',
    panel_term_id: '1',
    member_id: '9',
    member_name: 'Asif Karim',
    student_id: '01.01.04.109',
    position_id: '6',
    position_title: 'Advisor',
    hierarchy_level: 0,
    can_assign_tasks: false,
    team_id: '1',
    team_name: 'Software & Autonomous Systems',
    status: 'ACTIVE',
  },
]

// Mock current actor in dummy mode (defaults to Director Tahmidur Rahman, level 50)
let currentActorMembershipId = '101'

export function getMockCurrentActorMembership() {
  return (
    DUMMY_ELIGIBLE_PANEL_MEMBERS.find(
      (m) => String(m.panel_membership_id) === String(currentActorMembershipId)
    ) || DUMMY_ELIGIBLE_PANEL_MEMBERS[1]
  )
}

export function setMockCurrentActorMembership(panelMembershipId) {
  currentActorMembershipId = String(panelMembershipId)
}

let dummyTasks = [
  {
    task_id: '1',
    panel_term_id: '1',
    team_id: '1',
    assigner_membership_id: '101',
    task_title: 'Implement QR Code Verification Service for Robolympics 2026',
    task_description:
      'Develop the backend cryptographic validation and rate limiting service for scanning participant QR badges at check-in stations.',
    priority: 'CRITICAL',
    status: 'IN_PROGRESS',
    due_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    blocked_reason: null,
    completed_at: null,
    created_at: '2026-09-10T10:00:00Z',
    updated_at: '2026-09-12T14:30:00Z',
  },
  {
    task_id: '2',
    panel_term_id: '1',
    team_id: '2',
    assigner_membership_id: '101',
    task_title: 'Calibrate Arena Sensors & Infrared Gate Arrays',
    task_description:
      'Inspect line follower arena timing gates and test ultrasonic distance telemetry sensors before the preliminary round.',
    priority: 'HIGH',
    status: 'TODO',
    due_at: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    blocked_reason: null,
    completed_at: null,
    created_at: '2026-09-12T09:15:00Z',
    updated_at: '2026-09-12T09:15:00Z',
  },
  {
    task_id: '3',
    panel_term_id: '1',
    team_id: '3',
    assigner_membership_id: '106',
    task_title: 'Procure VIP Certificates & Acrylic Trophy Stands',
    task_description:
      'Coordinate with vendor for laser-cut acrylic awards and verify high-density GSM certificate paper quality.',
    priority: 'MEDIUM',
    status: 'BLOCKED',
    due_at: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    blocked_reason: 'Awaiting vendor invoice approval and official club seal stamping clearance from the university proctor office.',
    completed_at: null,
    created_at: '2026-09-08T11:00:00Z',
    updated_at: '2026-09-14T16:45:00Z',
  },
  {
    task_id: '4',
    panel_term_id: '1',
    team_id: '4',
    assigner_membership_id: '101',
    task_title: 'Publish Recruitment Campaign Teaser & Social Banners',
    task_description:
      'Design high-resolution motion graphics teasers and release social media campaign kit for Spring recruitment drive.',
    priority: 'HIGH',
    status: 'DONE',
    due_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    blocked_reason: null,
    completed_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: '2026-09-05T08:00:00Z',
    updated_at: '2026-09-16T18:20:00Z',
  },
  {
    task_id: '5',
    panel_term_id: '1',
    team_id: '5',
    assigner_membership_id: '101',
    task_title: 'Compile Autonomous Rover Simulation Benchmark Report',
    task_description:
      'Synthesize Gazebo ROS2 simulation results for obstacle avoidance algorithms across 50 Monte Carlo trials.',
    priority: 'LOW',
    status: 'TODO',
    due_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
    blocked_reason: null,
    completed_at: null,
    created_at: '2026-09-14T12:00:00Z',
    updated_at: '2026-09-14T12:00:00Z',
  },
]

let dummyTaskAssignees = [
  {
    task_assignee_id: '1',
    task_id: '1',
    panel_membership_id: '102',
    assigned_by_user_id: '1',
    assigned_at: '2026-09-10T10:05:00Z',
    status: 'ASSIGNED',
    completed_at: null,
  },
  {
    task_assignee_id: '2',
    task_id: '1',
    panel_membership_id: '103',
    assigned_by_user_id: '1',
    assigned_at: '2026-09-10T10:05:00Z',
    status: 'ASSIGNED',
    completed_at: null,
  },
  {
    task_assignee_id: '3',
    task_id: '2',
    panel_membership_id: '104',
    assigned_by_user_id: '1',
    assigned_at: '2026-09-12T09:20:00Z',
    status: 'ASSIGNED',
    completed_at: null,
  },
  {
    task_assignee_id: '4',
    task_id: '2',
    panel_membership_id: '105',
    assigned_by_user_id: '1',
    assigned_at: '2026-09-12T09:20:00Z',
    status: 'ASSIGNED',
    completed_at: null,
  },
  {
    task_assignee_id: '5',
    task_id: '3',
    panel_membership_id: '106',
    assigned_by_user_id: '1',
    assigned_at: '2026-09-08T11:05:00Z',
    status: 'ASSIGNED',
    completed_at: null,
  },
  {
    task_assignee_id: '6',
    task_id: '4',
    panel_membership_id: '107',
    assigned_by_user_id: '1',
    assigned_at: '2026-09-05T08:10:00Z',
    status: 'COMPLETED',
    completed_at: '2026-09-16T18:20:00Z',
  },
  {
    task_assignee_id: '7',
    task_id: '5',
    panel_membership_id: '108',
    assigned_by_user_id: '1',
    assigned_at: '2026-09-14T12:05:00Z',
    status: 'ASSIGNED',
    completed_at: null,
  },
]

let nextTaskId = 6
let nextAssigneeId = 8
let nextHistoryId = 10

let dummyTaskStatusHistory = [
  {
    task_status_history_id: '1',
    task_id: '1',
    from_status: 'TODO',
    to_status: 'IN_PROGRESS',
    changed_by_user_id: '1',
    changed_by_user_name: 'Tahmidur Rahman',
    reason: 'Commencing core validation logic and rate limiter setup',
    created_at: '2026-09-12T14:30:00Z',
  },
  {
    task_status_history_id: '2',
    task_id: '4',
    from_status: 'IN_PROGRESS',
    to_status: 'BLOCKED',
    changed_by_user_id: '1',
    changed_by_user_name: 'Tahmidur Rahman',
    reason: 'Awaiting high-resolution vector assets and branding guide approval from PR head',
    created_at: '2026-09-13T16:00:00Z',
  },
  {
    task_status_history_id: '3',
    task_id: '5',
    from_status: 'IN_PROGRESS',
    to_status: 'DONE',
    changed_by_user_id: '1',
    changed_by_user_name: 'Tahmidur Rahman',
    reason: 'Audit complete and report signed off by Lab In-Charge',
    created_at: '2026-09-14T11:00:00Z',
  },
]

// Helper to simulate realistic async latency
const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Join full panel member details onto task assignees
 */
function enrichTask(task) {
  const team = DUMMY_TEAMS.find((t) => String(t.team_id) === String(task.team_id))
  const assigner = DUMMY_ELIGIBLE_PANEL_MEMBERS.find(
    (m) => String(m.panel_membership_id) === String(task.assigner_membership_id)
  )

  const assignees = dummyTaskAssignees
    .filter((a) => String(a.task_id) === String(task.task_id))
    .map((assigneeRow) => {
      const member = DUMMY_ELIGIBLE_PANEL_MEMBERS.find(
        (m) => String(m.panel_membership_id) === String(assigneeRow.panel_membership_id)
      )
      return {
        task_assignee_id: assigneeRow.task_assignee_id,
        task_id: assigneeRow.task_id,
        panel_membership_id: assigneeRow.panel_membership_id,
        member_id: member?.member_id,
        member_name: member?.member_name || 'Unknown Member',
        student_id: member?.student_id || '—',
        position_title: member?.position_title || 'Panel Member',
        team_id: member?.team_id,
        team_name: member?.team_name || 'General',
        status: assigneeRow.status,
        assigned_at: assigneeRow.assigned_at,
        completed_at: assigneeRow.completed_at,
      }
    })

  return {
    ...task,
    team_name: team?.team_name || 'General Operations',
    team_key: team?.team_key || 'GENERAL',
    assigner_name: assigner?.member_name || 'System Director',
    assigner_position: assigner?.position_title || 'Director',
    assignees,
    assignee_count: assignees.length,
  }
}

/**
 * List tasks with optional filtering and search
 */
export async function listTasks(filters = {}) {
  await delay()
  let result = [...dummyTasks]

  if (filters.team_id && filters.team_id !== 'ALL') {
    result = result.filter((t) => String(t.team_id) === String(filters.team_id))
  }

  if (filters.status && filters.status !== 'ALL') {
    result = result.filter((t) => t.status === filters.status)
  }

  if (filters.priority && filters.priority !== 'ALL') {
    result = result.filter((t) => t.priority === filters.priority)
  }

  if (filters.search && filters.search.trim()) {
    const query = filters.search.toLowerCase().trim()
    result = result.filter(
      (t) =>
        t.task_title.toLowerCase().includes(query) ||
        (t.task_description && t.task_description.toLowerCase().includes(query))
    )
  }

  // Sort: newest first
  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  return result.map(enrichTask)
}

/**
 * Get single task by task_id with full details and assignees
 */
export async function getTask(taskId) {
  await delay()
  const task = dummyTasks.find((t) => String(t.task_id) === String(taskId))
  if (!task) {
    throw new Error(`Task with ID ${taskId} not found`)
  }
  return enrichTask(task)
}

function validateAssignmentHierarchy(actor, panelMembershipIds = []) {
  if (!actor) {
    const err = new Error('No active panel membership in this term')
    err.status = 403
    err.code = 'NO_ACTIVE_MEMBERSHIP'
    throw err
  }

  if (!actor.can_assign_tasks) {
    const err = new Error('Your position is not authorized to assign tasks')
    err.status = 403
    err.code = 'CANNOT_ASSIGN_TASKS'
    throw err
  }

  if ((actor.hierarchy_level || 0) <= 0) {
    const err = new Error('Actor position is not ranked in hierarchy')
    err.status = 403
    err.code = 'POSITION_NOT_IN_HIERARCHY'
    throw err
  }

  if (!panelMembershipIds.length) return

  const failures = []
  for (const id of panelMembershipIds) {
    const target = DUMMY_ELIGIBLE_PANEL_MEMBERS.find(
      (m) => String(m.panel_membership_id) === String(id)
    )
    if (!target || target.status !== 'ACTIVE') {
      const err = new Error('One or more assignees are ineligible')
      err.status = 422
      err.code = 'INELIGIBLE_ASSIGNEE'
      err.details = [{ panel_membership_id: id, reason: 'NOT_FOUND_OR_INACTIVE' }]
      throw err
    }

    if (String(target.member_id) === String(actor.member_id)) {
      failures.push({
        panel_membership_id: target.panel_membership_id,
        member_id: target.member_id,
        reason: 'SELF',
      })
    } else if ((target.hierarchy_level || 0) <= 0) {
      failures.push({
        panel_membership_id: target.panel_membership_id,
        member_id: target.member_id,
        reason: 'POSITION_NOT_IN_HIERARCHY',
      })
    } else if (target.hierarchy_level === actor.hierarchy_level) {
      failures.push({
        panel_membership_id: target.panel_membership_id,
        member_id: target.member_id,
        reason: 'SAME_RANK',
      })
    } else if (target.hierarchy_level > actor.hierarchy_level) {
      failures.push({
        panel_membership_id: target.panel_membership_id,
        member_id: target.member_id,
        reason: 'HIGHER_RANK',
      })
    }
  }

  if (failures.length > 0) {
    const err = new Error(
      'Hierarchy violation: one or more assignees cannot be assigned by this actor'
    )
    err.status = 403
    err.code = 'HIERARCHY_VIOLATION'
    err.details = failures
    throw err
  }
}

/**
 * Create a new task with multiple assignees
 */
export async function createTask(payload) {
  await delay()
  const actor = getMockCurrentActorMembership()
  validateAssignmentHierarchy(actor, payload.panel_membership_ids || [])

  const now = new Date().toISOString()
  const newId = String(nextTaskId++)

  const newTask = {
    task_id: newId,
    panel_term_id: payload.panel_term_id || '1',
    team_id: String(payload.team_id),
    assigner_membership_id: String(actor?.panel_membership_id || payload.assigner_membership_id || '101'),
    task_title: payload.task_title.trim(),
    task_description: payload.task_description ? payload.task_description.trim() : null,
    priority: payload.priority || 'MEDIUM',
    status: 'TODO',
    due_at: payload.due_at || null,
    blocked_reason: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  }

  dummyTasks.unshift(newTask)

  // Assign members via panel_membership_id
  if (Array.isArray(payload.panel_membership_ids) && payload.panel_membership_ids.length > 0) {
    for (const membershipId of payload.panel_membership_ids) {
      dummyTaskAssignees.push({
        task_assignee_id: String(nextAssigneeId++),
        task_id: newId,
        panel_membership_id: String(membershipId),
        assigned_by_user_id: String(actor?.member_id || '1'),
        assigned_at: now,
        status: 'ASSIGNED',
        completed_at: null,
      })
    }
  }

  return enrichTask(newTask)
}

/**
 * Update an existing task
 */
export async function updateTask(taskId, fields) {
  await delay()
  const index = dummyTasks.findIndex((t) => String(t.task_id) === String(taskId))
  if (index === -1) {
    throw new Error(`Task with ID ${taskId} not found`)
  }

  const current = dummyTasks[index]
  const updated = {
    ...current,
    ...(fields.task_title !== undefined ? { task_title: fields.task_title.trim() } : {}),
    ...(fields.task_description !== undefined ? { task_description: fields.task_description?.trim() || null } : {}),
    ...(fields.priority !== undefined ? { priority: fields.priority } : {}),
    ...(fields.team_id !== undefined ? { team_id: String(fields.team_id) } : {}),
    ...(fields.due_at !== undefined ? { due_at: fields.due_at } : {}),
    updated_at: new Date().toISOString(),
  }

  dummyTasks[index] = updated
  return enrichTask(updated)
}

/**
 * Assign one or more panel members to a task (enforcing uniqueness)
 */
export async function assignMembers(taskId, panelMembershipIds = []) {
  await delay()
  const actor = getMockCurrentActorMembership()
  validateAssignmentHierarchy(actor, panelMembershipIds)

  const now = new Date().toISOString()
  const added = []

  for (const membershipId of panelMembershipIds) {
    const exists = dummyTaskAssignees.some(
      (a) => String(a.task_id) === String(taskId) && String(a.panel_membership_id) === String(membershipId)
    )
    if (!exists) {
      const row = {
        task_assignee_id: String(nextAssigneeId++),
        task_id: String(taskId),
        panel_membership_id: String(membershipId),
        assigned_by_user_id: String(actor?.member_id || '1'),
        assigned_at: now,
        status: 'ASSIGNED',
        completed_at: null,
      }
      dummyTaskAssignees.push(row)
      added.push(row)
    }
  }

  return getTask(taskId)
}

/**
 * Unassign a panel member from a task
 */
export async function unassignMember(taskId, panelMembershipId) {
  await delay()
  dummyTaskAssignees = dummyTaskAssignees.filter(
    (a) => !(String(a.task_id) === String(taskId) && String(a.panel_membership_id) === String(panelMembershipId))
  )
  return getTask(taskId)
}

/**
 * Delete a task and its assignees
 */
export async function deleteTask(taskId) {
  await delay()
  const exists = dummyTasks.some((t) => String(t.task_id) === String(taskId))
  if (!exists) {
    throw new Error(`Task with ID ${taskId} not found`)
  }
  dummyTasks = dummyTasks.filter((t) => String(t.task_id) !== String(taskId))
  dummyTaskAssignees = dummyTaskAssignees.filter((a) => String(a.task_id) !== String(taskId))
  return true
}

/**
 * List eligible active panel members for assignment
 */
export async function listEligibleAssignees(filters = {}) {
  await delay()
  const actor = getMockCurrentActorMembership()
  if (!actor || !actor.can_assign_tasks || (actor.hierarchy_level || 0) <= 0) {
    return []
  }

  let list = DUMMY_ELIGIBLE_PANEL_MEMBERS.filter((m) => {
    // Cannot assign self
    if (String(m.member_id) === String(actor.member_id)) return false
    // Must be active
    if (m.status !== 'ACTIVE') return false
    // Target must be ranked in hierarchy
    if ((m.hierarchy_level || 0) <= 0) return false
    // Actor must strictly outrank target
    if (m.hierarchy_level >= actor.hierarchy_level) return false
    // Panel term filter if specified
    if (filters.panel_term_id && String(m.panel_term_id) !== String(filters.panel_term_id)) {
      return false
    }
    return true
  })

  if (filters.team_id && filters.team_id !== 'ALL') {
    list = list.filter((m) => String(m.team_id) === String(filters.team_id))
  }
  return [...list]
}

/**
 * List AUSTRC teams
 */
export async function listTeams() {
  await delay()
  return [...DUMMY_TEAMS]
}

/**
 * List panel terms
 */
export async function listPanelTerms() {
  await delay()
  return [...DUMMY_PANEL_TERMS]
}

/**
 * List status transition history for a task (ordered chronologically)
 */
export async function listTaskStatusHistory(taskId) {
  await delay()
  return dummyTaskStatusHistory
    .filter((h) => String(h.task_id) === String(taskId))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

/**
 * Transition task status (strictly enforces canonical values: TODO, IN_PROGRESS, BLOCKED, DONE)
 * If transitioning to BLOCKED, a reason is required.
 */
export async function transitionTaskStatus(taskId, { to_status, reason = '' }) {
  await delay()
  const validStatuses = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']
  if (!validStatuses.includes(to_status)) {
    throw new Error(`Invalid status "${to_status}". Must be one of: ${validStatuses.join(', ')}`)
  }

  const index = dummyTasks.findIndex((t) => String(t.task_id) === String(taskId))
  if (index === -1) {
    throw new Error(`Task with ID ${taskId} not found`)
  }

  const current = dummyTasks[index]
  const from_status = current.status

  if (to_status === 'BLOCKED' && (!reason || !reason.trim())) {
    throw new Error('A reason is required when marking a task as BLOCKED')
  }

  const now = new Date().toISOString()
  const updatedTask = {
    ...current,
    status: to_status,
    blocked_reason: to_status === 'BLOCKED' ? (reason?.trim() || 'Blocked') : null,
    completed_at: to_status === 'DONE' ? now : null,
    updated_at: now,
  }

  dummyTasks[index] = updatedTask

  const historyRecord = {
    task_status_history_id: String(nextHistoryId++),
    task_id: String(taskId),
    from_status,
    to_status,
    changed_by_user_id: '1',
    changed_by_user_name: 'System Admin',
    reason: reason?.trim() || null,
    created_at: now,
  }

  dummyTaskStatusHistory.push(historyRecord)

  return {
    task: enrichTask(updatedTask),
    history: historyRecord,
  }
}

