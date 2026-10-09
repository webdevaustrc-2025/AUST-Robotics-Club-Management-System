import { useCallback, useEffect, useState } from 'react'
import {
  createTask as apiCreateTask,
  deleteTask as apiDeleteTask,
  listPanelTerms,
  listTasks,
  listTeams,
  transitionTaskStatus as apiTransitionStatus,
  updateTask as apiUpdateTask,
} from '../services/tasksApi.js'

export function useTasks(initialFilters = {}) {
  const [tasks, setTasks] = useState([])
  const [teams, setTeams] = useState([])
  const [panelTerms, setPanelTerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    team_id: 'ALL',
    status: 'ALL',
    priority: 'ALL',
    search: '',
    ...initialFilters,
  })

  // Load static teams & panel terms on mount
  useEffect(() => {
    let active = true
    Promise.all([listTeams(), listPanelTerms()])
      .then(([fetchedTeams, fetchedTerms]) => {
        if (active) {
          setTeams(fetchedTeams)
          setPanelTerms(fetchedTerms)
        }
      })
      .catch((err) => {
        console.error('Failed to load task metadata:', err)
      })
    return () => {
      active = false
    }
  }, [])

  // Fetch tasks whenever filters change
  useEffect(() => {
    let active = true
    listTasks(filters)
      .then((data) => {
        if (active) {
          setTasks(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to load tasks')
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [filters])

  // Explicit reload function for mutations
  const reloadTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listTasks(filters)
      setTasks(data)
    } catch (err) {
      setError(err.message || 'Failed to load tasks')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const createTask = async (payload) => {
    const created = await apiCreateTask(payload)
    await reloadTasks()
    return created
  }

  const updateTask = async (taskId, fields) => {
    const updated = await apiUpdateTask(taskId, fields)
    await reloadTasks()
    return updated
  }

  const deleteTask = async (taskId) => {
    await apiDeleteTask(taskId)
    await reloadTasks()
  }

  const transitionStatus = async (taskId, { to_status, reason }) => {
    const res = await apiTransitionStatus(taskId, { to_status, reason })
    await reloadTasks()
    return res
  }

  return {
    tasks,
    teams,
    panelTerms,
    loading,
    error,
    filters,
    setFilters,
    reloadTasks,
    createTask,
    updateTask,
    deleteTask,
    transitionStatus,
  }
}
