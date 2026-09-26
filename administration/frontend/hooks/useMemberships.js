import { useState, useCallback } from 'react'
import membershipApi from '../services/membershipApi.js'

export default function useMemberships() {
  // Roster state
  const [roster, setRoster] = useState([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [rosterError, setRosterError] = useState(null)

  // Member history state
  const [historyData, setHistoryData] = useState(null) // { member, history: [] }
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)

  // Official members dropdown list
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)

  // Shared action/mutation state
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState(null)

  const clearErrors = useCallback(() => {
    setRosterError(null)
    setHistoryError(null)
    setActionError(null)
  }, [])

  /**
   * Fetch roster for a specific panel term.
   */
  const loadRoster = useCallback(async (termId, includeVoid = false) => {
    if (!termId) {
      setRoster([])
      return
    }
    setRosterLoading(true)
    setRosterError(null)
    try {
      const res = await membershipApi.getRosterByTerm(termId, includeVoid)
      setRoster(res?.data || [])
    } catch (err) {
      let msg = 'Failed to load panel roster.'
      try {
        const parsed = JSON.parse(err.message)
        msg = parsed.error || msg
      } catch {
        msg = err.message || msg
      }
      setRosterError(msg)
      setRoster([])
    } finally {
      setRosterLoading(false)
    }
  }, [])

  /**
   * Fetch chronological appointment history for a specific member.
   */
  const loadMemberHistory = useCallback(async (memberId) => {
    if (!memberId) {
      setHistoryData(null)
      return
    }
    setHistoryLoading(true)
    setHistoryError(null)
    try {
      const res = await membershipApi.getHistoryByMember(memberId)
      setHistoryData(res?.data || null)
    } catch (err) {
      let msg = 'Failed to load member history.'
      try {
        const parsed = JSON.parse(err.message)
        msg = parsed.error || msg
      } catch {
        msg = err.message || msg
      }
      setHistoryError(msg)
      setHistoryData(null)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  /**
   * Fetch official club members list for selection.
   */
  const loadMembers = useCallback(async (search = '') => {
    setMembersLoading(true)
    try {
      const res = await membershipApi.getMembers(search)
      setMembers(res?.data || [])
    } catch (err) {
      console.error('Failed to load official members:', err)
      setMembers([])
    } finally {
      setMembersLoading(false)
    }
  }, [])

  /**
   * Assign a member to a panel term.
   */
  const assignMember = useCallback(async (payload) => {
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await membershipApi.assignMember(payload)
      return { success: true, data: res?.data }
    } catch (err) {
      let msg = 'Failed to assign member to panel.'
      try {
        const parsed = JSON.parse(err.message)
        msg = parsed.error || (parsed.details ? parsed.details.join(' ') : msg)
      } catch {
        msg = err.message || msg
      }
      setActionError(msg)
      return { success: false, error: msg }
    } finally {
      setActionLoading(false)
    }
  }, [])

  /**
   * End an active appointment.
   */
  const endMembership = useCallback(async (id, payload) => {
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await membershipApi.endMembership(id, payload)
      return { success: true, data: res?.data }
    } catch (err) {
      let msg = 'Failed to end panel appointment.'
      try {
        const parsed = JSON.parse(err.message)
        msg = parsed.error || msg
      } catch {
        msg = err.message || msg
      }
      setActionError(msg)
      return { success: false, error: msg }
    } finally {
      setActionLoading(false)
    }
  }, [])

  /**
   * Soft-void an erroneous appointment.
   */
  const voidMembership = useCallback(async (id, payload) => {
    setActionLoading(true)
    setActionError(null)
    try {
      const res = await membershipApi.voidMembership(id, payload)
      return { success: true, data: res?.data }
    } catch (err) {
      let msg = 'Failed to void panel appointment.'
      try {
        const parsed = JSON.parse(err.message)
        msg = parsed.error || msg
      } catch {
        msg = err.message || msg
      }
      setActionError(msg)
      return { success: false, error: msg }
    } finally {
      setActionLoading(false)
    }
  }, [])

  return {
    roster,
    rosterLoading,
    rosterError,
    loadRoster,

    historyData,
    historyLoading,
    historyError,
    loadMemberHistory,

    members,
    membersLoading,
    loadMembers,

    actionLoading,
    actionError,
    clearErrors,

    assignMember,
    endMembership,
    voidMembership,
  }
}
