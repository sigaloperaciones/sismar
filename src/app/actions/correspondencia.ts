"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function registerIncomingMail(prevState: unknown, formData: FormData) {
    try {
        const empresaMensajeria = formData.get("empresaMensajeria") as string
        const remitenteNombre = formData.get("remitenteNombre") as string
        const remitenteCiudad = formData.get("remitenteCiudad") as string
        const agenciaId = parseInt(formData.get("agenciaId") as string)
        const asunto = formData.get("asunto") as string
        const importancia = formData.get("importancia") as string
        const necesitaRespuesta = formData.get("necesitaRespuesta") === "on"

        const anexoTypes = formData.getAll("anexoType")
        const anexoQuantities = formData.getAll("anexoQuantity")

        if (!empresaMensajeria || !remitenteNombre || !agenciaId || !asunto) {
            return { error: "Faltan campos obligatorios" }
        }

        await prisma.correspondencia.create({
            data: {
                tipo: "ENTRANTE",
                empresaMensajeria,
                remitenteNombre,
                remitenteCiudad: remitenteCiudad || null,
                agenciaId,
                asunto,
                importancia: importancia || "NORMAL",
                necesitaRespuesta,
                estado: "POR_ENTREGAR",
                consecutive: Date.now().toString(),
                anexos: {
                    create: anexoTypes
                        .map((typeId, index) => ({
                            tipoAnexoId: parseInt(typeId as string),
                            cantidad: parseInt(anexoQuantities[index] as string) || 1,
                        }))
                        .filter(a => !isNaN(a.tipoAnexoId)),
                },
            },
        })

        revalidatePath("/correspondencia/entrante")
        return { success: true, message: "Correspondencia registrada correctamente" }
    } catch (error) {
        console.error(error)
        return { error: "Error al registrar correspondencia" }
    }
}

export async function registerOutgoingMail(prevState: unknown, formData: FormData) {
    try {
        const agenciaId = parseInt(formData.get("agenciaId") as string)
        const empresaMensajeria = formData.get("empresaMensajeria") as string
        const destinatarioNombre = formData.get("destinatarioNombre") as string
        const destinatarioCiudad = formData.get("destinatarioCiudad") as string
        const asunto = formData.get("asunto") as string
        const importancia = formData.get("importancia") as string

        if (!agenciaId || !empresaMensajeria || !destinatarioNombre || !asunto) {
            return { error: "Faltan campos obligatorios" }
        }

        await prisma.correspondencia.create({
            data: {
                tipo: "SALIENTE",
                agenciaId,
                empresaMensajeria,
                // Para salientes: remitenteNombre almacena el destinatario externo
                remitenteNombre: destinatarioNombre,
                remitenteCiudad: destinatarioCiudad || null,
                asunto,
                importancia: importancia || "NORMAL",
                necesitaRespuesta: false,
                estado: "POR_ENTREGAR",
                consecutive: "SAL-" + Date.now(),
            },
        })

        revalidatePath("/correspondencia/saliente")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Error al registrar correspondencia saliente" }
    }
}

