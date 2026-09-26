/**
 * Executive Teams.
 */

import * as teamService from '../services/teamService.js'

export async function getAll(req, res) {
  try {
    const data = await teamService.listTeams()
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve teams.',
      details: err.details,
    })
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params
    const data = await teamService.getTeamById(id)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve team.',
      details: err.details,
    })
  }
}

export async function create(req, res) {
  try {
    const data = await teamService.createTeam(req.body)
    return res.status(201).json({
      data,
      message: 'Team created successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to create team.',
      details: err.details,
    })
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params
    const data = await teamService.updateTeam(id, req.body)
    return res.status(200).json({
      data,
      message: 'Team updated successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to update team.',
      details: err.details,
    })
  }
}

export async function setStatus(req, res) {
  try {
    const { id } = req.params
    const { status: newStatus } = req.body
    const data = await teamService.setTeamStatus(id, newStatus)
    return res.status(200).json({
      data,
      message: `Team status updated to ${newStatus}.`,
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to update team status.',
      details: err.details,
    })
  }
}
