"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function generatePlanillaAction(agenciaId: number | null, tipo: "ENTRANTE" | "SALIENTE" = "ENTRANTE") {
    try {
        if (tipo === "SALIENTE") {
            // SALIENTE: no se agrupa por agencia, una sola planilla para toda la correspondencia saliente
            const existingPlanilla = await prisma.planilla.findFirst({
                where: { estado: "GENERADA", tipo: "SALIENTE" }
            })

            // Todos los items salientes sin planilla (sin importar agencia)
            const items = await prisma.correspondencia.findMany({
                where: { tipo: "SALIENTE", estado: "POR_ENTREGAR", planillaId: null }
            })

            if (items.length === 0) {
                return { error: "No hay correspondencia saliente pendiente" }
            }

            let planillaId: number

            if (existingPlanilla) {
                planillaId = existingPlanilla.id
            } else {
                const planilla = await prisma.planilla.create({
                    data: { estado: "GENERADA", tipo: "SALIENTE" }
                })
                planillaId = planilla.id
            }

            await prisma.correspondencia.updateMany({
                where: { id: { in: items.map(i => i.id) } },
                data: { planillaId }
            })

            revalidatePath("/planillas")
            return { success: true, planillaId, wasExisting: !!existingPlanilla }
        }

        // ENTRANTE: se agrupa por agencia (comportamiento original)
        const existingPlanilla = await prisma.planilla.findFirst({
            where: { agenciaId: agenciaId!, estado: "GENERADA", tipo: "ENTRANTE" }
        })

        const items = await prisma.correspondencia.findMany({
            where: { agenciaId: agenciaId!, tipo: "ENTRANTE", estado: "POR_ENTREGAR", planillaId: null }
        })

        if (items.length === 0) {
            return { error: "No hay correspondencia entrante pendiente para esta agencia" }
        }

        let planillaId: number

        if (existingPlanilla) {
            planillaId = existingPlanilla.id
        } else {
            const planilla = await prisma.planilla.create({
                data: { agenciaId: agenciaId!, estado: "GENERADA", tipo: "ENTRANTE" }
            })
            planillaId = planilla.id
        }

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
        
        // La correspondencia saliente, al cerrar la planilla, finaliza el proceso (estado = ENTREGADA)
        if (planilla.tipo === "SALIENTE") {
            await prisma.correspondencia.updateMany({
                where: { planillaId: id, tipo: "SALIENTE" },
                data: { estado: "ENTREGADA", fechaEntrega: new Date() }
            })
        }

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

        // Solo planillas entrantes pueden estar en un recorrido
        if (planilla.tipo === "ENTRANTE") {
            const recorridoActivo = planilla.recorridoPlanillas.find(
                rp => rp.recorrido.estado === "INICIADO"
            )
            if (recorridoActivo) return { error: "No se puede reabrir: está en un recorrido iniciado" }
        }

        await prisma.planilla.update({ where: { id }, data: { estado: "GENERADA" } })

        // Revertir correspondencia saliente a POR_ENTREGAR
        if (planilla.tipo === "SALIENTE") {
            await prisma.correspondencia.updateMany({
                where: { planillaId: id, tipo: "SALIENTE" },
                data: { estado: "POR_ENTREGAR", fechaEntrega: null }
            })
        }

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
        if (planilla.tipo === "SALIENTE") return { error: "Las planillas salientes no se procesan mediante recorridos" }
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

export async function uploadPlanillaFirmaAction(id: number, formData: FormData) {
    const { promises: fs } = require("fs")
    const path = require("path")

    try {
        const planilla = await prisma.planilla.findUnique({ where: { id } })
        if (!planilla) return { error: "Planilla no encontrada" }
        if (planilla.tipo !== "SALIENTE") return { error: "Solo las planillas salientes admiten documento de firma" }

        const firmaFile = formData.get("firmaFile") as File | null
        if (!firmaFile || firmaFile.size === 0) return { error: "No se seleccionó ningún archivo" }

        // Obtener configuración de empresa para la carpeta externa
        const config = await prisma.empresaConfig.findFirst()
        const uploadsDirParam = config?.uploadsDir

        let baseUploadsDir = uploadsDirParam || path.join(process.cwd(), "public", "uploads")
        if (!path.isAbsolute(baseUploadsDir)) {
            baseUploadsDir = path.resolve(process.cwd(), baseUploadsDir)
        }

        await fs.mkdir(baseUploadsDir, { recursive: true })

        const filename = `planilla-firma-${id}-${Date.now()}-${firmaFile.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`
        const filePath = path.join(baseUploadsDir, filename)

        const arrayBuffer = await firmaFile.arrayBuffer()
        await fs.writeFile(filePath, Buffer.from(arrayBuffer))

        let documentoFirmaUrl: string
        if (uploadsDirParam) {
            documentoFirmaUrl = `/api/uploads?filename=${encodeURIComponent(filename)}`
        } else {
            documentoFirmaUrl = `/uploads/${filename}`
        }

        await prisma.planilla.update({
            where: { id },
            data: { documentoFirmaUrl }
        })

        revalidatePath(`/planillas/${id}`)
        return { success: true, documentoFirmaUrl }
    } catch (error) {
        console.error(error)
        return { error: "Error al subir el documento de firma" }
    }
}
