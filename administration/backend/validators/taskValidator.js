/**
 * taskValidator.js — Administration Task Input Validators
 * 
 * Pure functions returning { value, errors }, with errors keyed by field name.
 * NEVER throws; validates and coerces values cleanly.
 */

import { TASK_STATUSES, TASK_PRIORITIES, DEFAULT_PRIORITY, LIMITS } from '../constants/taskConstants.js'

function isPositiveInt(val) {
  const n = Number(val)
  return Number.isInteger(n) && n > 0 && String(n) === String(val).trim()
}

function isValidIsoDate(val) {
  if (typeof val !== 'string') return false
  const d = new Date(val)
  return !Number.isNaN(d.getTime()) && val.includes('T')
}

export function validateCreate(payload = {}) {
  const errors = {}
  const value = {}

  // panel_term_id (required positive int)
  if (!payload.panel_term_id && payload.panel_term_id !== 0) {
    errors.panel_term_id = ['panel_term_id is required']
  } else if (!isPositiveInt(payload.panel_term_id)) {
    errors.panel_term_id = ['panel_term_id must be a positive integer']
  } else {
    value.panel_term_id = Number(payload.panel_term_id)
  }

  // team_id (required positive int)
  if (!payload.team_id && payload.team_id !== 0) {
    errors.team_id = ['team_id is required']
  } else if (!isPositiveInt(payload.team_id)) {
    errors.team_id = ['team_id must be a positive integer']
  } else {
    value.team_id = Number(payload.team_id)
  }

  // task_title (required, 1..255 trimmed)
  if (typeof payload.task_title !== 'string' || !payload.task_title.trim()) {
    errors.task_title = ['task_title is required and cannot be empty']
  } else if (payload.task_title.trim().length > LIMITS.TITLE_MAX_LENGTH) {
    errors.task_title = [`task_title exceeds maximum length of ${LIMITS.TITLE_MAX_LENGTH} characters`]
  } else {
    value.task_title = payload.task_title.trim()
  }

  // task_description (optional string, max 10000)
  if (payload.task_description !== undefined && payload.task_description !== null) {
    if (typeof payload.task_description !== 'string') {
      errors.task_description = ['task_description must be a string']
    } else if (payload.task_description.length > LIMITS.DESCRIPTION_MAX_CAP) {
      errors.task_description = [`task_description exceeds maximum length of ${LIMITS.DESCRIPTION_MAX_CAP} characters`]
    } else {
      value.task_description = payload.task_description.trim()
    }
  } else {
    value.task_description = null
  }

  // priority (optional, default MEDIUM)
  if (payload.priority !== undefined && payload.priority !== null) {
    if (!TASK_PRIORITIES.includes(payload.priority)) {
      errors.priority = [`priority must be one of: ${TASK_PRIORITIES.join(', ')}`]
    } else {
      value.priority = payload.priority
    }
  } else {
    value.priority = DEFAULT_PRIORITY
  }

  // due_at (optional ISO string)
  if (payload.due_at !== undefined && payload.due_at !== null) {
    if (!isValidIsoDate(payload.due_at)) {
      errors.due_at = ['due_at must be a valid ISO-8601 date string']
    } else {
      value.due_at = new Date(payload.due_at).toISOString()
    }
  } else {
    value.due_at = null
  }

  // panel_membership_ids (optional array of positive ints, deduplicated)
  if (payload.panel_membership_ids !== undefined && payload.panel_membership_ids !== null) {
    if (!Array.isArray(payload.panel_membership_ids)) {
      errors.panel_membership_ids = ['panel_membership_ids must be an array of integers']
    } else {
      const uniqueIds = [...new Set(payload.panel_membership_ids)]
      if (uniqueIds.length > LIMITS.MAX_ASSIGNEES_BATCH) {
        errors.panel_membership_ids = [`Cannot assign more than ${LIMITS.MAX_ASSIGNEES_BATCH} members at once`]
      } else {
        const invalid = uniqueIds.some((id) => !isPositiveInt(id))
        if (invalid) {
          errors.panel_membership_ids = ['All panel_membership_ids must be positive integers']
        } else {
          value.panel_membership_ids = uniqueIds.map(Number)
        }
      }
    }
  } else {
    value.panel_membership_ids = []
  }

  return {
    value: Object.keys(errors).length === 0 ? value : null,
    errors: Object.keys(errors).length > 0 ? errors : null,
  }
}

export function validateUpdate(payload = {}) {
  const errors = {}
  const value = {}

  let hasUpdates = false

  // task_title
  if (payload.task_title !== undefined) {
    hasUpdates = true
    if (typeof payload.task_title !== 'string' || !payload.task_title.trim()) {
      errors.task_title = ['task_title cannot be empty']
    } else if (payload.task_title.trim().length > LIMITS.TITLE_MAX_LENGTH) {
      errors.task_title = [`task_title exceeds maximum length of ${LIMITS.TITLE_MAX_LENGTH} characters`]
    } else {
      value.task_title = payload.task_title.trim()
    }
  }

  // task_description
  if (payload.task_description !== undefined) {
    hasUpdates = true
    if (payload.task_description === null) {
      value.task_description = null
    } else if (typeof payload.task_description !== 'string') {
      errors.task_description = ['task_description must be a string or null']
    } else if (payload.task_description.length > LIMITS.DESCRIPTION_MAX_CAP) {
      errors.task_description = [`task_description exceeds maximum length of ${LIMITS.DESCRIPTION_MAX_CAP} characters`]
    } else {
      value.task_description = payload.task_description.trim()
    }
  }

  // priority
  if (payload.priority !== undefined) {
    hasUpdates = true
    if (!TASK_PRIORITIES.includes(payload.priority)) {
      errors.priority = [`priority must be one of: ${TASK_PRIORITIES.join(', ')}`]
    } else {
      value.priority = payload.priority
    }
  }

  // due_at
  if (payload.due_at !== undefined) {
    hasUpdates = true
    if (payload.due_at === null) {
      value.due_at = null
    } else if (!isValidIsoDate(payload.due_at)) {
      errors.due_at = ['due_at must be a valid ISO-8601 date string or null']
    } else {
      value.due_at = new Date(payload.due_at).toISOString()
    }
  }

  if (!hasUpdates) {
    errors._general = ['At least one field must be provided for update']
  }

  return {
    value: Object.keys(errors).length === 0 ? value : null,
    errors: Object.keys(errors).length > 0 ? errors : null,
  }
}

