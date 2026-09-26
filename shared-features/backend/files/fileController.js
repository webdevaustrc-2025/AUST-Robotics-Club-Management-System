import path from 'path'
import { prepareStoredFileDownload } from './fileService.js'

/**
 * Serve an uploaded file by its stored name after authenticating the request.
 * Resolution is based on infra_files/dev metadata only; no client path is used.
 */
export async function downloadFile(req, res, next) {
  try {
    const result = await prepareStoredFileDownload(req.params.storedName)
    if (!result) {
      return res.status(404).json({ status: 'error', error: 'File not found' })
    }

    const { filePath, record } = result
    const mime = record.mime_type || 'application/octet-stream'
    const disposition = mime.startsWith('image/') ? 'inline' : 'attachment'
    const fileName =
      path
        .basename(record.original_name || path.basename(filePath))
        .replace(/["\\\r\n]/g, '_') || 'download'

    res.sendFile(
      filePath,
      {
        headers: {
          'Content-Type': mime,
          'Content-Disposition': `${disposition}; filename="${fileName}"`,
          'X-Content-Type-Options': 'nosniff',
        },
      },
      (err) => {
        if (err && !res.headersSent) {
          res.status(404).json({ status: 'error', error: 'File not found' })
        }
      }
    )
  } catch (error) {
    next(error)
  }
}
