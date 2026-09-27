import { useState, useEffect } from 'react'
import { CheckSquare, Clock, AlertCircle, Plus, RefreshCw, FileText, ChevronRight, RotateCcw } from 'lucide-react'
import { fetchUserTasks, fetchTaskSubmissions, submitTaskWork } from '../services/taskService.js'
import { SubmissionHistoryList } from '../components/SubmissionHistoryList.jsx'
import { TaskSubmissionForm } from '../components/TaskSubmissionForm.jsx'
import { TaskReviewModal } from '../components/TaskReviewModal.jsx'

function TaskManagement() {
  const [tasks, setTasks] = useState([])
  const [selectedTask, setSelectedTask] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)
  const [error, setError] = useState(null)
  const [submissionsError, setSubmissionsError] = useState(null)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [reviewingSubmission, setReviewingSubmission] = useState(null)

  const loadTasks = async () => {
    setLoadingTasks(true)
    setError(null)
    try {
      const data = await fetchUserTasks()
      setTasks(data || [])
      if (data && data.length > 0) {
        if (!selectedTask) {
          setSelectedTask(data[0])
        } else {
          const updated = data.find((t) => String(t.task_id) === String(selectedTask.task_id))
          if (updated) setSelectedTask(updated)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load tasks')
    } finally {
      setLoadingTasks(false)
    }
  }

  const loadSubmissions = async (taskId) => {
    if (!taskId) return
    setLoadingSubmissions(true)
    setSubmissionsError(null)
    try {
      const history = await fetchTaskSubmissions(taskId)
      setSubmissions(history || [])
    } catch (err) {
      console.error('Error loading submission history:', err)
      setSubmissionsError(err.message || 'Failed to load submission history')
      setSubmissions([])
    } finally {
      setLoadingSubmissions(false)
    }
  }

  useEffect(() => {
    let isMounted = true

    fetchUserTasks()
      .then((data) => {
        if (!isMounted) return
        setTasks(data || [])
        if (data && data.length > 0) {
          setSelectedTask(data[0])
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err.message || 'Failed to load tasks')
      })
      .finally(() => {
        if (isMounted) setLoadingTasks(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  const selectedTaskId = selectedTask?.task_id

  useEffect(() => {
    if (!selectedTaskId) return
    const timer = window.setTimeout(() => loadSubmissions(selectedTaskId), 0)
    return () => window.clearTimeout(timer)
  }, [selectedTaskId])

  const handleTaskSelect = (task) => {
    setSelectedTask(task)
    setShowSubmitModal(false)
    setReviewingSubmission(null)
  }

  const handleSubmissionCreated = async (submissionPayload) => {
    if (!selectedTask) return
    const result = await submitTaskWork(selectedTask.task_id, submissionPayload)

    // Optimistically add the new submission to the list immediately
    if (result && result.data) {
      setSubmissions((prev) => [result.data, ...prev])
    }

    setShowSubmitModal(false)

    // Refresh the full list from the backend to ensure consistency
    await loadSubmissions(selectedTask.task_id)
    await loadTasks()
  }

  const handleReviewSuccess = async () => {
    if (!selectedTask) return
    setReviewingSubmission(null)
    await loadSubmissions(selectedTask.task_id)
    await loadTasks()
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-edge pb-5">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-brand-500" />
            <h1 className="text-2xl font-bold tracking-tight text-ink font-display">Task Submissions & Reviews</h1>
          </div>
          <p className="text-xs text-muted mt-1">
            Manage versioned task submissions, attach work files, conduct reviews, and track revision cycles.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTasks}
          disabled={loadingTasks}
          className="px-3 py-1.5 rounded-lg border border-edge bg-surface-2 hover:bg-surface-hover text-xs font-medium text-ink flex items-center gap-2 transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingTasks ? 'animate-spin' : ''}`} />
          Refresh Tasks
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tasks List */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">My Assigned & Review Tasks</h2>
            <span className="text-xs text-subtle font-mono">{tasks.length} Total</span>
          </div>

          {loadingTasks ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 rounded-xl border border-edge bg-surface-1/50 animate-pulse h-24" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-6 rounded-xl border border-edge bg-surface-1 text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 text-faint" />
              <p className="text-xs font-medium text-ink">No tasks available</p>
              <p className="text-[11px] text-muted mt-1">You have no pending tasks requiring submissions or reviews.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tasks.map((t) => {
                const isSelected = selectedTask && String(selectedTask.task_id) === String(t.task_id)
                return (
                  <button
                    key={t.task_id}
                    type="button"
                    onClick={() => handleTaskSelect(t)}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-brand-500 bg-surface-2 shadow-glow'
                        : 'border-edge bg-surface-1 hover:border-edge-strong hover:bg-surface-2/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-xs font-semibold ${isSelected ? 'text-brand-400' : 'text-ink'}`}>
                        {t.task_title}
                      </h3>
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 transition-transform ${
                          isSelected ? 'text-brand-400 translate-x-0.5' : 'text-faint'
                        }`}
                      />
                    </div>
                    {t.task_description && (
                      <p className="text-[11px] text-muted mt-1 line-clamp-2">{t.task_description}</p>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-3 text-[10px]">
                      <span className="px-2 py-0.5 rounded bg-surface-3 border border-edge text-subtle font-medium">
                        {t.team_name || 'General Task'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-mono font-medium ${
                          t.status === 'REVISION_REQUESTED'
                            ? 'bg-warning/20 text-warning border border-warning/30'
                            : t.status === 'COMPLETED'
                            ? 'bg-brand-500/20 text-brand-400 border border-brand-500/30'
                            : 'bg-surface-3 text-subtle border border-edge'
                        }`}
                      >
                        {t.status || 'TODO'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Right Column: Selected Task Details, Submissions & Review */}
        <div className="lg:col-span-8 space-y-6">
          {selectedTask ? (
            <>
              {/* Task Summary Banner */}
              <div className="p-6 rounded-xl border border-edge bg-surface-1 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-brand-500/20 text-brand-400 border border-brand-500/30">
                        TASK #{selectedTask.task_id}
                      </span>
                      <span className="text-xs text-subtle font-medium">{selectedTask.team_name}</span>
                    </div>
                    <h2 className="text-lg font-bold text-ink">{selectedTask.task_title}</h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowSubmitModal(!showSubmitModal)}
                    className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-brand-950 font-bold text-xs transition-colors flex items-center justify-center gap-2 shadow-glow cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    New Submission Version
                  </button>
                </div>

                {selectedTask.task_description && (
                  <p className="text-xs text-muted border-t border-edge-subtle pt-3">
                    {selectedTask.task_description}
                  </p>
                )}

                {/* Revision Alert for Assignees */}
                {selectedTask.status === 'REVISION_REQUESTED' && (
                  <div className="p-3.5 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs flex items-center gap-3 animate-pulse">
                    <RotateCcw className="w-4 h-4 shrink-0" />
                    <div>
                      <p className="font-bold">Revision Requested by Reviewer</p>
                      <p className="text-[11px] opacity-90">
                        Please review reviewer feedback in submission history below and submit a new version.
                      </p>
                    </div>
                  </div>
                )}

                {selectedTask.due_at && (
                  <div className="flex items-center gap-1.5 text-xs text-subtle pt-1">
                    <Clock className="w-3.5 h-3.5 text-warning" />
                    <span>Due Date: {new Date(selectedTask.due_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Submission Form Section */}
              {showSubmitModal && (
                <TaskSubmissionForm
                  task={selectedTask}
                  onSubmissionSuccess={handleSubmissionCreated}
                  onCancel={() => setShowSubmitModal(false)}
                />
              )}

              {/* Review Modal */}
              {reviewingSubmission && (
                <TaskReviewModal
                  task={selectedTask}
                  submission={reviewingSubmission}
                  onReviewSuccess={handleReviewSuccess}
                  onClose={() => setReviewingSubmission(null)}
                />
              )}

              {/* Submission Fetch Error Display */}
              {submissionsError && (
                <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{submissionsError}</span>
                  <button
                    type="button"
                    onClick={() => loadSubmissions(selectedTask.task_id)}
                    className="ml-auto px-3 py-1 rounded-lg border border-danger/30 text-danger text-xs font-medium hover:bg-danger/10 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Versioned History & Reviews Timeline */}
              <div className="p-6 rounded-xl border border-edge bg-surface-1">
                <SubmissionHistoryList
                  submissions={submissions}
                  loading={loadingSubmissions}
                  isReviewer={true}
                  onReviewClick={(sub) => setReviewingSubmission(sub)}
                />
              </div>
            </>
          ) : (
            <div className="p-12 rounded-xl border border-edge bg-surface-1 text-center">
              <CheckSquare className="w-12 h-12 mx-auto mb-3 text-faint" />
              <h3 className="text-sm font-semibold text-ink">Select a Task</h3>
              <p className="text-xs text-muted mt-1">Select an assigned or review task from the left to view details.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskManagement
