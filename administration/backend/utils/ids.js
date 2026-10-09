/**
 * ids.js — BigInt Identifier Parsing and Validation
 * 
 * Validates route parameters and ensures identifiers are valid positive integers
 * within the supported safe BigInt range.
 */

import { AppError } from './pgErrors.js'
import { ERROR_CODES } from '../constants/taskConstants.js'

/**
 * Parses and validates a parameter as a positive safe integer.
 * Throws 400 AppError on invalid format, decimals, non-positive, or overflow.
 */
export function parseBigintId(value, paramName = 'id') {
  if (value === undefined || value === null) {
    throw new AppError(`Missing required parameter "${paramName}"`, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    })
  }

  const str = String(value).trim()

  // Must be strictly digits (no signs, no decimals, no whitespace)
  if (!/^\d+$/.test(str)) {
    throw new AppError(`Invalid ${paramName}: must be a positive integer`, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    })
  }

  // Must not start with leading zeros unless length is 1 (e.g. "0" or "01")
  if (str.length > 1 && str.startsWith('0')) {
    throw new AppError(`Invalid ${paramName}: leading zeros are not allowed`, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    })
  }

  // Check if string fits in MAX_SAFE_INTEGER
  const num = Number(str)
  if (num === 0) {
    throw new AppError(`Invalid ${paramName}: must be strictly greater than 0`, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    })
  }

  if (!Number.isSafeInteger(num) || String(num) !== str) {
    throw new AppError(`Invalid ${paramName}: value exceeds allowed integer range`, {
      status: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
    })
  }

  return num
}
