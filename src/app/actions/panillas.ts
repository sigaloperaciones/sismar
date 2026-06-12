"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function generatePlanillaAction(agenciaId: number) {
    try {
        // Buscar si existe planilla GENERADA para esta agencia
        const existingPlanilla = await prisma.planilla.findFirst({
            where: { agenciaId, estado: "GENERADA" }
        })

        // Items sin planilla para esta agencia
        const items = await prisma.correspondencia.findMany({
            where: { agenciaId, estado: "POR_ENTREGAR", planillaId: null }
        })

        if (items.length === 0) {
            return { error: "No hay correspondencia pendiente para esta agencia" }
        }

        let planillaId: number

        if (existingPlanilla) {
            // Agregar a planilla existente
            planillaId = existingPlanilla.id
        } else {
            // Crear nueva planilla
            const planilla = await prisma.planilla.create({
                data: { agenciaId, estado: "GENERADA" }
            })
            planillaId = planilla.id
        }

        // Asignar items a la planilla
        await prisma.correspondencia.updateMany({
            where: { id: { in: items.map(i => i.id) } },
            data: { planillaId }
        })

        revalidatePath("/planillas")
        return { success: true, planillaId, wasExisting: !!existingPlanilla }
    } catch (error) {
        console.error(error)
        return { error: "Error al generar planilla" }
    }
}

export async function closePlanillaAction(id: number) {
    try {
        const planilla = await prisma.planilla.findUnique({ where: { id } })
        if (!planilla) return { error: "Planilla no encontrada" }
        if (planilla.estado !== "GENERADA") return { error: "Solo se pueden cerrar planillas en estado GENERADA" }

        await prisma.planilla.update({ where: { id }, data: { estado: "CERRADA" } })
        
        // La correspondencia saliente también se debe poder agregar a una planilla y cuando se cierra la planilla, se termina el proceso para la correspondencia saliente (estado = ENTREGADA).
        await prisma.correspondencia.updateMany({
            where: { planillaId: id, tipo: "SALIENTE" },
            data: { estado: "ENTREGADA", fechaEntrega: new Date() }
        })

        revalidatePath("/planillas")
        revalidatePath(`/planillas/${id}`)
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Error al cerrar la planilla" }
    }
}

export async function reopenPlanillaAction(id: number) {
    try {
        const planilla = await prisma.planilla.findUnique({
            where: { id },
            include: { recorridoPlanillas: { include: { recorrido: true } } }
        })
        if (!planilla) return { error: "Planilla no encontrada" }
        if (planilla.estado !== "CERRADA") return { error: "Solo se pueden reabrir planillas en estado CERRADA" }

        // Verificar que no esté en un recorrido iniciado
        const recorridoActivo = planilla.recorridoPlanillas.find(
            rp => rp.recorrido.estado === "INICIADO"
        )
        if (recorridoActivo) return { error: "No se puede reabrir: está en un recorrido iniciado" }

        await prisma.planilla.update({ where: { id }, data: { estado: "GENERADA" } })

        // Revertir correspondencia saliente a POR_ENTREGAR
        await prisma.correspondencia.updateMany({
            where: { planillaId: id, tipo: "SALIENTE" },
            data: { estado: "POR_ENTREGAR", fechaEntrega: null }
        })

        revalidatePath("/planillas")
        revalidatePath(`/planillas/${id}`)
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Error al reabrir la planilla" }
    }
}

export async function removeCorrespondenciaFromPlanillaAction(id: number) {
    try {
        const item = await prisma.correspondencia.findUnique({
            where: { id },
            include: { planilla: true }
        })
        if (!item) return { error: "Correspondencia no encontrada" }
        if (!item.planillaId) return { error: "La correspondencia no pertenece a ninguna planilla" }
        if (item.planilla?.estado !== "GENERADA") {
            return { error: "Solo se pueden retirar correspondencias de planillas en estado GENERADA" }
        }

        const oldPlanillaId = item.planillaId

        await prisma.correspondencia.update({
            where: { id },
            data: { planillaId: null, estado: "POR_ENTREGAR" }
        })

        revalidatePath("/planillas")
        revalidatePath(`/planillas/${oldPlanillaId}`)
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Error al retirar la correspondencia de la planilla" }
    }
}

export async function processPlanillaAction(id: number) {
    try {
        const planilla = await prisma.planilla.findUnique({ where: { id } })
        if (!planilla) return { error: "Planilla no encontrada" }
        if (planilla.estado !== "CERRADA") return { error: "La planilla debe estar cerrada para procesarla" }

        await prisma.planilla.update({ where: { id }, data: { estado: "PROCESADA" } })

        // Verificar si todas las planillas del recorrido están procesadas
        const recorridoPlanilla = await prisma.recorridoPlanilla.findFirst({
            where: { planillaId: id },
            include: {
                recorrido: {
                    include: {
                        planillas: { include: { planilla: true } }
                    }
                }
            }
        })

        if (recorridoPlanilla) {
            const allProcessed = recorridoPlanilla.recorrido.planillas.every(
                rp => rp.planilla.estado === "PROCESADA" || rp.planillaId === id
            )
            if (allProcessed) {
                await prisma.recorrido.update({
                    where: { id: recorridoPlanilla.recorridoId },
                    data: { estado: "TERMINADO" }
                })
            }
        }

        revalidatePath("/planillas")
        revalidatePath(`/planillas/${id}`)
        revalidatePath("/recorridos")
        revalidatePath("/mi-correspondencia")
        return { success: true }
    } catch (error) {
        console.error(error)
        return { error: "Error al procesar la planilla" }
    }
}