export function validateAssign(payload = {}) {
  const errors = {}
  const value = {}

  if (!Array.isArray(payload.panel_membership_ids) || payload.panel_membership_ids.length === 0) {
    errors.panel_membership_ids = ['panel_membership_ids must be a non-empty array']
  } else {
    const uniqueIds = [...new Set(payload.panel_membership_ids)]
    if (uniqueIds.length > LIMITS.MAX_ASSIGNEES_BATCH) {
      errors.panel_membership_ids = [`Cannot assign more than ${LIMITS.MAX_ASSIGNEES_BATCH} members at once`]
    } else {
      const invalid = uniqueIds.some((id) => !isPositiveInt(id))
      if (invalid) {
        errors.panel_membership_ids = ['All panel_membership_ids must be positive integers']
      } else {
        value.panel_membership_ids = uniqueIds.map(Number)
      }
    }
  }

  return {
    value: Object.keys(errors).length === 0 ? value : null,
    errors: Object.keys(errors).length > 0 ? errors : null,
  }
}

export function validateTransition(payload = {}) {
  const errors = {}
  const value = {}

  if (!payload.to_status) {
    errors.to_status = ['to_status is required']
  } else if (!TASK_STATUSES.includes(payload.to_status)) {
    errors.to_status = [`to_status must be one of: ${TASK_STATUSES.join(', ')}`]
  } else {
    value.to_status = payload.to_status
  }

  // Reason: required if BLOCKED
  if (payload.to_status === 'BLOCKED') {
    if (typeof payload.reason !== 'string' || !payload.reason.trim()) {
      errors.reason = ['reason is required when transitioning status to BLOCKED']
    } else if (payload.reason.trim().length > LIMITS.BLOCKED_REASON_MAX_LENGTH) {
      errors.reason = [`reason exceeds maximum length of ${LIMITS.BLOCKED_REASON_MAX_LENGTH} characters`]
    } else {
      value.reason = payload.reason.trim()
    }
  } else if (payload.reason !== undefined && payload.reason !== null) {
    if (typeof payload.reason !== 'string') {
      errors.reason = ['reason must be a string']
    } else if (payload.reason.length > LIMITS.REASON_MAX_LENGTH) {
      errors.reason = [`reason exceeds maximum length of ${LIMITS.REASON_MAX_LENGTH} characters`]
    } else {
      value.reason = payload.reason.trim()
    }
  } else {
    value.reason = null
  }

  return {
    value: Object.keys(errors).length === 0 ? value : null,
    errors: Object.keys(errors).length > 0 ? errors : null,
  }
}

export function validateListQuery(query = {}) {
  const errors = {}
  const value = {}

  if (query.panel_term_id !== undefined) {
    if (!isPositiveInt(query.panel_term_id)) {
      errors.panel_term_id = ['panel_term_id must be a positive integer']
    } else {
      value.panel_term_id = Number(query.panel_term_id)
    }
  }

  if (query.team_id !== undefined) {
    if (!isPositiveInt(query.team_id)) {
      errors.team_id = ['team_id must be a positive integer']
    } else {
      value.team_id = Number(query.team_id)
    }
  }

  if (query.status !== undefined) {
    if (!TASK_STATUSES.includes(query.status)) {
      errors.status = [`status must be one of: ${TASK_STATUSES.join(', ')}`]
    } else {
      value.status = query.status
    }
  }

  if (query.priority !== undefined) {
    if (!TASK_PRIORITIES.includes(query.priority)) {
      errors.priority = [`priority must be one of: ${TASK_PRIORITIES.join(', ')}`]
    } else {
      value.priority = query.priority
    }
  }

  const limit = query.limit !== undefined ? Number(query.limit) : 100
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    errors.limit = ['limit must be an integer between 1 and 100']
  } else {
    value.limit = limit
  }

  const offset = query.offset !== undefined ? Number(query.offset) : 0
  if (!Number.isInteger(offset) || offset < 0) {
    errors.offset = ['offset must be a non-negative integer']
  } else {
    value.offset = offset
  }

  return {
    value: Object.keys(errors).length === 0 ? value : null,
    errors: Object.keys(errors).length > 0 ? errors : null,
  }
}

export function validateEligibleQuery(query = {}) {
  const errors = {}
  const value = {}

  if (!query.panel_term_id && query.panel_term_id !== 0) {
    errors.panel_term_id = ['panel_term_id is required']
  } else if (!isPositiveInt(query.panel_term_id)) {
    errors.panel_term_id = ['panel_term_id must be a positive integer']
  } else {
    value.panel_term_id = Number(query.panel_term_id)
  }

  if (query.team_id !== undefined) {
    if (!isPositiveInt(query.team_id)) {
      errors.team_id = ['team_id must be a positive integer']
    } else {
      value.team_id = Number(query.team_id)
    }
  }

  return {
    value: Object.keys(errors).length === 0 ? value : null,
    errors: Object.keys(errors).length > 0 ? errors : null,
  }
}
