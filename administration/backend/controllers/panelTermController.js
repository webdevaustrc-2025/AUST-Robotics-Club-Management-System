/**
 *  Executive Panel Terms.
 */

import * as panelTermService from '../services/panelTermService.js'

export async function getAll(req, res) {
  try {
    const data = await panelTermService.listPanelTerms()
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve panel terms.',
      details: err.details,
    })
  }
}

export async function getById(req, res) {
  try {
    const { id } = req.params
    const data = await panelTermService.getPanelTermById(id)
    return res.status(200).json({ data })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to retrieve panel term.',
      details: err.details,
    })
  }
}

export async function create(req, res) {
  try {
    const data = await panelTermService.createPanelTerm(req.body)
    return res.status(201).json({
      data,
      message: 'Panel term created successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to create panel term.',
      details: err.details,
    })
  }
}

export async function update(req, res) {
  try {
    const { id } = req.params
    const data = await panelTermService.updatePanelTerm(id, req.body)
    return res.status(200).json({
      data,
      message: 'Panel term updated successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to update panel term.',
      details: err.details,
    })
  }
}

export async function archive(req, res) {
  try {
    const { id } = req.params
    const data = await panelTermService.archivePanelTerm(id)
    return res.status(200).json({
      data,
      message: 'Panel term archived successfully.',
    })
  } catch (err) {
    const status = err.status || 500
    return res.status(status).json({
      error: err.message || 'Failed to archive panel term.',
      details: err.details,
    })
  }
}
