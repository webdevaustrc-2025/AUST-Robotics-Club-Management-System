/**
 * pgErrors.js — PostgreSQL Error Handling & Application Error Class
 * 
 * Maps Postgres error codes to standard HTTP status codes and domain error objects.
 * Prevents raw SQL queries and sensitive internal traces from leaking to clients.
 */

import { ERROR_CODES } from '../constants/taskConstants.js'

export class AppError extends Error {
  constructor(message, { status = 400, code = ERROR_CODES.VALIDATION_ERROR, details = null } = {}) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.statusCode = status
    this.code = code
    this.details = details
  }
}

/**
 * Maps a database or runtime error into a sanitized AppError with appropriate status.
 */
export function mapPgError(err, context = {}) {
  if (err instanceof AppError) {
    return err
  }

  const pgCode = err.code

  switch (pgCode) {
    // Foreign key violation
    case '23503': {
      if (context.isDelete) {
        return new AppError('Cannot delete or unassign resource: it is referenced by other records', {
          status: 409,
          code: ERROR_CODES.ASSIGNEE_IN_USE,
        })
      }
      return new AppError('Referenced resource not found', {
        status: 422,
        code: ERROR_CODES.REFERENCE_NOT_FOUND,
      })
    }

    // Unique violation
    case '23505': {
      return new AppError('A record with the specified unique values already exists', {
        status: 409,
        code: ERROR_CODES.CONFLICT,
      })
    }

    // Check violation
    case '23514': {
      return new AppError('Value violates validation constraints', {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      })
    }

    // Invalid text representation (e.g. invalid uuid/int syntax) or numeric overflow
    case '22P02':
    case '22003': {
      return new AppError('Invalid parameter format or number out of allowed range', {
        status: 400,
        code: ERROR_CODES.VALIDATION_ERROR,
      })
    }

    default: {
      return new AppError('An unexpected database error occurred', {
        status: 500,
        code: ERROR_CODES.INTERNAL_ERROR,
      })
    }
  }
}
