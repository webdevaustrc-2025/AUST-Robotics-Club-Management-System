import apiClient from '../../../shared-features/frontend/services/apiClient.js'

const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

export async function fetchUserTasks() {
  const res = await apiClient.get('/administration/tasks')
  return res.data
}

export async function fetchTaskDetails(taskId) {
  const res = await apiClient.get(`/administration/tasks/${taskId}`)
  return res.data
}

export async function fetchTaskSubmissions(taskId) {
  const res = await apiClient.get(`/administration/tasks/${taskId}/submissions`)
  return res.data
}

export async function submitTaskWork(taskId, { submissionText, submissionLink, fileIds }) {
  const res = await apiClient.post(`/administration/tasks/${taskId}/submissions`, {
    submissionText,
    submissionLink,
    fileIds,
  })
  return res
}

export async function uploadSubmissionFile(taskId, file) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${baseUrl}/administration/tasks/${taskId}/upload`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || 'File upload failed')
  }

  const json = await response.json()
  return json.data
}

export async function submitTaskReview(taskId, submissionId, { reviewStatus, remarks }) {
  const res = await apiClient.post(`/administration/tasks/${taskId}/submissions/${submissionId}/reviews`, {
    reviewStatus,
    remarks,
  })
  return res
}

export async function fetchSubmissionReviews(taskId, submissionId) {
  const res = await apiClient.get(`/administration/tasks/${taskId}/submissions/${submissionId}/reviews`)
  return res.data
}
