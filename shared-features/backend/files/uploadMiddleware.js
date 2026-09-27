import multer from 'multer'

// Memory storage so fileService can validate and write to disk cleanly
const storage = multer.memoryStorage()

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'text/csv',
]

const fileFilter = (req, file, cb) => {
  // Check extension against blacklisted executable files
  const ext = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'))
  const forbiddenExts = ['.exe', '.sh', '.bat', '.cmd', '.vbs', '.js', '.mjs', '.cjs', '.py', '.php', '.dll']
  if (forbiddenExts.includes(ext)) {
    return cb(new Error('File type not allowed for security reasons.'), false)
  }

  if (file.mimetype && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('MIME type not allowed.'), false)
  }

  cb(null, true)
}

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
  fileFilter,
})
