"use server"

import { requireSession, requirePermission } from "@/lib/auth-guard"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { incomingMailSchema, outgoingMailSchema } from "@/lib/schemas/correspondencia"
import { saveUploadedFile } from "@/lib/uploads"
import { generateConsecutive } from "@/lib/consecutive"

/** Extrae el primer mensaje de error de un resultado Zod fallido. */
function firstZodError(result: { error: { issues: Array<{ message: string }> } }): string {
    return result.error.issues[0]?.message ?? "Datos inválidos"
}

/**
 * Construye la relación `anexos.create` a partir del FormData.
 * (Única implementación — antes estaba triplicada; SEC-017.)
 */
function buildAnexosCreate(formData: FormData) {
    const anexoTypes = formData.getAll("anexoType")
    const anexoQuantities = formData.getAll("anexoQuantity")

    return anexoTypes
        .map((typeId, index) => {
            const parsedId = parseInt(typeId as string)
            if (isNaN(parsedId)) return null

            let anexoDetalles = undefined
            try {
                const identsStr = formData.getAll("anexoIdentifiers")[index] as string
                if (identsStr) {
                    const idents = JSON.parse(identsStr) as string[]
                    const validIdents = idents.filter(i => typeof i === "string" && i.trim() !== "")
                    if (validIdents.length > 0) {
                        anexoDetalles = {
                            create: validIdents.map(identificador => ({ identificador }))
                        }
                    }
                }
            } catch (e) {
                // SEC-014: no silenciar — registrar sin interrumpir el flujo
                console.warn("Identificadores de anexo con formato inválido:", e instanceof Error ? e.message : String(e))
            }

            return {
                tipoAnexoId: parsedId,
                cantidad: parseInt(anexoQuantities[index] as string) || 1,
                detalles: anexoDetalles
            }
        })
        .filter(a => a !== null) as any
}

export async function registerIncomingMail(prevState: unknown, formData: FormData) {
    await requirePermission('correspondencia.entrante.crear')
    try {
        // SEC-007: validación real con el esquema Zod compartido con el formulario
        const parsed = incomingMailSchema.safeParse({
            empresaMensajeria: formData.get("empresaMensajeria"),
            remitenteNombre: formData.get("remitenteNombre"),
            remitenteCiudad: (formData.get("remitenteCiudad") as string) || undefined,
            agenciaId: formData.get("agenciaId"),
            asunto: formData.get("asunto"),
            importancia: (formData.get("importancia") as string) || "NORMAL",
            necesitaRespuesta: formData.get("necesitaRespuesta") === "on",
        })
        if (!parsed.success) {
            return { error: firstZodError(parsed) }
        }
        const data = parsed.data
        const agenciaId = parseInt(data.agenciaId)
        if (isNaN(agenciaId)) {
            return { error: "Debe seleccionar una agencia destinataria válida" }
        }

        await prisma.correspondencia.create({
            data: {
                tipo: "ENTRANTE",
                empresaMensajeria: data.empresaMensajeria,
                remitenteNombre: data.remitenteNombre,
                remitenteCiudad: data.remitenteCiudad || null,
                agenciaId,
                asunto: data.asunto,
                importancia: data.importancia,
                necesitaRespuesta: data.necesitaRespuesta ?? false,
                estado: "POR_ENTREGAR",
                consecutive: generateConsecutive(),
                anexos: {
                    create: buildAnexosCreate(formData),
                },
            },
        })

        revalidatePath("/correspondencia/entrante")
        return { success: true, message: "Correspondencia registrada correctamente" }
    } catch (error) {
        console.error("Error al registrar correspondencia:", error instanceof Error ? error.message : String(error))
        return { error: "Error al registrar correspondencia" }
    }
}

