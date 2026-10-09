/**
 * taskConstants.js — Administration Task Constants & Error Codes
 * 
 * Defines task statuses, priorities, permissions, limits, and error codes.
 * Conforms to Decision Gates D1-D9 and rules H1-H10.
 */

export const TASK_STATUSES = Object.freeze(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'])

export const TASK_PRIORITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])

export const DEFAULT_PRIORITY = 'MEDIUM'
export const DEFAULT_STATUS = 'TODO'

// Permissions (D3 placeholder constants)
export const TASK_PERMISSIONS = Object.freeze({
  CREATE: 'adm.task.create',
  VIEW_ALL: 'adm.task.view_all',
  MANAGE: 'adm.task.manage',
})

// Validation Limits
export const LIMITS = Object.freeze({
  TITLE_MAX_LENGTH: 255,
  REASON_MAX_LENGTH: 500,
  BLOCKED_REASON_MAX_LENGTH: 500,
  DESCRIPTION_MAX_CAP: 10000,
  MAX_ASSIGNEES_BATCH: 50,
})

// Hierarchy Reasons (H6)
export const HIERARCHY_VIOLATION_REASONS = Object.freeze([
  'SELF',
  'SAME_RANK',
  'HIGHER_RANK',
  'POSITION_NOT_IN_HIERARCHY',
  'ACTOR_POSITION_NOT_IN_HIERARCHY',
])

// Error Codes
export const ERROR_CODES = Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NO_ACTIVE_MEMBERSHIP: 'NO_ACTIVE_MEMBERSHIP',
  CANNOT_ASSIGN_TASKS: 'CANNOT_ASSIGN_TASKS',
  POSITION_NOT_IN_HIERARCHY: 'POSITION_NOT_IN_HIERARCHY',
  HIERARCHY_VIOLATION: 'HIERARCHY_VIOLATION',
  INELIGIBLE_ASSIGNEE: 'INELIGIBLE_ASSIGNEE',
  STATUS_UNCHANGED: 'STATUS_UNCHANGED',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',
  REFERENCE_NOT_FOUND: 'REFERENCE_NOT_FOUND',
  ASSIGNEE_IN_USE: 'ASSIGNEE_IN_USE',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
})
