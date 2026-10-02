"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePermission, handleActionError, ok, fail } from "@/lib/auth-guard"
import { assertAgenciaAccess, assertPlanillaAccess, assertPlanillaManage } from "@/lib/tenancy"
import { PERMISOS } from "@/lib/permissions-catalog"
import { saveUploadedFile } from "@/lib/uploads"
import { audit } from "@/lib/audit"

/**
 * Ciclo de vida de planillas (H-003 / C-004 — hallazgo A-03; C-013 — B-03).
 *
 *  - generar            → planillas.crear    + pertenencia de la agencia solicitada
 *  - cerrar / reabrir /
 *    retirar / firma    → planillas.gestionar + pertenencia de la planilla
 *  - procesar           → correspondencia.recibir + pertenencia (lo hace la agencia
 *                         que recibe, desde "Mis Planillas")
 *
 * Cada acción devuelve `{ error: '... (403)' }` ante un objeto ajeno y deja
 * rastro en AuditLog. (Archivo renombrado desde `panillas.ts` — B-08.)
 */

export async function generatePlanillaAction(agenciaId: number | null, tipo: "ENTRANTE" | "SALIENTE" = "ENTRANTE") {
    try {
        const ctx = await requirePermission(PERMISOS.PLANILLAS_CREAR)
        if (tipo !== "ENTRANTE" && tipo !== "SALIENTE") return fail("Tipo de planilla inválido")

        if (tipo === "SALIENTE") {
            // Las salientes agrupan TODAS las agencias: requiere alcance global.
            await assertAgenciaAccess(ctx, null, "Planilla", "saliente")

            // B-03: transacción + updateMany filtrado por estado (dos clics concurrentes
            // no duplican ni pierden ítems: solo el primero "captura" cada pieza).
            const result = await prisma.$transaction(async tx => {
                const existing = await tx.planilla.findFirst({ where: { estado: "GENERADA", tipo: "SALIENTE" } })
                const planilla = existing ?? (await tx.planilla.create({
                    data: { estado: "GENERADA", tipo: "SALIENTE", createdBy: ctx.username },
                }))
                const assigned = await tx.correspondencia.updateMany({
                    where: { tipo: "SALIENTE", estado: "POR_ENTREGAR", planillaId: null },
                    data: { planillaId: planilla.id },
                })
                if (assigned.count === 0 && !existing) {
                    // Nada que asignar: no dejar una planilla vacía recién creada.
                    await tx.planilla.delete({ where: { id: planilla.id } })
                }
                return { planillaId: planilla.id, wasExisting: !!existing, assigned: assigned.count }
            })

            if (result.assigned === 0) {
                return fail("No hay correspondencia saliente pendiente")
            }

            await audit({ ctx, accion: "PLANILLA_GENERAR", entidad: "Planilla", entidadId: result.planillaId, detalle: { tipo, items: result.assigned } })
            revalidatePath("/planillas")
            return ok({ planillaId: result.planillaId, wasExisting: result.wasExisting })
        }

        // ENTRANTE: se agrupa por agencia
        if (!agenciaId || isNaN(agenciaId)) return fail("Debe indicar la agencia")
        await assertAgenciaAccess(ctx, agenciaId, "Agencia", agenciaId)

        const result = await prisma.$transaction(async tx => {
            const existing = await tx.planilla.findFirst({ where: { agenciaId, estado: "GENERADA", tipo: "ENTRANTE" } })
            const planilla = existing ?? (await tx.planilla.create({
                data: { agenciaId, estado: "GENERADA", tipo: "ENTRANTE", createdBy: ctx.username },
            }))
            const assigned = await tx.correspondencia.updateMany({
                where: { agenciaId, tipo: "ENTRANTE", estado: "POR_ENTREGAR", planillaId: null },
                data: { planillaId: planilla.id },
            })
            if (assigned.count === 0 && !existing) {
                await tx.planilla.delete({ where: { id: planilla.id } })
            }
            return { planillaId: planilla.id, wasExisting: !!existing, assigned: assigned.count }
        })

        if (result.assigned === 0) {
            return fail("No hay correspondencia entrante pendiente para esta agencia")
        }

        await audit({ ctx, accion: "PLANILLA_GENERAR", entidad: "Planilla", entidadId: result.planillaId, detalle: { tipo, agenciaId, items: result.assigned } })
        revalidatePath("/planillas")
        return ok({ planillaId: result.planillaId, wasExisting: result.wasExisting })
    } catch (error) {
        return handleActionError(error, "Error al generar planilla")
    }
}

