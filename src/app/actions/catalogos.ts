"use server"

import { requireSession, requireAdmin } from "@/lib/auth-guard"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { centroCostoSchema, sedeSchema } from "@/lib/schemas/parametrizacion"
import { nextCentroCostoCode } from "@/lib/parametrizacion"

function firstZodError(result: { error: { issues: Array<{ message: string }> } }): string {
    return result.error.issues[0]?.message ?? "Datos inválidos"
}

// ── Ciudades ──────────────────────────────────────────────────────────────────
export async function createCiudadAction(prevState: unknown, formData: FormData) {
    await requireSession()
    try {
        const codigo = (formData.get("codigo") as string)?.trim().toUpperCase()
        const nombre = (formData.get("nombre") as string)?.trim()
        const departamento = (formData.get("departamento") as string)?.trim()

        if (!codigo || !nombre || !departamento) return { error: "Todos los campos son obligatorios" }
        if (codigo.length < 5 || codigo.length > 7) return { error: "El código debe tener entre 5 y 7 caracteres" }

        const exists = await prisma.ciudad.findUnique({ where: { codigo } })
        if (exists) return { error: "Ya existe una ciudad con ese código" }

        await prisma.ciudad.create({ data: { codigo, nombre, departamento } })
        revalidatePath("/admin/ciudades")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al crear la ciudad" }
    }
}

export async function updateCiudadAction(id: number, prevState: unknown, formData: FormData) {
    await requireSession()
    try {
        const codigo = (formData.get("codigo") as string)?.trim().toUpperCase()
        const nombre = (formData.get("nombre") as string)?.trim()
        const departamento = (formData.get("departamento") as string)?.trim()

        if (!codigo || !nombre || !departamento) return { error: "Todos los campos son obligatorios" }
        if (codigo.length < 5 || codigo.length > 7) return { error: "El código debe tener entre 5 y 7 caracteres" }

        const exists = await prisma.ciudad.findFirst({ where: { codigo, NOT: { id } } })
        if (exists) return { error: "Ya existe otra ciudad con ese código" }

        await prisma.ciudad.update({ where: { id }, data: { codigo, nombre, departamento } })
        revalidatePath("/admin/ciudades")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al actualizar la ciudad" }
    }
}

export async function deleteCiudadAction(id: number) {
    await requireSession()
    try {
        await prisma.ciudad.delete({ where: { id } })
        revalidatePath("/admin/ciudades")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al eliminar la ciudad" }
    }
}

// ── Empresas Mensajería ───────────────────────────────────────────────────────
export async function createEmpresaMensajeriaAction(prevState: unknown, formData: FormData) {
    await requireSession()
    try {
        const nombre = (formData.get("nombre") as string)?.trim()
        const nombreMensajero = (formData.get("nombreMensajero") as string)?.trim() || null
        const rutasPersonalizadas = formData.get("rutasPersonalizadas") === "true"

        if (!nombre) return { error: "El nombre es obligatorio" }

        const exists = await prisma.empresaMensajeria.findUnique({ where: { nombre } })
        if (exists) return { error: "Ya existe una empresa con ese nombre" }

        await prisma.empresaMensajeria.create({ data: { nombre, activo: true, nombreMensajero, rutasPersonalizadas } })
        revalidatePath("/admin/empresas-mensajeria")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al crear la empresa" }
    }
}

export async function updateEmpresaMensajeriaAction(id: number, prevState: unknown, formData: FormData) {
    await requireSession()
    try {
        const nombre = (formData.get("nombre") as string)?.trim()
        const activo = formData.get("activo") === "true"
        const nombreMensajero = (formData.get("nombreMensajero") as string)?.trim() || null
        const rutasPersonalizadas = formData.get("rutasPersonalizadas") === "true"

        if (!nombre) return { error: "El nombre es obligatorio" }

        const exists = await prisma.empresaMensajeria.findFirst({ where: { nombre, NOT: { id } } })
        if (exists) return { error: "Ya existe otra empresa con ese nombre" }

        await prisma.empresaMensajeria.update({ where: { id }, data: { nombre, activo, nombreMensajero, rutasPersonalizadas } })
        revalidatePath("/admin/empresas-mensajeria")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al actualizar la empresa" }
    }
}

export async function deleteEmpresaMensajeriaAction(id: number) {
    await requireSession()
    try {
        await prisma.empresaMensajeria.delete({ where: { id } })
        revalidatePath("/admin/empresas-mensajeria")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al eliminar la empresa" }
    }
}

// ── Agencias ──────────────────────────────────────────────────────────────────
export async function createAgenciaAction(prevState: unknown, formData: FormData) {
    await requireSession()
    try {
        const name = (formData.get("name") as string)?.trim()
        const sedeId = parseInt(formData.get("sedeId") as string)
        const centroCostoId = parseInt(formData.get("centroCostoId") as string)
        const email = (formData.get("email") as string)?.trim() || null

        if (!name || !sedeId || !centroCostoId) return { error: "Nombre, Sede y Centro de Costo son obligatorios" }

        await prisma.agencia.create({ data: { name, sedeId, centroCostoId, email } })
        revalidatePath("/admin/agencias")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al crear la agencia" }
    }
}

