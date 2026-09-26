/**
 * Validator for task submissions
 */
export function validateTaskSubmission(data) {
  const errors = []

  const { submissionText, submissionLink, fileIds } = data

  const hasText = Boolean(submissionText && submissionText.trim().length > 0)
  const hasLink = Boolean(submissionLink && submissionLink.trim().length > 0)
  const hasFiles = Array.isArray(fileIds) && fileIds.length > 0

  if (!hasText && !hasLink && !hasFiles) {
    errors.push('Submission must contain submission text, a submission link, or attached files.')
  }

  if (submissionLink && submissionLink.trim().length > 0) {
    try {
      const url = new URL(submissionLink)
      if (!['http:', 'https:'].includes(url.protocol)) {
        errors.push('Submission link must start with http:// or https://')
      }
    } catch {
      errors.push('Submission link must be a valid URL (e.g., https://github.com/user/repo).')
    }
  }

  if (fileIds && !Array.isArray(fileIds)) {
    errors.push('fileIds must be an array of numbers.')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Validator for task submission reviews
 */
export function validateTaskReview(data) {
  const errors = []
  const { reviewStatus, remarks } = data

  const validStatuses = ['APPROVED', 'REVISION_REQUESTED', 'REJECTED']

  if (!reviewStatus || !validStatuses.includes(reviewStatus)) {
    errors.push(`Invalid review status. Must be one of: ${validStatuses.join(', ')}`)
  }

  if (reviewStatus === 'REVISION_REQUESTED' && (!remarks || remarks.trim().length === 0)) {
    errors.push('Feedback remarks are required when requesting a revision.')
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