async function loadPlanillaForManage(id: number) {
    return prisma.planilla.findUnique({
        where: { id },
        include: { correspondencias: { select: { agenciaId: true } } },
    })
}

export async function closePlanillaAction(id: number) {
    try {
        const ctx = await requirePermission(PERMISOS.PLANILLAS_GESTIONAR)
        const planilla = await loadPlanillaForManage(id)
        if (!planilla) return fail("Planilla no encontrada")
        await assertPlanillaManage(ctx, planilla)
        if (planilla.estado !== "GENERADA") return fail("Solo se pueden cerrar planillas en estado GENERADA")

        // Transición ATÓMICA condicionada al estado (Guardian: dos clics no cierran dos veces)
        const cerrada = await prisma.planilla.updateMany({ where: { id, estado: "GENERADA" }, data: { estado: "CERRADA" } })
        if (cerrada.count === 0) return fail("La planilla cambió de estado; recargue la página")

        // La correspondencia saliente, al cerrar la planilla, finaliza el proceso (estado = ENTREGADA)
        if (planilla.tipo === "SALIENTE") {
            await prisma.correspondencia.updateMany({
                where: { planillaId: id, tipo: "SALIENTE" },
                data: { estado: "ENTREGADA", fechaEntrega: new Date(), updatedBy: ctx.username },
            })
        }

        await audit({ ctx, accion: "PLANILLA_CERRAR", entidad: "Planilla", entidadId: id })
        revalidatePath("/planillas")
        revalidatePath(`/planillas/${id}`)
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al cerrar la planilla")
    }
}

export async function reopenPlanillaAction(id: number) {
    try {
        const ctx = await requirePermission(PERMISOS.PLANILLAS_GESTIONAR)
        const planilla = await prisma.planilla.findUnique({
            where: { id },
            include: {
                recorridoPlanillas: { include: { recorrido: true } },
                correspondencias: { select: { agenciaId: true } },
            },
        })
        if (!planilla) return fail("Planilla no encontrada")
        await assertPlanillaManage(ctx, planilla)
        if (planilla.estado !== "CERRADA") return fail("Solo se pueden reabrir planillas en estado CERRADA")

        // Solo planillas entrantes pueden estar en un recorrido
        if (planilla.tipo === "ENTRANTE") {
            const recorridoActivo = planilla.recorridoPlanillas.find(rp => rp.recorrido.estado === "INICIADO")
            if (recorridoActivo) return fail("No se puede reabrir: está en un recorrido iniciado")
        }

        const reabierta = await prisma.planilla.updateMany({ where: { id, estado: "CERRADA" }, data: { estado: "GENERADA" } })
        if (reabierta.count === 0) return fail("La planilla cambió de estado; recargue la página")

        // Revertir correspondencia saliente a POR_ENTREGAR
        if (planilla.tipo === "SALIENTE") {
            await prisma.correspondencia.updateMany({
                where: { planillaId: id, tipo: "SALIENTE" },
                data: { estado: "POR_ENTREGAR", fechaEntrega: null, updatedBy: ctx.username },
            })
        }

        await audit({ ctx, accion: "PLANILLA_REABRIR", entidad: "Planilla", entidadId: id })
        revalidatePath("/planillas")
        revalidatePath(`/planillas/${id}`)
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al reabrir la planilla")
    }
}

