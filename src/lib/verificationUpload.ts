/**
 * Client-side validation & image compression for MineConnect verification documents.
 *
 * Ensures fast, low-lag uploads on mobile/cellular networks by compressing images
 * down to max 1600px / 0.78 quality JPEG before uploading to Supabase Storage.
 */

export const VERIFICATION_STORAGE_BUCKET = 'verification-documents'
export const MAX_RAW_FILE_BYTES = 10 * 1024 * 1024 // 10 MiB before compression
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024 // 4 MiB after compression

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

export interface PreparedVerificationFile {
  blob: Blob
  fileName: string
  mimeType: string
  originalBytes: number
  compressedBytes: number
  wasCompressed: boolean
}

export function formatBytesCompact(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function sanitizeFileName(rawName: string, targetExt?: string): string {
  const base = rawName
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'verification-doc'
  const origExt = rawName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin'
  return `${base}.${targetExt || origExt}`
}

async function compressImageBlob(
  file: File,
  maxDimension = 1600,
  quality = 0.78,
): Promise<{ blob: Blob; mimeType: string; ext: string }> {
  const bitmapOrImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not decode image file for compression.'))
    }
    img.src = url
  })

  const origW = bitmapOrImg.naturalWidth || bitmapOrImg.width
  const origH = bitmapOrImg.naturalHeight || bitmapOrImg.height
  const scale = Math.min(1, maxDimension / Math.max(origW, origH, 1))
  const targetW = Math.max(1, Math.round(origW * scale))
  const targetH = Math.max(1, Math.round(origH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return { blob: file, mimeType: file.type || 'image/jpeg', ext: 'jpg' }
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.drawImage(bitmapOrImg, 0, 0, targetW, targetH)

  const outBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  )

  if (!outBlob || outBlob.size >= file.size) {
    return {
      blob: file,
      mimeType: file.type || 'image/jpeg',
      ext: file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg',
    }
  }

  return { blob: outBlob, mimeType: 'image/jpeg', ext: 'jpg' }
}

/**
 * Validates file type/size and compresses raster images client-side before upload.
 */
export async function validateAndCompressVerificationFile(
  file: File,
): Promise<{ ok: true; prepared: PreparedVerificationFile } | { ok: false; error: string }> {
  const mime = (file.type || '').toLowerCase()
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const allowedByExt = ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)

  if (!ALLOWED_MIME_TYPES.has(mime) && !allowedByExt) {
    return {
      ok: false,
      error: 'Unsupported file format. Please upload a PDF, JPG, PNG, or WebP document.',
    }
  }

  if (file.size === 0) {
    return { ok: false, error: 'Selected file is empty. Please choose a valid document.' }
  }

  if (file.size > MAX_RAW_FILE_BYTES) {
    return {
      ok: false,
      error: `File exceeds the ${formatBytesCompact(MAX_RAW_FILE_BYTES)} maximum size limit.`,
    }
  }

  const isPdf = mime === 'application/pdf' || ext === 'pdf'
  if (isPdf) {
    if (file.size > MAX_UPLOAD_BYTES) {
      return {
        ok: false,
        error: `PDF exceeds ${formatBytesCompact(MAX_UPLOAD_BYTES)}. Please compress the PDF before uploading.`,
      }
    }
    return {
      ok: true,
      prepared: {
        blob: file,
        fileName: sanitizeFileName(file.name, 'pdf'),
        mimeType: 'application/pdf',
        originalBytes: file.size,
        compressedBytes: file.size,
        wasCompressed: false,
      },
    }
  }

  try {
    const compressed = await compressImageBlob(file)
    if (compressed.blob.size > MAX_UPLOAD_BYTES) {
      // Second pass at slightly tighter resolution/quality for large mobile camera captures
      const tighter = await compressImageBlob(file, 1200, 0.65)
      if (tighter.blob.size > MAX_UPLOAD_BYTES) {
        return {
          ok: false,
          error: `Image is still larger than ${formatBytesCompact(MAX_UPLOAD_BYTES)} after compression.`,
        }
      }
      return {
        ok: true,
        prepared: {
          blob: tighter.blob,
          fileName: sanitizeFileName(file.name, tighter.ext),
          mimeType: tighter.mimeType,
          originalBytes: file.size,
          compressedBytes: tighter.blob.size,
          wasCompressed: tighter.blob.size < file.size,
        },
      }
    }

    return {
      ok: true,
      prepared: {
        blob: compressed.blob,
        fileName: sanitizeFileName(file.name, compressed.ext),
        mimeType: compressed.mimeType,
        originalBytes: file.size,
        compressedBytes: compressed.blob.size,
        wasCompressed: compressed.blob.size < file.size,
      },
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Could not process the selected verification image.',
    }
  }
}
