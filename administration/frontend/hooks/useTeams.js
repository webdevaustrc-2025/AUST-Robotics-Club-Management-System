import { useState, useEffect, useCallback } from 'react'
import panelApi from '../services/panelApi.js'

function extractError(err) {
  try {
    const parsed = JSON.parse(err.message)
    if (parsed.error) {
      if (parsed.details && Array.isArray(parsed.details) && parsed.details.length > 0) {
        return `${parsed.error} (${parsed.details.join(', ')})`
      }
      return parsed.error
    }
  } catch {
    // ignore json parse error
  }
  return err.message || 'An error occurred while managing teams.'
}

export function useTeams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchTeams = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await panelApi.getTeams()
      setTeams(response?.data || [])
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTeams()
  }, [fetchTeams])

  const createTeam = async (payload) => {
    setActionLoading(true)
    setError(null)
    try {
      const response = await panelApi.createTeam(payload)
      await fetchTeams()
      return { success: true, data: response?.data }
    } catch (err) {
      const message = extractError(err)
      setError(message)
      return { success: false, error: message }
    } finally {
      setActionLoading(false)
    }
  }

  const updateTeam = async (id, payload) => {
    setActionLoading(true)
    setError(null)
    try {
      const response = await panelApi.updateTeam(id, payload)
      await fetchTeams()
      return { success: true, data: response?.data }
    } catch (err) {
      const message = extractError(err)
      setError(message)
      return { success: false, error: message }
    } finally {
      setActionLoading(false)
    }
  }

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    setActionLoading(true)
    setError(null)
    try {
      const response = await panelApi.setTeamStatus(id, nextStatus)
      await fetchTeams()
      return { success: true, data: response?.data }
    } catch (err) {
      const message = extractError(err)
      setError(message)
      return { success: false, error: message }
    } finally {
      setActionLoading(false)
    }
  }

  return {
    teams,
    loading,
    error,
    actionLoading,
    fetchTeams,
    createTeam,
    updateTeam,
    toggleStatus,
    clearError: () => setError(null),
  }
}

export default useTeams
