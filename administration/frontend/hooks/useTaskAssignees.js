import { useCallback, useEffect, useState } from 'react'
import {
  assignMembers as apiAssignMembers,
  listEligibleAssignees,
  unassignMember as apiUnassignMember,
} from '../services/tasksApi.js'

export function useTaskAssignees(taskId, teamId = 'ALL') {
  const [eligibleMembers, setEligibleMembers] = useState([])
  const [loadingEligible, setLoadingEligible] = useState(true)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    listEligibleAssignees({ team_id: teamId })
      .then((data) => {
        if (active) {
          setEligibleMembers(data)
          setLoadingEligible(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err.message || 'Failed to load eligible panel members')
          setLoadingEligible(false)
        }
      })
    return () => {
      active = false
    }
  }, [teamId])

  const reloadEligible = useCallback(async () => {
    setLoadingEligible(true)
    setError(null)
    try {
      const data = await listEligibleAssignees({ team_id: teamId })
      setEligibleMembers(data)
    } catch (err) {
      setError(err.message || 'Failed to load eligible panel members')
    } finally {
      setLoadingEligible(false)
    }
  }, [teamId])

  const assignMembers = async (panelMembershipIds) => {
    if (!taskId) return null
    setMutating(true)
    setError(null)
    try {
      const updatedTask = await apiAssignMembers(taskId, panelMembershipIds)
      return updatedTask
    } catch (err) {
      setError(err.message || 'Failed to assign members')
      throw err
    } finally {
      setMutating(false)
    }
  }

  const unassignMember = async (panelMembershipId) => {
    if (!taskId) return null
    setMutating(true)
    setError(null)
    try {
      const updatedTask = await apiUnassignMember(taskId, panelMembershipId)
      return updatedTask
    } catch (err) {
      setError(err.message || 'Failed to unassign member')
      throw err
    } finally {
      setMutating(false)
    }
  }

  return {
    eligibleMembers,
    loadingEligible,
    mutating,
    error,
    assignMembers,
    unassignMember,
    reloadEligible,
  }
}
