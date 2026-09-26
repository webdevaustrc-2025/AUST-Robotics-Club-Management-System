/**
 Panel Memberships and Member History.
 */

import * as membershipService from '../services/membershipService.js'

export async function assign(req, res) {
  try {
    const data = await membershipService.assignMember(req.body)
    return res.status(201).json({
      data,
      message: 'Member assigned to panel successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to assign member to panel.',
      details: err.details,
    })
  }
}

export async function getByTerm(req, res) {
  try {
    const { termId } = req.params
    const includeVoid = req.query.includeVoid === 'true'
    const data = await membershipService.getMembershipsByTerm(termId, includeVoid)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve panel roster.',
      details: err.details,
    })
  }
}

export async function getHistoryByMember(req, res) {
  try {
    const { memberId } = req.params
    const data = await membershipService.getHistoryByMember(memberId)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve member history.',
      details: err.details,
    })
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params
    const data = await membershipService.getMembershipById(id)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve panel membership.',
      details: err.details,
    })
  }
}

export async function endMembership(req, res) {
  try {
    const { id } = req.params
    const data = await membershipService.endMembership(id, req.body)
    return res.status(200).json({
      data,
      message: 'Panel appointment concluded successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to end panel membership.',
      details: err.details,
    })
  }
}

export async function voidMembership(req, res) {
  try {
    const { id } = req.params
    const data = await membershipService.voidMembership(id, req.body)
    return res.status(200).json({
      data,
      message: 'Panel membership voided successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to void panel membership.',
      details: err.details,
    })
  }
}

export async function listMembers(req, res) {
  try {
    const { search } = req.query
    const data = await membershipService.listOfficialMembers(search)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve club members.',
      details: err.details,
    })
  }
}
