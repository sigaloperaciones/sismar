import { promises as fs } from "fs"
import path from "path"
import { randomUUID } from "crypto"
import { prisma } from "./prisma"

/**
 * Módulo central de subida de archivos.
 * (SEC-006/010/017 — FOSCAL; H-003 / C-006 — hallazgos A-06 y M-03.)
 *
 * - Whitelist de tipos: PDF, PNG y JPG. SVG EXCLUIDO (XSS almacenado).
 * - Tamaño máximo: 10 MB.
 * - Validación por MAGIC BYTES: el contenido debe corresponder al tipo declarado.
 * - Los archivos se guardan FUERA de `public/` y se sirven SOLO por
 *   `/api/uploads` (sesión + ACL por objeto). Nunca por URL estática.
 * - El nombre final lo genera el servidor (sin el nombre original del cliente).
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024 // 10 MB

// MIME permitido -> extensiones válidas para ese MIME
const ALLOWED_UPLOAD_TYPES: Record<string, string[]> = {
    "application/pdf": [".pdf"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
}

// Tipos que el endpoint /api/uploads puede servir inline sin riesgo de script.
// (.gif retirado: no está en la whitelist de subida — M-03.)
export const INLINE_CONTENT_TYPES: Record<string, string> = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
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

export type SniffedType = "pdf" | "png" | "jpeg"

/** Detecta el tipo real por los primeros bytes (magic bytes). */
export function sniffUploadType(head: Uint8Array): SniffedType | null {
    // %PDF-
    if (head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d) return "pdf"
    // \x89PNG\r\n\x1a\n
    if (head.length >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47 &&
        head[4] === 0x0d && head[5] === 0x0a && head[6] === 0x1a && head[7] === 0x0a) return "png"
    // \xFF\xD8\xFF
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpeg"
    return null
}

const EXT_TO_SNIFF: Record<string, SniffedType> = {
    ".pdf": "pdf",
    ".png": "png",
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
}

/** Valida que el contenido corresponda a la extensión declarada. */
export function validateUploadContent(filename: string, head: Uint8Array): UploadValidation {
    const ext = path.extname(filename).toLowerCase()
    const expected = EXT_TO_SNIFF[ext]
    if (!expected) return { ok: false, error: "Tipo de archivo no permitido (solo PDF, PNG o JPG)" }
    const actual = sniffUploadType(head)
    if (actual !== expected) {
        return { ok: false, error: "El contenido del archivo no corresponde a su tipo declarado" }
    }
    return { ok: true }
}

/** Directorio por defecto cuando no hay UPLOADS_DIR ni configuración: fuera de public/. */
export function defaultUploadsDir(cwd = process.cwd()): string {
    return path.join(cwd, "storage", "uploads")
}

/** ¿El directorio cae dentro de `public/` (servido estáticamente sin auth)? */
export function isInsidePublicDir(dir: string, cwd = process.cwd()): boolean {
    const publicDir = path.resolve(cwd, "public")
    const resolved = path.resolve(cwd, dir)
    const rel = path.relative(publicDir, resolved)
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))
}

/**
 * Resuelve el directorio privado de uploads. Prioridad:
 * `UPLOADS_DIR` (entorno) > `EmpresaConfig.uploadsDir` > `<cwd>/storage/uploads`.
 * Un directorio dentro de `public/` se RECHAZA y se usa el valor por defecto.
 */
export async function resolveUploadsDir(): Promise<string> {
    let candidate = process.env.UPLOADS_DIR?.trim()
    if (!candidate) {
        try {
            const config = await prisma.empresaConfig.findFirst({ select: { uploadsDir: true } })
            candidate = config?.uploadsDir?.trim() || undefined
        } catch {
            candidate = undefined
        }
    }
    let dir = candidate ? (path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate)) : defaultUploadsDir()
    if (isInsidePublicDir(dir)) {
        console.warn("[uploads] el directorio configurado está dentro de public/ (A-06); se usa el directorio privado por defecto")
        dir = defaultUploadsDir()
    }
    return dir
}

/** Directorio legado (public/uploads) — solo lectura para archivos no migrados. */
export function legacyPublicUploadsDir(cwd = process.cwd()): string {
    return path.join(cwd, "public", "uploads")
}

export type SaveUploadResult = { url: string; filename: string } | { error: string }

/** Nombre seguro generado en servidor: prefijo + timestamp + uuid + extensión. */
export function buildStoredFilename(originalName: string, prefix = ""): string {
    const ext = path.extname(originalName).toLowerCase()
    const safePrefix = prefix.replace(/[^a-zA-Z0-9-]/g, "")
    return `${safePrefix}${Date.now()}-${randomUUID()}${ext}`
}

/** Construye la URL de acceso (siempre vía API con ACL). */
export function uploadUrlFor(filename: string): string {
    return `/api/uploads?filename=${encodeURIComponent(filename)}`
}

/**
 * Extrae el nombre de archivo de una URL almacenada. Soporta el formato actual
 * (`/api/uploads?filename=x`) y el legado (`/uploads/x`). Devuelve null si no es
 * una URL de archivo gestionado.
 */
export function uploadFilenameFromUrl(url: string | null | undefined): string | null {
    if (!url) return null
    const qs = url.indexOf("filename=")
    if (qs !== -1) {
        try {
            return path.basename(decodeURIComponent(url.slice(qs + "filename=".length).split("&")[0]))
        } catch {
            return null
        }
    }
    if (url.startsWith("/uploads/")) {
        return path.basename(url.slice("/uploads/".length).split("?")[0])
    }
    return null
}

/**
 * Valida (metadatos + contenido) y persiste un archivo subido en el directorio
 * privado. Devuelve la URL de API o un error.
 */
export async function saveUploadedFile(file: File, prefix = ""): Promise<SaveUploadResult> {
    const validation = validateUploadFile(file)
    if (!validation.ok) return { error: validation.error }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
        return { error: "El archivo supera el tamaño máximo permitido (10 MB)" }
    }
    const content = validateUploadContent(file.name, buffer.subarray(0, 16))
    if (!content.ok) return { error: content.error }

    const baseUploadsDir = await resolveUploadsDir()
    await fs.mkdir(baseUploadsDir, { recursive: true })

    const filename = buildStoredFilename(file.name, prefix)
    const filePath = path.join(baseUploadsDir, filename)
    await fs.writeFile(filePath, buffer, { flag: "wx" })

    return { url: uploadUrlFor(filename), filename }
}