export async function updateAgenciaAction(id: number, prevState: unknown, formData: FormData) {
    await requireSession()
    try {
        const name = (formData.get("name") as string)?.trim()
        const sedeId = parseInt(formData.get("sedeId") as string)
        const centroCostoId = parseInt(formData.get("centroCostoId") as string)
        const email = (formData.get("email") as string)?.trim() || null

        if (!name || !sedeId || !centroCostoId) return { error: "Nombre, Sede y Centro de Costo son obligatorios" }

        await prisma.agencia.update({ where: { id }, data: { name, sedeId, centroCostoId, email } })
        revalidatePath("/admin/agencias")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al actualizar la agencia" }
    }
}

export async function deleteAgenciaAction(id: number) {
    await requireSession()
    try {
        const hasUsers = await prisma.usuario.count({ where: { agenciaId: id } })
        if (hasUsers > 0) return { error: "No se puede eliminar: tiene usuarios asociados" }

        const hasCor = await prisma.correspondencia.count({ where: { agenciaId: id } })
        if (hasCor > 0) return { error: "No se puede eliminar: tiene correspondencia asociada" }

        await prisma.agencia.delete({ where: { id } })
        revalidatePath("/admin/agencias")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al eliminar la agencia" }
    }
}

// ── Centros de Costo (parametrización — comentarios del cliente jul/2026) ──────
export async function createCentroCostoAction(prevState: unknown, formData: FormData) {
    await requireAdmin()
    try {
        const parsed = centroCostoSchema.safeParse({ name: formData.get("name") })
        if (!parsed.success) return { error: firstZodError(parsed) }

        // Código correlativo automático (001, 002, 003…)
        const existentes = await prisma.centroCosto.findMany({ select: { code: true } })
        const code = nextCentroCostoCode(existentes.map(c => c.code))

        await prisma.centroCosto.create({ data: { code, name: parsed.data.name } })
        revalidatePath("/admin/centros-costo")
        revalidatePath("/admin/agencias")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al crear el centro de costo" }
    }
}

export async function updateCentroCostoAction(id: number, prevState: unknown, formData: FormData) {
    await requireAdmin()
    try {
        const parsed = centroCostoSchema.safeParse({ name: formData.get("name") })
        if (!parsed.success) return { error: firstZodError(parsed) }

        await prisma.centroCosto.update({ where: { id }, data: { name: parsed.data.name } })
        revalidatePath("/admin/centros-costo")
        revalidatePath("/admin/agencias")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al actualizar el centro de costo" }
    }
}

export async function deleteCentroCostoAction(id: number) {
    await requireAdmin()
    try {
        const enUso = await prisma.agencia.count({ where: { centroCostoId: id } })
        if (enUso > 0) {
            return { error: `No se puede eliminar: hay ${enUso} agencia(s) usando este centro de costo.` }
        }
        await prisma.centroCosto.delete({ where: { id } })
        revalidatePath("/admin/centros-costo")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al eliminar el centro de costo" }
    }
}

// ── Sedes (parametrización) ────────────────────────────────────────────────────
export async function createSedeAction(prevState: unknown, formData: FormData) {
    await requireAdmin()
    try {
        const parsed = sedeSchema.safeParse({
            name: formData.get("name"),
            address: (formData.get("address") as string) || "",
        })
        if (!parsed.success) return { error: firstZodError(parsed) }

        await prisma.sede.create({
            data: { name: parsed.data.name, address: parsed.data.address || null },
        })
        revalidatePath("/admin/sedes")
        revalidatePath("/admin/agencias")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al crear la sede" }
    }
}

export async function updateSedeAction(id: number, prevState: unknown, formData: FormData) {
    await requireAdmin()
    try {
        const parsed = sedeSchema.safeParse({
            name: formData.get("name"),
            address: (formData.get("address") as string) || "",
        })
        if (!parsed.success) return { error: firstZodError(parsed) }

        await prisma.sede.update({
            where: { id },
            data: { name: parsed.data.name, address: parsed.data.address || null },
        })
        revalidatePath("/admin/sedes")
        revalidatePath("/admin/agencias")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al actualizar la sede" }
    }
}

export async function deleteSedeAction(id: number) {
    await requireAdmin()
    try {
        const enUso = await prisma.agencia.count({ where: { sedeId: id } })
        if (enUso > 0) {
            return { error: `No se puede eliminar: hay ${enUso} agencia(s) usando esta sede.` }
        }
        await prisma.sede.delete({ where: { id } })
        revalidatePath("/admin/sedes")
        return { success: true }
    } catch (e) {
        console.error(e instanceof Error ? e.message : String(e))
        return { error: "Error al eliminar la sede" }
    }
}