export async function registerOutgoingMail(prevState: unknown, formData: FormData) {
    await requirePermission('correspondencia.saliente.crear')
    try {
        // SEC-007: validación real con el esquema Zod compartido con el formulario
        const parsed = outgoingMailSchema.safeParse({
            agenciaId: formData.get("agenciaId"),
            empresaMensajeria: formData.get("empresaMensajeria"),
            destinatarioNombre: formData.get("destinatarioNombre"),
            destinatarioCiudad: (formData.get("destinatarioCiudad") as string) || undefined,
            asunto: formData.get("asunto"),
            importancia: (formData.get("importancia") as string) || "NORMAL",
        })
        if (!parsed.success) {
            return { error: firstZodError(parsed) }
        }
        const data = parsed.data
        const agenciaId = parseInt(data.agenciaId)
        if (isNaN(agenciaId)) {
            return { error: "Debe seleccionar la agencia de origen" }
        }

        const mensajero = formData.get("mensajero") as string
        const numeroGuia = formData.get("numeroGuia") as string
        let guiaUrl: string | null = null

        // SEC-006/SEC-017: subida centralizada con whitelist de tipo y tamaño máximo
        const guiaFile = formData.get("guiaFile") as File | null
        if (guiaFile && guiaFile.size > 0 && guiaFile.name) {
            const saved = await saveUploadedFile(guiaFile)
            if ("error" in saved) return { error: saved.error }
            guiaUrl = saved.url
        }

        await prisma.correspondencia.create({
            data: {
                tipo: "SALIENTE",
                agenciaId,
                empresaMensajeria: data.empresaMensajeria,
                // Para salientes: remitenteNombre almacena el destinatario externo
                remitenteNombre: data.destinatarioNombre,
                remitenteCiudad: data.destinatarioCiudad || null,
                asunto: data.asunto,
                importancia: data.importancia,
                necesitaRespuesta: false,
                estado: "POR_ENTREGAR",
                consecutive: generateConsecutive("SAL-"),
                mensajero: mensajero || null,
                numeroGuia: numeroGuia || null,
                guiaUrl: guiaUrl,
                anexos: {
                    create: buildAnexosCreate(formData),
                },
            },
        })

        revalidatePath("/correspondencia/saliente")
        return { success: true }
    } catch (error) {
        console.error("Error al registrar correspondencia saliente:", error instanceof Error ? error.message : String(error))
        return { error: "Error al registrar correspondencia saliente" }
    }
}

export async function updateMailAction(prevState: unknown, formData: FormData) {
    // Guardian (req. cliente #2): "Completar/Editar" es parte del registro de
    // correspondencia. DEBE exigir el permiso granular correspondiente al tipo,
    // no basta con tener sesión. El guard va ANTES del try: requirePermission
    // redirige con NEXT_REDIRECT y el catch genérico no debe interceptarlo.
    const tipo = (formData.get("tipo") as string) || "ENTRANTE" // "ENTRANTE" | "SALIENTE"
    await requirePermission(
        tipo === "SALIENTE" ? "correspondencia.saliente.crear" : "correspondencia.entrante.crear"
    )

    try {
        const id = parseInt(formData.get("id") as string)
        if (!id || isNaN(id)) {
            return { error: "ID inválido" }
        }
        const remitenteNombre = formData.get("remitenteNombre") as string
        const remitenteCiudad = formData.get("remitenteCiudad") as string
        const asunto = formData.get("asunto") as string
        const importancia = formData.get("importancia") as string
        const needsRespuesta = formData.get("necesitaRespuesta")
        const necesitaRespuesta = needsRespuesta === "true" || needsRespuesta === "on"
        const agenciaIdRaw = formData.get("agenciaId")
        const agenciaId = agenciaIdRaw ? parseInt(agenciaIdRaw as string) : undefined

        // Datos específicos para correspondencia saliente
        const numeroGuia = formData.get("numeroGuia") as string
        const empresaMensajeria = formData.get("empresaMensajeria") as string
        const mensajero = formData.get("mensajero") as string

        let guiaUrl = formData.get("guiaUrl") as string || null

        // SEC-006/SEC-017: subida centralizada con whitelist de tipo y tamaño máximo
        const guiaFile = formData.get("guiaFile") as File | null
        if (guiaFile && guiaFile.size > 0 && guiaFile.name) {
            const saved = await saveUploadedFile(guiaFile)
            if ("error" in saved) return { error: saved.error }
            guiaUrl = saved.url
        }

        // Actualizar base de datos
        const updateData: Prisma.CorrespondenciaUpdateInput = {
            asunto,
            importancia,
        }

        if (agenciaId && !isNaN(agenciaId)) {
            updateData.agencia = { connect: { id: agenciaId } }
        }

        if (formData.has("anexoType") || formData.has("anexoQuantity")) {
            updateData.anexos = {
                deleteMany: {}, // Delete all existing anexos
                create: buildAnexosCreate(formData),
            }
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
        console.error("Error al actualizar la correspondencia:", error instanceof Error ? error.message : String(error))
        return { error: "Error al actualizar correspondencia" }
    }
}
