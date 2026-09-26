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
  return err.message || 'An error occurred while managing positions.'
}

export function usePositions() {
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchPositions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await panelApi.getPositions()
      setPositions(response?.data || [])
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPositions()
  }, [fetchPositions])

  const createPosition = async (payload) => {
    setActionLoading(true)
    setError(null)
    try {
      const response = await panelApi.createPosition(payload)
      await fetchPositions()
      return { success: true, data: response?.data }
    } catch (err) {
      const message = extractError(err)
      setError(message)
      return { success: false, error: message }
    } finally {
      setActionLoading(false)
    }
  }

  const updatePosition = async (id, payload) => {
    setActionLoading(true)
    setError(null)
    try {
      const response = await panelApi.updatePosition(id, payload)
      await fetchPositions()
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
      const response = await panelApi.setPositionStatus(id, nextStatus)
      await fetchPositions()
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
    positions,
    loading,
    error,
    actionLoading,
    fetchPositions,
    createPosition,
    updatePosition,
    toggleStatus,
    clearError: () => setError(null),
  }
}

export default usePositions
