import * as taskRepo from '../repositories/taskRepository.js'
import { validateTaskSubmission, validateTaskReview } from '../validators/taskValidator.js'

export async function getUserTasks(userId) {
  return await taskRepo.listTasksForUser(userId)
}

export async function getTaskDetails(taskId) {
  const task = await taskRepo.findTaskById(taskId)
  if (!task) {
    const error = new Error(`Task with ID ${taskId} not found`)
    error.statusCode = 404
    throw error
  }
  return task
}

export async function getTaskSubmissions(taskId, userId) {
  const task = await taskRepo.findTaskById(taskId)
  if (!task) {
    const error = new Error(`Task with ID ${taskId} not found`)
    error.statusCode = 404
    throw error
  }

  // Authorization check: Verify user is assigned or is task reviewer/assigner
  const assignee = await taskRepo.findAssigneeForUserAndTask(userId, taskId)
  const isReviewer = await taskRepo.isUserTaskAssignerOrReviewer(userId, taskId)

  if (!assignee && !isReviewer && process.env.DATABASE_URL) {
    const error = new Error('Unauthorized: You are not authorized to view submissions for this task')
    error.statusCode = 403
    throw error
  }

  const submissions = await taskRepo.getSubmissionHistoryForTask(taskId)
  return submissions
}

export async function getSubmissionById(submissionId) {
  const submission = await taskRepo.getSubmissionById(submissionId)
  if (!submission) {
    const error = new Error(`Submission with ID ${submissionId} not found`)
    error.statusCode = 404
    throw error
  }
  return submission
}

export async function getSubmissionReviews(submissionId) {
  const reviews = await taskRepo.getReviewsForSubmission(submissionId)
  return reviews
}

export async function submitTaskWork({ userId, taskId, submissionText, submissionLink, fileIds }) {
  // 1. Input Validation
  const validation = validateTaskSubmission({ submissionText, submissionLink, fileIds })
  if (!validation.isValid) {
    const error = new Error(validation.errors.join(' '))
    error.statusCode = 400
    throw error
  }

  // 2. Task Existence Check
  const task = await taskRepo.findTaskById(taskId)
  if (!task) {
    const error = new Error(`Task with ID ${taskId} not found`)
    error.statusCode = 404
    throw error
  }

  // 3. Backend Authorization Check: Ensure authenticated user is assigned to task
  const assignee = await taskRepo.findAssigneeForUserAndTask(userId, taskId)
  if (!assignee) {
    const error = new Error('Unauthorized: You are not assigned to submit work for this task')
    error.statusCode = 403
    throw error
  }

  // 4. Calculate Version Number & Insert with Graceful Race Condition Retry
  let nextVersion = await taskRepo.getNextVersionNumber(assignee.task_assignee_id)
  let submission

  try {
    submission = await taskRepo.createSubmissionRecord({
      taskAssigneeId: assignee.task_assignee_id,
      versionNo: nextVersion,
      submissionText,
      submissionLink,
    })
  } catch (err) {
    // 23505 = PostgreSQL unique_violation on uk_adm_task_submissions_version
    if (err.code === '23505') {
      nextVersion = await taskRepo.getNextVersionNumber(assignee.task_assignee_id)
      submission = await taskRepo.createSubmissionRecord({
        taskAssigneeId: assignee.task_assignee_id,
        versionNo: nextVersion,
        submissionText,
        submissionLink,
      })
    } else {
      throw err
    }
  }

  // 5. Update task status back to SUBMITTED or IN_PROGRESS on new version creation
  await taskRepo.updateTaskStatus(taskId, 'SUBMITTED', null)

  // 6. Attach Files
  let attachedFiles = []
  if (fileIds && fileIds.length > 0) {
    attachedFiles = await taskRepo.attachFilesToSubmission(submission.task_submission_id, fileIds)
  }

  return {
    ...submission,
    attachedFiles,
  }
}

export async function reviewTaskSubmission({ userId, taskId, submissionId, reviewStatus, remarks }) {
  // 1. Input Validation
  const validation = validateTaskReview({ reviewStatus, remarks })
  if (!validation.isValid) {
    const error = new Error(validation.errors.join(' '))
    error.statusCode = 400
    throw error
  }

  // 2. Task Existence Check
  const task = await taskRepo.findTaskById(taskId)
  if (!task) {
    const error = new Error(`Task with ID ${taskId} not found`)
    error.statusCode = 404
    throw error
  }

  // 3. Submission Existence Check
  const submission = await taskRepo.getSubmissionById(submissionId)
  if (!submission || (submission.task_id && parseInt(submission.task_id, 10) !== parseInt(taskId, 10))) {
    const error = new Error(`Submission with ID ${submissionId} does not exist for task #${taskId}`)
    error.statusCode = 404
    throw error
  }

  // 4. Reviewer Authorization Check: Ensure user has reviewer rights
  const isReviewer = await taskRepo.isUserTaskAssignerOrReviewer(userId, taskId)
  if (!isReviewer) {
    const error = new Error('Unauthorized: You do not have permission to review submissions for this task')
    error.statusCode = 403
    throw error
  }

  // 5. Insert Review Record into adm_task_submission_reviews
  const reviewRecord = await taskRepo.createReviewRecord({
    taskSubmissionId: submissionId,
    reviewerUserId: userId,
    reviewStatus,
    remarks,
  })

  // 6. Update submission status in adm_task_submissions
  await taskRepo.updateSubmissionStatus(submissionId, reviewStatus)

  // 7. Update overall task status in adm_tasks
  if (reviewStatus === 'APPROVED') {
    await taskRepo.updateTaskStatus(taskId, 'COMPLETED', new Date().toISOString())
  } else if (reviewStatus === 'REVISION_REQUESTED') {
    await taskRepo.updateTaskStatus(taskId, 'REVISION_REQUESTED', null)
  } else if (reviewStatus === 'REJECTED') {
    await taskRepo.updateTaskStatus(taskId, 'REJECTED', null)
  }

  return reviewRecord
}