export async function removeCorrespondenciaFromPlanillaAction(id: number) {
    try {
        const ctx = await requirePermission(PERMISOS.PLANILLAS_GESTIONAR)
        const item = await prisma.correspondencia.findUnique({
            where: { id },
            include: { planilla: true },
        })
        if (!item) return fail("Correspondencia no encontrada")
        await assertAgenciaAccess(ctx, item.agenciaId, "Correspondencia", item.id)
        if (!item.planillaId || !item.planilla) return fail("La correspondencia no pertenece a ninguna planilla")
        // R-048: retirar una pieza altera la planilla; una saliente compartida solo la gestiona el alcance global.
        await assertPlanillaManage(ctx, { id: item.planilla.id, agenciaId: item.planilla.agenciaId })
        if (item.planilla.estado !== "GENERADA") {
            return fail("Solo se pueden retirar correspondencias de planillas en estado GENERADA")
        }

        const oldPlanillaId = item.planillaId

        await prisma.correspondencia.update({
            where: { id },
            data: { planillaId: null, estado: "POR_ENTREGAR", updatedBy: ctx.username },
        })

        await audit({ ctx, accion: "PLANILLA_RETIRAR_ITEM", entidad: "Planilla", entidadId: oldPlanillaId, detalle: { correspondenciaId: id } })
        revalidatePath("/planillas")
        revalidatePath(`/planillas/${oldPlanillaId}`)
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al retirar la correspondencia de la planilla")
    }
}

export async function processPlanillaAction(id: number) {
    try {
        const ctx = await requirePermission(PERMISOS.RECIBIR)
        const planilla = await loadPlanillaForManage(id)
        if (!planilla) return fail("Planilla no encontrada")
        await assertPlanillaAccess(ctx, planilla)
        if (planilla.tipo === "SALIENTE") return fail("Las planillas salientes no se procesan mediante recorridos")
        if (planilla.estado !== "CERRADA") return fail("La planilla debe estar cerrada para procesarla")

        const procesada = await prisma.planilla.updateMany({ where: { id, estado: "CERRADA" }, data: { estado: "PROCESADA" } })
        if (procesada.count === 0) return fail("La planilla cambió de estado; recargue la página")

        // Verificar si todas las planillas del recorrido están procesadas
        const recorridoPlanilla = await prisma.recorridoPlanilla.findFirst({
            where: { planillaId: id },
            include: {
                recorrido: {
                    include: {
                        planillas: { include: { planilla: true } },
                    },
                },
            },
        })

        if (recorridoPlanilla) {
            const allProcessed = recorridoPlanilla.recorrido.planillas.every(
                rp => rp.planilla.estado === "PROCESADA" || rp.planillaId === id
            )
            if (allProcessed) {
                await prisma.recorrido.update({
                    where: { id: recorridoPlanilla.recorridoId },
                    data: { estado: "TERMINADO" },
                })
            }
        }

        await audit({ ctx, accion: "PLANILLA_PROCESAR", entidad: "Planilla", entidadId: id })
        revalidatePath("/planillas")
        revalidatePath(`/planillas/${id}`)
        revalidatePath("/recorridos")
        revalidatePath("/mi-correspondencia")
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al procesar la planilla")
    }
}

export async function uploadPlanillaFirmaAction(id: number, formData: FormData) {
    try {
        const ctx = await requirePermission(PERMISOS.PLANILLAS_GESTIONAR)
        const planilla = await loadPlanillaForManage(id)
        if (!planilla) return fail("Planilla no encontrada")
        await assertPlanillaManage(ctx, planilla)
        if (planilla.tipo !== "SALIENTE") return fail("Solo las planillas salientes admiten documento de firma")

        const firmaFile = formData.get("firmaFile") as File | null
        if (!firmaFile || firmaFile.size === 0) return fail("No se seleccionó ningún archivo")

        // SEC-006/SEC-017: subida centralizada con whitelist de tipo, tamaño y magic bytes
        const saved = await saveUploadedFile(firmaFile, `planilla-firma-${id}-`)
        if ("error" in saved) return fail(saved.error)
        const documentoFirmaUrl = saved.url

        await prisma.planilla.update({
            where: { id },
            data: { documentoFirmaUrl },
        })

        await audit({ ctx, accion: "PLANILLA_FIRMA", entidad: "Planilla", entidadId: id, detalle: { archivo: saved.filename } })
        revalidatePath(`/planillas/${id}`)
        return ok({ documentoFirmaUrl })
    } catch (error) {
        return handleActionError(error, "Error al subir el documento de firma")
    }
}
