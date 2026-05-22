"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getSession } from "@/lib/auth"

// ── Crear / Iniciar Recorrido ─────────────────────────────────────────────────
export async function createRecorridoAction(tipo: string, notas: string) {
    try {
        const session = await getSession()

        // Verificar si existe un recorrido INICIADO
        const recorridoActivo = await prisma.recorrido.findFirst({
            where: { estado: "INICIADO" },
            include: { planillas: { include: { planilla: true } } }
        })

        // Si hay recorrido activo y ninguna planilla fue procesada → agregar planillas nuevas
        if (recorridoActivo) {
            const todasSinProcesar = recorridoActivo.planillas.every(
                rp => rp.planilla.estado !== "PROCESADA"
            )
            if (todasSinProcesar) {
                // Agregar planillas CERRADAS que no estén en el recorrido
                const planillasEnRecorrido = recorridoActivo.planillas.map(rp => rp.planillaId)
                const nuevasPlanillas = await prisma.planilla.findMany({
                    where: { estado: "CERRADA", id: { notIn: planillasEnRecorrido } }
                })
                for (const p of nuevasPlanillas) {
                    await prisma.recorridoPlanilla.create({
                        data: { recorridoId: recorridoActivo.id, planillaId: p.id }
                    })
                }
                revalidatePath("/recorridos")
                return { success: true, recorridoId: recorridoActivo.id, wasExisting: true }
            }
        }

        // Obtener planillas CERRADAS
        const planillasCerradas = await prisma.planilla.findMany({
            where: { estado: "CERRADA" }
        })

        if (planillasCerradas.length === 0) {
            return { error: "No hay planillas cerradas para iniciar un recorrido" }
        }

        // Crear nuevo recorrido
        const recorrido = await prisma.recorrido.create({
            data: {
                tipo,
                estado: "INICIADO",
                notas: notas || null,
                creadoPor: session?.username || null,
            }
        })

        // Asociar planillas CERRADAS al recorrido
        for (const p of planillasCerradas) {
            await prisma.recorridoPlanilla.create({
                data: { recorridoId: recorrido.id, planillaId: p.id }
            })
        }

        // Enviar emails a responsables de agencias
        await sendRecorridoEmails(recorrido.id)

        revalidatePath("/recorridos")
        return { success: true, recorridoId: recorrido.id, wasExisting: false }
    } catch (error) {
        console.error(error)
        return { error: "Error al crear el recorrido" }
    }
}

// ── Anular Recorrido ──────────────────────────────────────────────────────────
export async function anularRecorridoAction(id: number) {
    try {
        const recorrido = await prisma.recorrido.findUnique({
            where: { id },
            include: {
                planillas: { include: { planilla: true } }
            }
        })

        if (!recorrido) return { error: "Recorrido no encontrado" }
        if (recorrido.estado !== "INICIADO") return { error: "Solo se pueden anular recorridos iniciados" }

        // Verificar que ninguna planilla haya sido procesada
        const hayProcesadas = recorrido.planillas.some(rp => rp.planilla.estado === "PROCESADA")
        if (hayProcesadas) return { error: "No se puede anular: ya hay planillas procesadas" }

        await prisma.recorrido.update({ where: { id }, data: { estado: "ANULADO" } })

        // Las planillas vuelven a estado CERRADA (no cambia, ya estaban cerradas)
        revalidatePath("/recorridos")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Error al anular el recorrido" }
    }
}

// ── Aprobar / Devolver Correspondencia ────────────────────────────────────────
export async function aprobarCorrespondenciaAction(id: number) {
    try {
        await prisma.correspondencia.update({
            where: { id },
            data: { estado: "ENTREGADA", fechaEntrega: new Date() }
        })
        revalidatePath("/mi-correspondencia")
        revalidatePath("/recorridos")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Error al aprobar la correspondencia" }
    }
}

export async function devolverCorrespondenciaAction(id: number, observacion: string) {
    try {
        if (!observacion.trim()) return { error: "Debe ingresar una observación" }
        await prisma.correspondencia.update({
            where: { id },
            data: { estado: "DEVUELTA", observacionAgencia: observacion.trim() }
        })
        revalidatePath("/mi-correspondencia")
        revalidatePath("/recorridos")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Error al devolver la correspondencia" }
    }
}

// ── Acciones de Recorrido (compatibilidad legacy) ─────────────────────────────
export async function confirmDeliveryAction(id: number) {
    return aprobarCorrespondenciaAction(id)
}

export async function returnCorrespondenceAction(id: number, observation: string) {
    return devolverCorrespondenciaAction(id, observation)
}

// ── Helper: Enviar Emails ─────────────────────────────────────────────────────
async function sendRecorridoEmails(recorridoId: number) {
    try {
        const recorrido = await prisma.recorrido.findUnique({
            where: { id: recorridoId },
            include: {
                planillas: {
                    include: {
                        planilla: {
                            include: {
                                agencia: {
                                    include: { usuarios: true }
                                },
                                correspondencias: true
                            }
                        }
                    }
                }
            }
        })

        if (!recorrido) return

        // En producción, aquí se enviarían los emails
        // Por ahora se registra en consola con la información completa
        for (const rp of recorrido.planillas) {
            const agencia = rp.planilla.agencia
            const correspondencias = rp.planilla.correspondencias
            const emailsAgencia = agencia.usuarios
                .filter(u => u.email)
                .map(u => u.email)

            if (emailsAgencia.length > 0) {
                console.log(`[EMAIL] Para: ${emailsAgencia.join(", ")}`)
                console.log(`[EMAIL] Asunto: Recorrido iniciado - ${correspondencias.length} documento(s) para ${agencia.name}`)
                console.log(`[EMAIL] Documentos:`, correspondencias.map(c => `- ${c.remitenteNombre}: ${c.asunto}`).join("\n"))
            }
        }
    } catch (error) {
        console.error("Error enviando emails:", error)
    }
}

// ── Verificar Planillas Sin Cerrar ────────────────────────────────────────────
export async function checkPlanillasAbiertas() {
    try {
        const planillasAbiertas = await prisma.planilla.count({
            where: { estado: "GENERADA" }
        })
        const planillasCerradas = await prisma.planilla.count({
            where: { estado: "CERRADA" }
        })
        return { planillasAbiertas, planillasCerradas }
    } catch (error) {
        return { planillasAbiertas: 0, planillasCerradas: 0 }
    }
}