export async function updateMailAction(prevState: unknown, formData: FormData) {
    const { promises: fs } = require("fs")
    const path = require("path")

    try {
        const id = parseInt(formData.get("id") as string)
        if (!id || isNaN(id)) {
            return { error: "ID inválido" }
        }

        const tipo = formData.get("tipo") as string // "ENTRANTE" | "SALIENTE"
        const remitenteNombre = formData.get("remitenteNombre") as string
        const remitenteCiudad = formData.get("remitenteCiudad") as string
        const asunto = formData.get("asunto") as string
        const importancia = formData.get("importancia") as string
        const needsRespuesta = formData.get("necesitaRespuesta")
        const necesitaRespuesta = needsRespuesta === "true" || needsRespuesta === "on"

        // Datos específicos para correspondencia saliente
        const numeroGuia = formData.get("numeroGuia") as string
        const empresaMensajeria = formData.get("empresaMensajeria") as string
        const mensajero = formData.get("mensajero") as string
        
        let guiaUrl = formData.get("guiaUrl") as string || null

        // Procesar archivo si existe
        const guiaFile = formData.get("guiaFile") as File | null
        if (guiaFile && guiaFile.size > 0 && guiaFile.name) {
            // Obtener configuración de empresa para la carpeta externa
            const config = await prisma.empresaConfig.findFirst()
            const uploadsDirParam = config?.uploadsDir

            let baseUploadsDir = uploadsDirParam || path.join(process.cwd(), "public", "uploads")
            // Resolver ruta absoluta si es relativa
            if (!path.isAbsolute(baseUploadsDir)) {
                baseUploadsDir = path.resolve(process.cwd(), baseUploadsDir)
            }

            // Asegurar que el directorio de uploads exista
            await fs.mkdir(baseUploadsDir, { recursive: true })

            const filename = `${Date.now()}-${guiaFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
            const filePath = path.join(baseUploadsDir, filename)
            
            const arrayBuffer = await guiaFile.arrayBuffer()
            const buffer = Buffer.from(arrayBuffer)
            await fs.writeFile(filePath, buffer)

            // Si es la ruta predeterminada de public, guardamos el path público relative /uploads/...
            // Si es una ruta externa personalizada, guardamos la URL especial de API /api/uploads?filename=...
            if (uploadsDirParam) {
                guiaUrl = `/api/uploads?filename=${encodeURIComponent(filename)}`
            } else {
                guiaUrl = `/uploads/${filename}`
            }
        }

        // Actualizar base de datos
        const updateData: Record<string, any> = {
            asunto,
            importancia,
        }

        if (tipo === "ENTRANTE") {
            updateData.remitenteNombre = remitenteNombre
            updateData.remitenteCiudad = remitenteCiudad || null
            updateData.empresaMensajeria = empresaMensajeria || null
            updateData.necesitaRespuesta = necesitaRespuesta
        } else {
            // En correspondencia saliente:
            // remitenteNombre almacena el destinatario
            // remitenteCiudad almacena la ciudad destino
            updateData.remitenteNombre = remitenteNombre
            updateData.remitenteCiudad = remitenteCiudad || null
            updateData.empresaMensajeria = empresaMensajeria || null
            updateData.numeroGuia = numeroGuia || null
            updateData.mensajero = mensajero || null
            if (guiaUrl) {
                updateData.guiaUrl = guiaUrl
            }
        }

        const updated = await prisma.correspondencia.update({
            where: { id },
            data: updateData,
            include: { agencia: true }
        })

        // Enviar correo si correspondencia saliente completó los 4 campos
        if (tipo === "SALIENTE") {
            const hasGuia = !!updated.numeroGuia
            const hasTransportadora = !!updated.empresaMensajeria
            const hasMensajero = !!updated.mensajero
            const hasGuiaUrl = !!updated.guiaUrl

            if (hasGuia && hasTransportadora && hasMensajero && hasGuiaUrl) {
                // Envío de correo electrónico al correo de la agencia
                const emailTo = updated.agencia.email || "agencia@sismar.com"
                console.log(`[EMAIL] Para: ${emailTo}`)
                console.log(`[EMAIL] Asunto: Correspondencia saliente enviada - Guía: ${updated.numeroGuia}`)
                console.log(`[EMAIL] Detalles: Se ha completado el envío de tu correspondencia saliente:`)
                console.log(`  - Destinatario: ${updated.remitenteNombre}`)
                console.log(`  - Ciudad Destino: ${updated.remitenteCiudad || "—"}`)
                console.log(`  - Asunto: ${updated.asunto}`)
                console.log(`  - Empresa de Mensajería: ${updated.empresaMensajeria}`)
                console.log(`  - Mensajero: ${updated.mensajero}`)
                console.log(`  - Número de Guía: ${updated.numeroGuia}`)
                console.log(`  - Soporte de Guía: ${updated.guiaUrl}`)
            }
        }

        revalidatePath("/correspondencia/pendientes")
        revalidatePath("/reportes")
        return { success: true, message: "Correspondencia actualizada correctamente" }
    } catch (error) {
        console.error("Error al actualizar la correspondencia:", error)
        return { error: "Error al actualizar correspondencia" }
    }
}

