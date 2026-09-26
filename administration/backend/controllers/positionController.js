/**
 * Executive Positions.
 */

import * as positionService from '../services/positionService.js'

export async function getAll(req, res) {
  try {
    const data = await positionService.listPositions()
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve positions.',
      details: err.details,
    })
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params
    const data = await positionService.getPositionById(id)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve position.',
      details: err.details,
    })
  }
}

export async function create(req, res) {
  try {
    const data = await positionService.createPosition(req.body)
    return res.status(201).json({
      data,
      message: 'Position created successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to create position.',
      details: err.details,
    })
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params
    const data = await positionService.updatePosition(id, req.body)
    return res.status(200).json({
      data,
      message: 'Position updated successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to update position.',
      details: err.details,
    })
  }
}

export async function setStatus(req, res) {
  try {
    const { id } = req.params
    const { status: newStatus } = req.body
    const data = await positionService.setPositionStatus(id, newStatus)
    return res.status(200).json({
      data,
      message: `Position status updated to ${newStatus}.`,
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to update position status.',
      details: err.details,
    })
  }
}
