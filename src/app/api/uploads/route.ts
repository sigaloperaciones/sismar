import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getAuthContext } from "@/lib/auth-guard"
import { INLINE_CONTENT_TYPES, legacyPublicUploadsDir, resolveUploadsDir } from "@/lib/uploads"
import { resolveUploadAccess } from "@/lib/upload-access"
import { UPLOADS_RESPONSE_CSP } from "@/lib/csp"
import { audit } from "@/lib/audit"

/**
 * GET /api/uploads?filename=<nombre>
 *
 * Único punto de entrega de archivos subidos (SEC-004 + H-003 / C-006 — A-06).
 *  1. Sesión VÁLIDA Y VIVA (store en BD), no solo un JWT bien firmado.
 *  2. ACL por objeto: el archivo debe estar referenciado por una pieza, una
 *     planilla o el logo que el usuario puede ver. Si no → 403; si nadie lo
 *     referencia → 404 (no se sirven huérfanos).
 *  3. Respuesta endurecida: nosniff, Content-Disposition, CSP sin ejecución,
 *     sin caché compartida.
 */
export async function GET(request: NextRequest) {
    try {
        const ctx = await getAuthContext()
        if (!ctx) {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const filename = searchParams.get("filename")
        if (!filename) {
            return new NextResponse("Filename is required", { status: 400 })
        }

        // Evitar path traversal: solo el nombre base, y solo caracteres seguros.
        const safeFilename = path.basename(filename)
        if (safeFilename !== filename || !/^[A-Za-z0-9._-]+$/.test(safeFilename)) {
            return new NextResponse("Bad Request", { status: 400 })
        }

        const access = await resolveUploadAccess(ctx, safeFilename)
        if (access === "NOT_FOUND") {
            return new NextResponse("File not found", { status: 404 })
        }
        if (access === "FORBIDDEN") {
            await audit({ ctx, accion: "ARCHIVO_DENEGADO", entidad: "Archivo", entidadId: safeFilename })
            return new NextResponse("Forbidden", { status: 403 })
        }

        const fileBuffer = await readFromStorage(safeFilename)
        if (!fileBuffer) {
            return new NextResponse("File not found", { status: 404 })
        }

        // SEC-010: solo tipos seguros se sirven inline; cualquier otro se fuerza
        // como descarga (octet-stream). Un SVG con <script> jamás se ejecuta.
        const ext = path.extname(safeFilename).toLowerCase()
        const inlineType = INLINE_CONTENT_TYPES[ext]

        const common = {
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": UPLOADS_RESPONSE_CSP,
            "Cache-Control": "private, no-store",
            "X-Frame-Options": "SAMEORIGIN",
        }

        return new NextResponse(new Uint8Array(fileBuffer), {
            headers: inlineType
                ? { ...common, "Content-Type": inlineType, "Content-Disposition": `inline; filename="${safeFilename}"` }
                : { ...common, "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${safeFilename}"` },
        })
    } catch (error) {
        console.error("Error serving uploaded file:", error instanceof Error ? error.message : String(error))
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}

/** Lee del directorio privado; si no está, del legado public/uploads (solo lectura). */
async function readFromStorage(filename: string): Promise<Buffer | null> {
    const dirs = [await resolveUploadsDir(), legacyPublicUploadsDir()]
    for (const dir of dirs) {
        const filePath = path.join(dir, filename)
        // Defensa adicional: el path resuelto debe seguir dentro del directorio.
        if (!filePath.startsWith(path.resolve(dir) + path.sep)) continue
        try {
            return await fs.readFile(filePath)
        } catch {
            // probar siguiente directorio
        }
    }
    return null
}
