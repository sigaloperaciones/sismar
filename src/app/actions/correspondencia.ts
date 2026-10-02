"use server"

import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireSession, requirePermission, assertPermission, handleActionError, ok, fail, ForbiddenError } from "@/lib/auth-guard"
import { assertAgenciaAccess, canAccessAgencia, isGlobalScope } from "@/lib/tenancy"
import { PERMISOS } from "@/lib/permissions-catalog"
import {
    incomingMailSchema,
    outgoingMailSchema,
    updateMailSchema,
    anexoIdentifiersSchema,
    MAX_ANEXO_IDENTIFIERS_JSON_CHARS,
    MAX_ANEXOS,
} from "@/lib/schemas/correspondencia"
import { saveUploadedFile } from "@/lib/uploads"
import { generateConsecutive } from "@/lib/consecutive"
import { audit } from "@/lib/audit"
import { sendMail } from "@/lib/notifications"

/** Extrae el primer mensaje de error de un resultado Zod fallido. */
function firstZodError(result: { error: { issues: Array<{ message: string }> } }): string {
    return result.error.issues[0]?.message ?? "Datos inválidos"
}

/**
 * Construye la relación `anexos.create` a partir del FormData.
 * (Única implementación — SEC-017.) B-06: los identificadores tienen tope de
 * tamaño y cantidad (anexoIdentifiersSchema) antes de JSON.parse.
 */
function buildAnexosCreate(formData: FormData): Prisma.AnexoCreateWithoutCorrespondenciaInput[] {
    const anexoTypes = formData.getAll("anexoType")
    const anexoQuantities = formData.getAll("anexoQuantity")
    const anexoIdentifiers = formData.getAll("anexoIdentifiers")

    const result: Prisma.AnexoCreateWithoutCorrespondenciaInput[] = []

    anexoTypes.forEach((typeId, index) => {
        if (result.length >= MAX_ANEXOS) return // R-040: tope de anexos por pieza
        const parsedId = parseInt(typeId as string)
        if (isNaN(parsedId)) return

        let detalles: Prisma.AnexoDetalleCreateNestedManyWithoutAnexoInput | undefined
        const identsStr = anexoIdentifiers[index]
        if (typeof identsStr === "string" && identsStr.length > 0) {
            if (identsStr.length > MAX_ANEXO_IDENTIFIERS_JSON_CHARS) {
                console.warn("Identificadores de anexo demasiado largos; se omiten")
            } else {
                try {
                    const parsed = anexoIdentifiersSchema.safeParse(JSON.parse(identsStr))
                    if (parsed.success) {
                        const validIdents = parsed.data.filter(i => i.trim() !== "")
                        if (validIdents.length > 0) {
                            detalles = { create: validIdents.map(identificador => ({ identificador })) }
                        }
                    } else {
                        console.warn("Identificadores de anexo inválidos:", firstZodError(parsed))
                    }
                } catch (e) {
                    // SEC-014: no silenciar — registrar sin interrumpir el flujo
                    console.warn("Identificadores de anexo con formato inválido:", e instanceof Error ? e.message : String(e))
                }
            }
        }

        const cantidad = Math.min(Math.max(parseInt(anexoQuantities[index] as string) || 1, 1), 999)
        result.push({
            tipoAnexo: { connect: { id: parsedId } },
            cantidad,
            detalles,
        })
    })

    return result
}

export async function registerIncomingMail(prevState: unknown, formData: FormData) {
    try {
        const ctx = await requirePermission(PERMISOS.ENTRANTE_CREAR)

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
            return fail(firstZodError(parsed))
        }
        const data = parsed.data
        const agenciaId = parseInt(data.agenciaId)
        if (isNaN(agenciaId)) {
            return fail("Debe seleccionar una agencia destinataria válida")
        }
        // C-002: una AGENCIA solo registra para sí misma.
        await assertAgenciaAccess(ctx, agenciaId, "Agencia", agenciaId)

        const created = await prisma.correspondencia.create({
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
                createdBy: ctx.username,
                anexos: {
                    create: buildAnexosCreate(formData),
                },
            },
        })

        await audit({ ctx, accion: "CORRESPONDENCIA_CREAR", entidad: "Correspondencia", entidadId: created.id, detalle: { tipo: "ENTRANTE", agenciaId } })

        revalidatePath("/correspondencia/entrante")
        return ok({ message: "Correspondencia registrada correctamente" })
    } catch (error) {
        return handleActionError(error, "Error al registrar correspondencia")
    }
}

