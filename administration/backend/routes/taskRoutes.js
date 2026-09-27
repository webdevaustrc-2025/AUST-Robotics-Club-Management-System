import { Router } from 'express'
import * as taskController from '../controllers/taskController.js'
import { authenticateUser, requireAuth } from '../../../shared-features/backend/middleware/auth.js'
import { upload } from '../../../shared-features/backend/files/uploadMiddleware.js'

const router = Router()

// All routes require authentication
router.use(authenticateUser)
router.use(requireAuth)

// Get user tasks
router.get('/', taskController.listUserTasks)

// Get task details
router.get('/:taskId', taskController.getTaskDetails)

// Get submission history for a task
router.get('/:taskId/submissions', taskController.getTaskSubmissions)

// Create a new versioned task submission
router.post('/:taskId/submissions', taskController.createSubmission)

// Upload a file attachment for a submission
router.post('/:taskId/upload', upload.single('file'), taskController.uploadSubmissionFile)

// Create a review for a task submission
router.post('/:taskId/submissions/:submissionId/reviews', taskController.createSubmissionReview)

// Get reviews for a task submission
router.get('/:taskId/submissions/:submissionId/reviews', taskController.getSubmissionReviews)

export default router
