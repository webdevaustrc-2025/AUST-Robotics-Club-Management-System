import * as taskService from '../services/taskService.js'
import { saveFileInfo } from '../../../shared-features/backend/files/fileService.js'

export async function listUserTasks(req, res, next) {
  try {
    const userId = req.user.user_id
    const tasks = await taskService.getUserTasks(userId)
    res.json({ status: 'success', data: tasks })
  } catch (error) {
    next(error)
  }
}

export async function getTaskDetails(req, res, next) {
  try {
    const taskId = parseInt(req.params.taskId, 10)
    const task = await taskService.getTaskDetails(taskId)
    res.json({ status: 'success', data: task })
  } catch (error) {
    next(error)
  }
}

export async function getTaskSubmissions(req, res, next) {
  try {
    const taskId = parseInt(req.params.taskId, 10)
    const userId = req.user.user_id
    const submissions = await taskService.getTaskSubmissions(taskId, userId)
    res.json({ status: 'success', data: submissions })
  } catch (error) {
    next(error)
  }
}

export async function createSubmission(req, res, next) {
  try {
    const taskId = parseInt(req.params.taskId, 10)
    const userId = req.user.user_id
    const { submissionText, submissionLink, fileIds } = req.body

    const submission = await taskService.submitTaskWork({
      userId,
      taskId,
      submissionText,
      submissionLink,
      fileIds,
    })

    res.status(201).json({
      status: 'success',
      message: `Submission version v${submission.version_no} created successfully`,
      data: submission,
    })
  } catch (error) {
    next(error)
  }
}

export async function uploadSubmissionFile(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', error: 'No file was uploaded' })
    }

    const userId = req.user.user_id
    const fileRecord = await saveFileInfo({
      userId,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSizeBytes: req.file.size,
      buffer: req.file.buffer,
    })

    res.status(201).json({
      status: 'success',
      data: fileRecord,
    })
  } catch (error) {
    next(error)
  }
}

export async function createSubmissionReview(req, res, next) {
  try {
    const taskId = parseInt(req.params.taskId, 10)
    const submissionId = parseInt(req.params.submissionId, 10)
    const userId = req.user.user_id
    const { reviewStatus, remarks } = req.body

    const review = await taskService.reviewTaskSubmission({
      userId,
      taskId,
      submissionId,
      reviewStatus,
      remarks,
    })

    res.status(201).json({
      status: 'success',
      message: `Review recorded decision: ${reviewStatus}`,
      data: review,
    })
  } catch (error) {
    next(error)
  }
}

export async function getSubmissionReviews(req, res, next) {
  try {
    const submissionId = parseInt(req.params.submissionId, 10)
    const reviews = await taskService.getSubmissionReviews(submissionId)
    res.json({ status: 'success', data: reviews })
  } catch (error) {
    next(error)
  }
}
