import { useEffect, useState } from 'react'
import { ArrowRight, History } from 'lucide-react'
import Badge from '../../../shared-features/frontend/components/Badge.jsx'
import Loader from '../../../shared-features/frontend/components/Loader.jsx'
import { listTaskStatusHistory } from '../services/tasksApi.js'

const STATUS_CONFIGS = {
  TODO: { variant: 'neutral', label: 'To Do' },
  IN_PROGRESS: { variant: 'info', label: 'In Progress' },
  BLOCKED: { variant: 'danger', label: 'Blocked' },
  DONE: { variant: 'success', label: 'Done' },
}

function formatShortTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function TaskStatusTimeline({ taskId, refreshTrigger }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (!taskId) return

    setLoading(true)
    listTaskStatusHistory(taskId)
      .then((data) => {
        if (active) {
          setHistory(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('Failed to load status history:', err)
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [taskId, refreshTrigger])

  if (loading) {
    return (
      <div className="flex justify-center p-4">
        <Loader label="Loading progress history..." />
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-edge-subtle p-4 text-center">
        <History size={16} className="mx-auto mb-1 text-faint" />
        <p className="font-mono text-xs text-subtle">No status transitions recorded yet</p>
      </div>
    )
  }

  return (
    <div className="relative pl-6">
      {/* Vertical timeline connector */}
      <div className="absolute bottom-2 left-2 top-2 w-px bg-edge-subtle" />

      <div className="flex flex-col gap-4">
        {history.map((record, index) => {
          const fromConfig = STATUS_CONFIGS[record.from_status] || {
            variant: 'neutral',
            label: record.from_status || 'Start',
          }
          const toConfig = STATUS_CONFIGS[record.to_status] || {
            variant: 'neutral',
            label: record.to_status,
          }

          return (
            <div key={record.task_status_history_id || index} className="relative flex flex-col gap-1">
              {/* Timeline marker node */}
              <div className="absolute -left-6 top-1.5 size-2 rounded-full border border-surface-0 bg-brand-400 ring-2 ring-brand-500/20" />

              <div className="flex flex-wrap items-center gap-2">
                {record.from_status && (
                  <>
                    <Badge variant={fromConfig.variant}>{fromConfig.label}</Badge>
                    <ArrowRight size={11} className="text-subtle" />
                  </>
                )}
                <Badge variant={toConfig.variant} dot>
                  {toConfig.label}
                </Badge>
                <span className="font-mono text-[0.6875rem] text-faint ml-auto">
                  {formatShortTime(record.created_at)}
                </span>
              </div>

              <div className="flex flex-col text-xs">
                <span className="font-medium text-ink">
                  {record.changed_by_user_name || 'System Actor'}
                </span>
                {record.reason && (
                  <p className="mt-0.5 text-muted rounded-xs bg-surface-2 p-2 font-mono text-[0.75rem] border border-edge-subtle">
                    {record.reason}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TaskStatusTimeline
