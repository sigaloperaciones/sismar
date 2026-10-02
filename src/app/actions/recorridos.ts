"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requirePermission, handleActionError, ok, fail } from "@/lib/auth-guard"
import { assertAgenciaAccess, planillaWhere } from "@/lib/tenancy"
import { PERMISOS } from "@/lib/permissions-catalog"
import { audit } from "@/lib/audit"
import { sendMail } from "@/lib/notifications"

const tipoRecorridoSchema = z.enum(["AM", "PM", "EXCEPCIONAL"], { error: "Tipo de recorrido inválido" })
const notasSchema = z.string().trim().max(500, "Máximo 500 caracteres")

// ── Crear / Iniciar Recorrido ─────────────────────────────────────────────────
export async function createRecorridoAction(tipo: string, notas: string) {
    try {
        const ctx = await requirePermission(PERMISOS.RECORRIDOS_GESTIONAR)

        const tipoParsed = tipoRecorridoSchema.safeParse(tipo)
        if (!tipoParsed.success) return fail(tipoParsed.error.issues[0]?.message ?? "Tipo inválido")
        const notasParsed = notasSchema.safeParse(notas ?? "")
        if (!notasParsed.success) return fail(notasParsed.error.issues[0]?.message ?? "Notas inválidas")

        // Verificar si existe un recorrido INICIADO
        const recorridoActivo = await prisma.recorrido.findFirst({
            where: { estado: "INICIADO" },
            include: { planillas: { include: { planilla: true } } },
        })

        // Si hay recorrido activo y ninguna planilla fue procesada → agregar planillas nuevas
        if (recorridoActivo) {
            const todasSinProcesar = recorridoActivo.planillas.every(rp => rp.planilla.estado !== "PROCESADA")
            if (todasSinProcesar) {
                const planillasEnRecorrido = recorridoActivo.planillas.map(rp => rp.planillaId)
                const nuevasPlanillas = await prisma.planilla.findMany({
                    where: { estado: "CERRADA", tipo: "ENTRANTE", id: { notIn: planillasEnRecorrido } },
                })
                // SEC-018: una sola query en lugar de N inserts secuenciales
                await prisma.recorridoPlanilla.createMany({
                    data: nuevasPlanillas.map(p => ({ recorridoId: recorridoActivo.id, planillaId: p.id })),
                })
                await audit({ ctx, accion: "RECORRIDO_CREAR", entidad: "Recorrido", entidadId: recorridoActivo.id, detalle: { agregadas: nuevasPlanillas.length } })
                revalidatePath("/recorridos")
                return ok({ recorridoId: recorridoActivo.id, wasExisting: true })
            }
        }

        // Obtener planillas ENTRANTES CERRADAS
        const planillasCerradas = await prisma.planilla.findMany({
            where: { estado: "CERRADA", tipo: "ENTRANTE" },
        })

        if (planillasCerradas.length === 0) {
            return fail("No hay planillas entrantes cerradas para iniciar un recorrido")
        }

        // Crear nuevo recorrido y asociar planillas en una sola transacción (R-041).
        // El índice único parcial `Recorrido_unico_iniciado_idx` garantiza en BD que
        // no existan dos recorridos INICIADO aunque dos usuarios pulsen a la vez.
        const recorrido = await prisma.$transaction(async tx => {
            const creado = await tx.recorrido.create({
                data: {
                    tipo: tipoParsed.data,
                    estado: "INICIADO",
                    notas: notasParsed.data || null,
                    creadoPor: ctx.username,
                },
            })
            // SEC-018: una sola query en lugar de N inserts secuenciales
            await tx.recorridoPlanilla.createMany({
                data: planillasCerradas.map(p => ({ recorridoId: creado.id, planillaId: p.id })),
            })
            return creado
        })

        // Aviso a responsables de agencias
        await sendRecorridoEmails(recorrido.id)

        await audit({ ctx, accion: "RECORRIDO_CREAR", entidad: "Recorrido", entidadId: recorrido.id, detalle: { tipo: tipoParsed.data, planillas: planillasCerradas.length } })
        revalidatePath("/recorridos")
        return ok({ recorridoId: recorrido.id, wasExisting: false })
    } catch (error) {
        return handleActionError(error, "Error al crear el recorrido")
    }
}

// ── Anular Recorrido ──────────────────────────────────────────────────────────
export async function anularRecorridoAction(id: number) {
    try {
        const ctx = await requirePermission(PERMISOS.RECORRIDOS_GESTIONAR)
        const recorrido = await prisma.recorrido.findUnique({
            where: { id },
            include: {
                planillas: { include: { planilla: true } },
            },
        })

        if (!recorrido) return fail("Recorrido no encontrado")
        if (recorrido.estado !== "INICIADO") return fail("Solo se pueden anular recorridos iniciados")

        // Verificar que ninguna planilla haya sido procesada
        const hayProcesadas = recorrido.planillas.some(rp => rp.planilla.estado === "PROCESADA")
        if (hayProcesadas) return fail("No se puede anular: ya hay planillas procesadas")

        await prisma.recorrido.update({ where: { id }, data: { estado: "ANULADO" } })

        await audit({ ctx, accion: "RECORRIDO_ANULAR", entidad: "Recorrido", entidadId: id })
        // Las planillas vuelven a estado CERRADA (no cambia, ya estaban cerradas)
        revalidatePath("/recorridos")
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al anular el recorrido")
    }
}

// ── Aprobar / Devolver Correspondencia (H-003 / C-003 — hallazgo A-02) ───────
/**
 * Carga la pieza y verifica: permiso `correspondencia.recibir`, pertenencia a la
 * agencia del usuario, estado POR_ENTREGAR y que esté en una planilla CERRADA
 * dentro de un recorrido INICIADO (el flujo real de recepción).
 */
