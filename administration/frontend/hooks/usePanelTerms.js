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
  return err.message || 'An error occurred while managing panel terms.'
}

export function usePanelTerms() {
  const [terms, setTerms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchTerms = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await panelApi.getTerms()
      setTerms(response?.data || [])
    } catch (err) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTerms()
  }, [fetchTerms])

  const createTerm = async (payload) => {
    setActionLoading(true)
    setError(null)
    try {
      const response = await panelApi.createTerm(payload)
      await fetchTerms()
      return { success: true, data: response?.data }
    } catch (err) {
      const message = extractError(err)
      setError(message)
      return { success: false, error: message }
    } finally {
      setActionLoading(false)
    }
  }

  const updateTerm = async (id, payload) => {
    setActionLoading(true)
    setError(null)
    try {
      const response = await panelApi.updateTerm(id, payload)
      await fetchTerms()
      return { success: true, data: response?.data }
    } catch (err) {
      const message = extractError(err)
      setError(message)
      return { success: false, error: message }
    } finally {
      setActionLoading(false)
    }
  }

  const archiveTerm = async (id) => {
    setActionLoading(true)
    setError(null)
    try {
      const response = await panelApi.archiveTerm(id)
      await fetchTerms()
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
    terms,
    loading,
    error,
    actionLoading,
    fetchTerms,
    createTerm,
    updateTerm,
    archiveTerm,
    clearError: () => setError(null),
  }
}

export default usePanelTerms
