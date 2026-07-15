import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { decrypt } from "@/lib/auth"
import { INLINE_CONTENT_TYPES } from "@/lib/uploads"
import { promises as fs } from "fs"
import path from "path"

export async function GET(request: NextRequest) {
    try {
        // SEC-004 (Auditoría FOSCAL): el middleware excluye /api, por lo que la
        // autenticación debe verificarse explícitamente antes de servir archivos.
        const sessionToken = request.cookies.get("session")?.value
        if (!sessionToken) {
            return new NextResponse("Unauthorized", { status: 401 })
        }
        try {
            await decrypt(sessionToken)
        } catch {
            return new NextResponse("Unauthorized", { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const filename = searchParams.get("filename")

        if (!filename) {
            return new NextResponse("Filename is required", { status: 400 })
        }

        // Evitar ataques de path traversal
        const safeFilename = path.basename(filename)

        const config = await prisma.empresaConfig.findFirst()
        const uploadsDirParam = config?.uploadsDir

        if (!uploadsDirParam) {
            return new NextResponse("External directory is not configured", { status: 400 })
        }

        let baseUploadsDir = uploadsDirParam
        if (!path.isAbsolute(baseUploadsDir)) {
            baseUploadsDir = path.resolve(process.cwd(), baseUploadsDir)
        }

        const filePath = path.join(baseUploadsDir, safeFilename)

        try {
            const fileBuffer = await fs.readFile(filePath)

            // SEC-010 (Auditoría FOSCAL): solo tipos seguros se sirven inline.
            // SVG (u otro tipo fuera de whitelist) se fuerza como descarga con
            // octet-stream — un SVG con <script> jamás se ejecuta en el navegador.
            const ext = path.extname(safeFilename).toLowerCase()
            const inlineType = INLINE_CONTENT_TYPES[ext]

            return new NextResponse(fileBuffer, {
                headers: inlineType
                    ? {
                        "Content-Type": inlineType,
                        "Content-Disposition": `inline; filename="${safeFilename}"`,
                        "X-Content-Type-Options": "nosniff",
                    }
                    : {
                        "Content-Type": "application/octet-stream",
                        "Content-Disposition": `attachment; filename="${safeFilename}"`,
                        "X-Content-Type-Options": "nosniff",
                    },
            })
        } catch (e) {
            return new NextResponse("File not found", { status: 404 })
        }
    } catch (error) {
        console.error("Error serving uploaded file:", error instanceof Error ? error.message : String(error))
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