export async function registerOutgoingMail(prevState: unknown, formData: FormData) {
    try {
        const ctx = await requirePermission(PERMISOS.SALIENTE_CREAR)

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
            return fail(firstZodError(parsed))
        }
        const data = parsed.data
        const agenciaId = parseInt(data.agenciaId)
        if (isNaN(agenciaId)) {
            return fail("Debe seleccionar la agencia de origen")
        }
        // C-002: una AGENCIA solo registra para sí misma.
        await assertAgenciaAccess(ctx, agenciaId, "Agencia", agenciaId)

        const mensajero = ((formData.get("mensajero") as string) || "").trim().slice(0, 120)
        const numeroGuia = ((formData.get("numeroGuia") as string) || "").trim().slice(0, 80)
        let guiaUrl: string | null = null

        // SEC-006/SEC-017: subida centralizada con whitelist de tipo, tamaño y magic bytes
        const guiaFile = formData.get("guiaFile") as File | null
        if (guiaFile && guiaFile.size > 0 && guiaFile.name) {
            const saved = await saveUploadedFile(guiaFile)
            if ("error" in saved) return fail(saved.error)
            guiaUrl = saved.url
            await audit({ ctx, accion: "ARCHIVO_SUBIR", entidad: "Archivo", entidadId: saved.filename, detalle: { uso: "guia" } })
        }

        const created = await prisma.correspondencia.create({
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
                createdBy: ctx.username,
                anexos: {
                    create: buildAnexosCreate(formData),
                },
            },
        })

        await audit({ ctx, accion: "CORRESPONDENCIA_CREAR", entidad: "Correspondencia", entidadId: created.id, detalle: { tipo: "SALIENTE", agenciaId } })

        revalidatePath("/correspondencia/saliente")
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al registrar correspondencia saliente")
    }
}

/**
 * "Completar/Editar" correspondencia (H-003 / C-003 — hallazgos A-02 y B-06).
 *
 *  1. Se carga el registro por id ANTES de autorizar: el permiso exigido depende
 *     del `tipo` REAL del registro, no del valor enviado por el cliente.
 *  2. Pertenencia: una AGENCIA solo edita piezas de su agencia y no puede
 *     reasignarlas a otra.
 *  3. Validación Zod completa de la entrada (updateMailSchema).
 */