async function loadPiezaParaRecepcion(id: number) {
    const ctx = await requirePermission(PERMISOS.RECIBIR)
    const pieza = await prisma.correspondencia.findUnique({
        where: { id },
        include: {
            planilla: { include: { recorridoPlanillas: { include: { recorrido: { select: { estado: true } } } } } },
        },
    })
    if (!pieza) return { ok: false as const, error: "Correspondencia no encontrada" }
    await assertAgenciaAccess(ctx, pieza.agenciaId, "Correspondencia", pieza.id)
    if (pieza.estado !== "POR_ENTREGAR") return { ok: false as const, error: "La correspondencia ya fue gestionada" }
    if (!pieza.planilla || pieza.planilla.estado !== "CERRADA") {
        return { ok: false as const, error: "La correspondencia no está en una planilla cerrada en recorrido" }
    }
    const enRecorridoActivo = pieza.planilla.recorridoPlanillas.some(rp => rp.recorrido.estado === "INICIADO")
    if (!enRecorridoActivo) return { ok: false as const, error: "La planilla no está en un recorrido activo" }
    return { ok: true as const, ctx, pieza }
}

export async function aprobarCorrespondenciaAction(id: number) {
    try {
        const loaded = await loadPiezaParaRecepcion(id)
        if (!loaded.ok) return fail(loaded.error)
        const { ctx, pieza } = loaded

        // R-041: actualización ATÓMICA condicionada al estado (dos clics no aprueban dos veces)
        const r = await prisma.correspondencia.updateMany({
            where: { id: pieza.id, estado: "POR_ENTREGAR" },
            data: { estado: "ENTREGADA", fechaEntrega: new Date(), recibidoPor: ctx.username, updatedBy: ctx.username },
        })
        if (r.count === 0) return fail("La correspondencia ya fue gestionada")
        await audit({ ctx, accion: "CORRESPONDENCIA_APROBAR", entidad: "Correspondencia", entidadId: pieza.id })
        revalidatePath("/mi-correspondencia")
        revalidatePath("/recorridos")
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al aprobar la correspondencia")
    }
}

export async function devolverCorrespondenciaAction(id: number, observacion: string) {
    try {
        const obs = (observacion ?? "").trim().slice(0, 500)
        if (!obs) return fail("Debe ingresar una observación")

        const loaded = await loadPiezaParaRecepcion(id)
        if (!loaded.ok) return fail(loaded.error)
        const { ctx, pieza } = loaded

        // R-041: actualización ATÓMICA condicionada al estado
        const r = await prisma.correspondencia.updateMany({
            where: { id: pieza.id, estado: "POR_ENTREGAR" },
            data: { estado: "DEVUELTA", observacionAgencia: obs, updatedBy: ctx.username },
        })
        if (r.count === 0) return fail("La correspondencia ya fue gestionada")
        await audit({ ctx, accion: "CORRESPONDENCIA_DEVOLVER", entidad: "Correspondencia", entidadId: pieza.id })
        revalidatePath("/mi-correspondencia")
        revalidatePath("/recorridos")
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al devolver la correspondencia")
    }
}

// ── Acciones de Recorrido (compatibilidad legacy) ─────────────────────────────
export async function confirmDeliveryAction(id: number) {
    return aprobarCorrespondenciaAction(id)
}

export async function returnCorrespondenceAction(id: number, observation: string) {
    return devolverCorrespondenciaAction(id, observation)
}

// ── Helper: avisos a agencias (B-05: vía módulo de notificaciones) ────────────
async function sendRecorridoEmails(recorridoId: number) {
    try {
        const recorrido = await prisma.recorrido.findUnique({
            where: { id: recorridoId },
            include: {
                planillas: {
                    include: {
                        planilla: {
                            include: {
                                agencia: { include: { usuarios: { select: { email: true } } } },
                                correspondencias: { select: { remitenteNombre: true, asunto: true } },
                            },
                        },
                    },
                },
            },
        })

        if (!recorrido) return

        for (const rp of recorrido.planillas) {
            const agencia = rp.planilla.agencia
            if (!agencia) continue // Solo planillas entrantes tienen agencia
            const correspondencias = rp.planilla.correspondencias
            const destinatarios = [
                ...agencia.usuarios.map(u => u.email).filter((e): e is string => !!e),
                ...(agencia.email ? [agencia.email] : []),
            ]
            if (destinatarios.length === 0) continue

            await sendMail({
                to: Array.from(new Set(destinatarios)),
                subject: `Recorrido iniciado - ${correspondencias.length} documento(s) para ${agencia.name}`,
                body: correspondencias.map(c => `- ${c.remitenteNombre ?? "—"}: ${c.asunto}`).join("\n"),
            })
        }
    } catch (error) {
        console.error("Error enviando avisos de recorrido:", error instanceof Error ? error.message : String(error))
    }
}

// ── Verificar Planillas Sin Cerrar ────────────────────────────────────────────
export async function checkPlanillasAbiertas() {
    try {
        // R-035: permiso del módulo + conteos dentro del alcance del usuario
        const ctx = await requirePermission(PERMISOS.RECORRIDOS_VER)
        const scope = planillaWhere(ctx)
        const planillasAbiertas = await prisma.planilla.count({
            where: { AND: [scope, { estado: "GENERADA", tipo: "ENTRANTE" }] },
        })
        const planillasCerradas = await prisma.planilla.count({
            where: { AND: [scope, { estado: "CERRADA", tipo: "ENTRANTE" }] },
        })
        return { planillasAbiertas, planillasCerradas }
    } catch (error) {
        handleActionError(error, "Error al consultar planillas")
        return { planillasAbiertas: 0, planillasCerradas: 0 }
    }
}
