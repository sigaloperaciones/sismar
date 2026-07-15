import { promises as fs } from "fs"
import path from "path"
import { prisma } from "./prisma"

/**
 * Módulo central de subida de archivos.
 * (Remediación SEC-006, SEC-010 y SEC-017 — Auditoría FOSCAL jul/2026.)
 *
 * - Whitelist de tipos: PDF, PNG y JPG. SVG queda EXCLUIDO (vector de XSS almacenado).
 * - Tamaño máximo: 10 MB (mitiga DoS por archivos gigantes).
 * - Única fuente de verdad: las server actions NO deben duplicar esta lógica.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

// MIME permitido -> extensiones válidas para ese MIME
const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
    "application/pdf": [".pdf"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
}

// Tipos que el endpoint /api/uploads puede servir inline sin riesgo de script
export const INLINE_CONTENT_TYPES: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
}

export type UploadValidation = { ok: true } | { ok: false; error: string }

export function validateUploadFile(file: {
    name: string
    size: number
    type: string
}): UploadValidation {
    if (file.size > MAX_UPLOAD_BYTES) {
        return { ok: false, error: "El archivo supera el tamaño máximo permitido (10 MB)" }
    }
    const allowedExts = ALLOWED_UPLOAD_TYPES[file.type]
    if (!allowedExts) {
        return { ok: false, error: "Tipo de archivo no permitido (solo PDF, PNG o JPG)" }
    }
    const ext = path.extname(file.name).toLowerCase()
    if (!allowedExts.includes(ext)) {
        return { ok: false, error: "La extensión del archivo no corresponde a su tipo" }
    }
    return { ok: true }
}

export type SaveUploadResult = { url: string } | { error: string }

/**
 * Valida y persiste un archivo subido. Devuelve la URL pública o un error.
 * El nombre final se sanitiza y se hace único con timestamp.
 */
export async function saveUploadedFile(file: File, prefix = ""): Promise<SaveUploadResult> {
    const validation = validateUploadFile(file)
    if (!validation.ok) return { error: validation.error }

    const config = await prisma.empresaConfig.findFirst()
    const uploadsDirParam = config?.uploadsDir

    let baseUploadsDir = uploadsDirParam || path.join(process.cwd(), "public", "uploads")
    if (!path.isAbsolute(baseUploadsDir)) {
        baseUploadsDir = path.resolve(process.cwd(), baseUploadsDir)
    }
    await fs.mkdir(baseUploadsDir, { recursive: true })

    const filename = `${prefix}${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
    const filePath = path.join(baseUploadsDir, filename)

    const buffer = Buffer.from(await file.arrayBuffer())
    await fs.writeFile(filePath, buffer)

    return {
        url: uploadsDirParam
            ? `/api/uploads?filename=${encodeURIComponent(filename)}`
            : `/uploads/${filename}`,
    }
}
