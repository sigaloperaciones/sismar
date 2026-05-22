import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { promises as fs } from "fs"
import path from "path"

export async function GET(request: NextRequest) {
    try {
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
            
            // Determinar Content-Type aproximado por extensión
            let contentType = "application/octet-stream"
            const ext = path.extname(safeFilename).toLowerCase()
            if (ext === ".pdf") {
                contentType = "application/pdf"
            } else if (ext === ".png") {
                contentType = "image/png"
            } else if (ext === ".jpg" || ext === ".jpeg") {
                contentType = "image/jpeg"
            } else if (ext === ".gif") {
                contentType = "image/gif"
            } else if (ext === ".svg") {
                contentType = "image/svg+xml"
            }

            return new NextResponse(fileBuffer, {
                headers: {
                    "Content-Type": contentType,
                    "Content-Disposition": `inline; filename="${safeFilename}"`,
                },
            })
        } catch (e) {
            return new NextResponse("File not found", { status: 404 })
        }
    } catch (error) {
        console.error("Error serving uploaded file:", error)
        return new NextResponse("Internal Server Error", { status: 500 })
    }
}