export async function updateMailAction(prevState: unknown, formData: FormData) {
    try {
        const parsed = updateMailSchema.safeParse({
            id: formData.get("id"),
            remitenteNombre: (formData.get("remitenteNombre") as string) || "",
            remitenteCiudad: (formData.get("remitenteCiudad") as string) || "",
            destinatarioNombre: (formData.get("destinatarioNombre") as string) || "",
            destinatarioCiudad: (formData.get("destinatarioCiudad") as string) || "",
            asunto: formData.get("asunto"),
            importancia: (formData.get("importancia") as string) || "NORMAL",
            necesitaRespuesta: formData.get("necesitaRespuesta") === "true" || formData.get("necesitaRespuesta") === "on",
            agenciaId: (formData.get("agenciaId") as string) || undefined,
            empresaMensajeria: (formData.get("empresaMensajeria") as string) || "",
            numeroGuia: (formData.get("numeroGuia") as string) || "",
            mensajero: (formData.get("mensajero") as string) || "",
        })
        if (!parsed.success) {
            return fail(firstZodError(parsed))
        }
        const data = parsed.data

        // R-033: autenticar ANTES de consultar la BD (sin oráculo de existencia de IDs).
        const ctx = await requireSession()

        const existing = await prisma.correspondencia.findUnique({
            where: { id: data.id },
            select: {
                id: true, tipo: true, agenciaId: true, estado: true, planillaId: true,
                asunto: true, importancia: true, remitenteNombre: true, remitenteCiudad: true,
                empresaMensajeria: true, numeroGuia: true, mensajero: true, necesitaRespuesta: true,
            },
        })
        if (!existing) return fail("Correspondencia no encontrada")

        // Permiso según el tipo REAL del registro (no el enviado por el cliente).
        await assertPermission(ctx, existing.tipo === "SALIENTE" ? PERMISOS.SALIENTE_CREAR : PERMISOS.ENTRANTE_CREAR)
        await assertAgenciaAccess(ctx, existing.agenciaId, "Correspondencia", existing.id)

        // R-034 (cadena de custodia): solo se edita una pieza pendiente y fuera de planilla.
        if (existing.estado !== "POR_ENTREGAR" || existing.planillaId !== null) {
            return fail("La correspondencia ya está en una planilla o fue gestionada: no se puede editar")
        }

        // Cambio de agencia: solo alcance global; una AGENCIA no puede reasignar.
        let nuevaAgenciaId: number | undefined
        if (data.agenciaId && data.agenciaId !== existing.agenciaId) {
            if (!isGlobalScope(ctx) || !canAccessAgencia(ctx, data.agenciaId)) {
                throw new ForbiddenError("No puede reasignar la correspondencia a otra agencia (403)")
            }
            nuevaAgenciaId = data.agenciaId
        }

        // Nombre/ciudad: el formulario de salientes envía destinatario*, el de entrantes remitente*.
        const nombre = (data.remitenteNombre || data.destinatarioNombre || "").trim()
        const ciudad = (data.remitenteCiudad || data.destinatarioCiudad || "").trim()

        let guiaUrl: string | null = null
        // SEC-006/SEC-017: subida centralizada con whitelist de tipo, tamaño y magic bytes
        const guiaFile = formData.get("guiaFile") as File | null
        if (guiaFile && guiaFile.size > 0 && guiaFile.name) {
            const saved = await saveUploadedFile(guiaFile)
            if ("error" in saved) return fail(saved.error)
            guiaUrl = saved.url
            await audit({ ctx, accion: "ARCHIVO_SUBIR", entidad: "Archivo", entidadId: saved.filename, detalle: { uso: "guia", correspondenciaId: existing.id } })
        }

        const updateData: Prisma.CorrespondenciaUpdateInput = {
            asunto: data.asunto,
            importancia: data.importancia,
            remitenteNombre: nombre,
            remitenteCiudad: ciudad || null,
            empresaMensajeria: data.empresaMensajeria || null,
            updatedBy: ctx.username,
        }

        if (nuevaAgenciaId) {
            updateData.agencia = { connect: { id: nuevaAgenciaId } }
        }

        if (formData.has("anexoType") || formData.has("anexoQuantity")) {
            updateData.anexos = {
                deleteMany: {}, // Reemplaza todos los anexos existentes
                create: buildAnexosCreate(formData),
            }
        }

        if (existing.tipo === "ENTRANTE") {
            updateData.necesitaRespuesta = data.necesitaRespuesta ?? false
        } else {
            updateData.numeroGuia = data.numeroGuia || null
            updateData.mensajero = data.mensajero || null
            if (guiaUrl) {
                updateData.guiaUrl = guiaUrl
            }
        }

        const updated = await prisma.correspondencia.update({
            where: { id: existing.id },
            data: updateData,
            include: { agencia: true },
        })

        await audit({
            ctx,
            accion: "CORRESPONDENCIA_EDITAR",
            entidad: "Correspondencia",
            entidadId: updated.id,
            detalle: {
                tipo: updated.tipo,
                agenciaId: updated.agenciaId,
                reasignada: !!nuevaAgenciaId,
                // R-034: valores previos para reconstruir la historia de la pieza
                antes: {
                    asunto: existing.asunto,
                    importancia: existing.importancia,
                    remitenteNombre: existing.remitenteNombre,
                    remitenteCiudad: existing.remitenteCiudad,
                    empresaMensajeria: existing.empresaMensajeria,
                    numeroGuia: existing.numeroGuia,
                    mensajero: existing.mensajero,
                    necesitaRespuesta: existing.necesitaRespuesta,
                    agenciaId: existing.agenciaId,
                },
            },
        })

        // Aviso a la agencia cuando la saliente queda completa (guía + transportadora + mensajero + soporte)
        if (updated.tipo === "SALIENTE" && updated.numeroGuia && updated.empresaMensajeria && updated.mensajero && updated.guiaUrl) {
            if (updated.agencia.email) {
                await sendMail({
                    to: [updated.agencia.email],
                    subject: `Correspondencia saliente enviada - Guía: ${updated.numeroGuia}`,
                    body: [
                        "Se ha completado el envío de su correspondencia saliente:",
                        `- Destinatario: ${updated.remitenteNombre}`,
                        `- Ciudad destino: ${updated.remitenteCiudad || "—"}`,
                        `- Asunto: ${updated.asunto}`,
                        `- Empresa de mensajería: ${updated.empresaMensajeria}`,
                        `- Mensajero: ${updated.mensajero}`,
                        `- Número de guía: ${updated.numeroGuia}`,
                    ].join("\n"),
                })
            }
        }

        revalidatePath("/correspondencia/entrante")
        revalidatePath("/correspondencia/saliente")
        revalidatePath("/reportes")
        return ok({ message: "Correspondencia actualizada correctamente" })
    } catch (error) {
        return handleActionError(error, "Error al actualizar correspondencia")
    }
}
