import path from 'path'
import fs from 'fs'
import db from '../database/db.js'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Development/offline fallback metadata store (mirrors the in-memory submission
// store). It holds the same record shape as infra_files, only in memory, and is
// used solely when no database is configured.
const devFilesById = new Map()
const devFilesByStoredName = new Map()

function registerDevFile(record) {
  let fileId = record.file_id
  while (devFilesById.has(fileId)) {
    fileId += 1
  }
  const finalRecord = { ...record, file_id: fileId }
  devFilesById.set(finalRecord.file_id, finalRecord)
  devFilesByStoredName.set(finalRecord.stored_name, finalRecord)
  return finalRecord
}

/**
 * Register file upload in infra_files table and save to disk cleanly.
 */
export async function saveFileInfo({
  userId,
  originalName,
  mimeType,
  fileSizeBytes,
  buffer,
}) {
  // Sanitize original file name against path traversal attacks
  const safeOriginalName = path.basename(originalName || 'file')
  const fileExt = path.extname(safeOriginalName).toLowerCase()
  const storedName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}${fileExt}`
  const storageKey = `uploads/${storedName}`
  const filePath = path.join(UPLOAD_DIR, storedName)

  // Ensure target path is inside UPLOAD_DIR
  if (!filePath.startsWith(UPLOAD_DIR)) {
    throw new Error('Invalid file path specified.')
  }

  let fileWritten = false

  try {
    if (buffer) {
      fs.writeFileSync(filePath, buffer)
      fileWritten = true
    }

    const publicUrl = `/api/files/download/${storedName}`

    if (process.env.DATABASE_URL) {
      const queryText = `
        INSERT INTO infra_files (
          uploaded_by_user_id,
          original_name,
          stored_name,
          storage_provider,
          storage_key,
          public_url,
          mime_type,
          file_size_bytes,
          status
        )
        VALUES ($1, $2, $3, 'LOCAL', $4, $5, $6, $7, 'ACTIVE')
        RETURNING file_id, original_name, stored_name, public_url, mime_type, file_size_bytes, created_at
      `
      const values = [
        userId || null,
        safeOriginalName,
        storedName,
        storageKey,
        publicUrl,
        mimeType || 'application/octet-stream',
        fileSizeBytes || 0,
      ]
      const result = await db.query(queryText, values)
      return result.rows[0]
    }

    return registerDevFile({
      file_id: Date.now(),
      original_name: safeOriginalName,
      stored_name: storedName,
      public_url: publicUrl,
      mime_type: mimeType || 'application/octet-stream',
      file_size_bytes: fileSizeBytes || 0,
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    // Clean up file if DB insert or write failed
    if (fileWritten && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
      } catch {
        // Silent cleanup
      }
    }
    throw new Error(err.message || 'File upload failed.', { cause: err })
  }
}

/**
 * Get file record by ID
 */
export async function getFileById(fileId) {
  if (process.env.DATABASE_URL) {
    const result = await db.query('SELECT * FROM infra_files WHERE file_id = $1', [fileId])
    return result.rows[0] || null
  }
  return devFilesById.get(parseInt(fileId, 10)) || null
}

/**
 * Get file record by its stored (on-disk) name.
 */
export async function getFileByStoredName(storedName) {
  if (!storedName || typeof storedName !== 'string') return null

  if (process.env.DATABASE_URL) {
    const result = await db.query(
      `SELECT file_id, original_name, stored_name, public_url, mime_type, file_size_bytes, status
       FROM infra_files WHERE stored_name = $1 AND status = 'ACTIVE'`,
      [storedName]
    )
    return result.rows[0] || null
  }

  return devFilesByStoredName.get(storedName) || null
}

/**
 * Resolve a safe on-disk path for a stored file name using existing metadata.
 * Never trusts a client-supplied path: the name is reduced to its basename and
 * must land inside UPLOAD_DIR as a regular file.
 */
export async function prepareStoredFileDownload(storedName) {
  if (!storedName || typeof storedName !== 'string') return null

  const safeName = path.basename(storedName)
  if (safeName !== storedName) return null

  const record = await getFileByStoredName(safeName)
  if (!record) return null

  const filePath = path.join(UPLOAD_DIR, path.basename(record.stored_name || safeName))
  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) return null
  if (!fs.existsSync(filePath)) return null
  if (!fs.statSync(filePath).isFile()) return null

  return { filePath, record }
}

export { UPLOAD_DIR }
