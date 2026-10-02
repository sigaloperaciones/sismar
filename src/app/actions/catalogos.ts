"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdmin, handleActionError, ok, fail } from "@/lib/auth-guard"
import { centroCostoSchema, sedeSchema } from "@/lib/schemas/parametrizacion"
import { nextCentroCostoCode } from "@/lib/parametrizacion"
import { audit } from "@/lib/audit"

/**
 * Catálogos maestros (H-003 / C-005 — hallazgo A-04).
 *
 * TODAS las acciones exigen `requireAdmin()` (rol leído de BD). Antes, ciudades,
 * empresas de mensajería y agencias solo exigían sesión: el layout /admin
 * ocultaba la UI pero las server actions eran invocables por cualquier usuario.
 */

function firstZodError(result: { error: { issues: Array<{ message: string }> } }): string {
    return result.error.issues[0]?.message ?? "Datos inválidos"
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── Ciudades ──────────────────────────────────────────────────────────────────
export async function createCiudadAction(prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const codigo = (formData.get("codigo") as string)?.trim().toUpperCase()
        const nombre = (formData.get("nombre") as string)?.trim()
        const departamento = (formData.get("departamento") as string)?.trim()

        if (!codigo || !nombre || !departamento) return fail("Todos los campos son obligatorios")
        if (codigo.length < 5 || codigo.length > 7) return fail("El código debe tener entre 5 y 7 caracteres")
        if (nombre.length > 100 || departamento.length > 100) return fail("Máximo 100 caracteres")

        const exists = await prisma.ciudad.findUnique({ where: { codigo } })
        if (exists) return fail("Ya existe una ciudad con ese código")

        const created = await prisma.ciudad.create({ data: { codigo, nombre, departamento } })
        await audit({ ctx, accion: "CATALOGO_CREAR", entidad: "Ciudad", entidadId: created.id })
        revalidatePath("/admin/ciudades")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al crear la ciudad")
    }
}

export async function updateCiudadAction(id: number, prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const codigo = (formData.get("codigo") as string)?.trim().toUpperCase()
        const nombre = (formData.get("nombre") as string)?.trim()
        const departamento = (formData.get("departamento") as string)?.trim()

        if (!codigo || !nombre || !departamento) return fail("Todos los campos son obligatorios")
        if (codigo.length < 5 || codigo.length > 7) return fail("El código debe tener entre 5 y 7 caracteres")
        if (nombre.length > 100 || departamento.length > 100) return fail("Máximo 100 caracteres")

        const exists = await prisma.ciudad.findFirst({ where: { codigo, NOT: { id } } })
        if (exists) return fail("Ya existe otra ciudad con ese código")

        await prisma.ciudad.update({ where: { id }, data: { codigo, nombre, departamento } })
        await audit({ ctx, accion: "CATALOGO_EDITAR", entidad: "Ciudad", entidadId: id })
        revalidatePath("/admin/ciudades")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al actualizar la ciudad")
    }
}

export async function deleteCiudadAction(id: number) {
    try {
        const ctx = await requireAdmin()
        await prisma.ciudad.delete({ where: { id } })
        await audit({ ctx, accion: "CATALOGO_ELIMINAR", entidad: "Ciudad", entidadId: id })
        revalidatePath("/admin/ciudades")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al eliminar la ciudad")
    }
}

// ── Empresas Mensajería ───────────────────────────────────────────────────────
export async function createEmpresaMensajeriaAction(prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const nombre = (formData.get("nombre") as string)?.trim()
        const nombreMensajero = (formData.get("nombreMensajero") as string)?.trim() || null
        const rutasPersonalizadas = formData.get("rutasPersonalizadas") === "true"

        if (!nombre) return fail("El nombre es obligatorio")
        if (nombre.length > 120 || (nombreMensajero && nombreMensajero.length > 120)) return fail("Máximo 120 caracteres")

        const exists = await prisma.empresaMensajeria.findUnique({ where: { nombre } })
        if (exists) return fail("Ya existe una empresa con ese nombre")

        const created = await prisma.empresaMensajeria.create({ data: { nombre, activo: true, nombreMensajero, rutasPersonalizadas } })
        await audit({ ctx, accion: "CATALOGO_CREAR", entidad: "EmpresaMensajeria", entidadId: created.id })
        revalidatePath("/admin/empresas-mensajeria")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al crear la empresa")
    }
}

export async function updateEmpresaMensajeriaAction(id: number, prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const nombre = (formData.get("nombre") as string)?.trim()
        const activo = formData.get("activo") === "true"
        const nombreMensajero = (formData.get("nombreMensajero") as string)?.trim() || null
        const rutasPersonalizadas = formData.get("rutasPersonalizadas") === "true"

        if (!nombre) return fail("El nombre es obligatorio")
        if (nombre.length > 120 || (nombreMensajero && nombreMensajero.length > 120)) return fail("Máximo 120 caracteres")

        const exists = await prisma.empresaMensajeria.findFirst({ where: { nombre, NOT: { id } } })
        if (exists) return fail("Ya existe otra empresa con ese nombre")

        await prisma.empresaMensajeria.update({ where: { id }, data: { nombre, activo, nombreMensajero, rutasPersonalizadas } })
        await audit({ ctx, accion: "CATALOGO_EDITAR", entidad: "EmpresaMensajeria", entidadId: id })
        revalidatePath("/admin/empresas-mensajeria")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al actualizar la empresa")
    }
}

export async function deleteEmpresaMensajeriaAction(id: number) {
    try {
        const ctx = await requireAdmin()
        await prisma.empresaMensajeria.delete({ where: { id } })
        await audit({ ctx, accion: "CATALOGO_ELIMINAR", entidad: "EmpresaMensajeria", entidadId: id })
        revalidatePath("/admin/empresas-mensajeria")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al eliminar la empresa")
    }
}

// ── Agencias ──────────────────────────────────────────────────────────────────
export async function createAgenciaAction(prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const name = (formData.get("name") as string)?.trim()
        const sedeId = parseInt(formData.get("sedeId") as string)
        const centroCostoId = parseInt(formData.get("centroCostoId") as string)
        const email = (formData.get("email") as string)?.trim() || null

        if (!name || !sedeId || !centroCostoId) return fail("Nombre, Sede y Centro de Costo son obligatorios")
        if (name.length > 120) return fail("Máximo 120 caracteres")
        if (email && (!EMAIL_RE.test(email) || email.length > 120)) return fail("Correo electrónico inválido")

        const created = await prisma.agencia.create({ data: { name, sedeId, centroCostoId, email } })
        await audit({ ctx, accion: "CATALOGO_CREAR", entidad: "Agencia", entidadId: created.id })
        revalidatePath("/admin/agencias")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al crear la agencia")
    }
}

export async function updateAgenciaAction(id: number, prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const name = (formData.get("name") as string)?.trim()
        const sedeId = parseInt(formData.get("sedeId") as string)
        const centroCostoId = parseInt(formData.get("centroCostoId") as string)
        const email = (formData.get("email") as string)?.trim() || null

        if (!name || !sedeId || !centroCostoId) return fail("Nombre, Sede y Centro de Costo son obligatorios")
        if (name.length > 120) return fail("Máximo 120 caracteres")
        if (email && (!EMAIL_RE.test(email) || email.length > 120)) return fail("Correo electrónico inválido")

        await prisma.agencia.update({ where: { id }, data: { name, sedeId, centroCostoId, email } })
        await audit({ ctx, accion: "CATALOGO_EDITAR", entidad: "Agencia", entidadId: id })
        revalidatePath("/admin/agencias")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al actualizar la agencia")
    }
}

export async function deleteAgenciaAction(id: number) {
    try {
        const ctx = await requireAdmin()
        const hasUsers = await prisma.usuario.count({ where: { agenciaId: id } })
        if (hasUsers > 0) return fail("No se puede eliminar: tiene usuarios asociados")

        const hasCor = await prisma.correspondencia.count({ where: { agenciaId: id } })
        if (hasCor > 0) return fail("No se puede eliminar: tiene correspondencia asociada")

        await prisma.agencia.delete({ where: { id } })
        await audit({ ctx, accion: "CATALOGO_ELIMINAR", entidad: "Agencia", entidadId: id })
        revalidatePath("/admin/agencias")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al eliminar la agencia")
    }
}

// ── Centros de Costo (parametrización — comentarios del cliente jul/2026) ──────
export async function createCentroCostoAction(prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const parsed = centroCostoSchema.safeParse({ name: formData.get("name") })
        if (!parsed.success) return fail(firstZodError(parsed))

        // Código correlativo automático (001, 002, 003…)
        const existentes = await prisma.centroCosto.findMany({ select: { code: true } })
        const code = nextCentroCostoCode(existentes.map(c => c.code))

        const created = await prisma.centroCosto.create({ data: { code, name: parsed.data.name } })
        await audit({ ctx, accion: "CATALOGO_CREAR", entidad: "CentroCosto", entidadId: created.id })
        revalidatePath("/admin/centros-costo")
        revalidatePath("/admin/agencias")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al crear el centro de costo")
    }
}

export async function updateCentroCostoAction(id: number, prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const parsed = centroCostoSchema.safeParse({ name: formData.get("name") })
        if (!parsed.success) return fail(firstZodError(parsed))

        await prisma.centroCosto.update({ where: { id }, data: { name: parsed.data.name } })
        await audit({ ctx, accion: "CATALOGO_EDITAR", entidad: "CentroCosto", entidadId: id })
        revalidatePath("/admin/centros-costo")
        revalidatePath("/admin/agencias")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al actualizar el centro de costo")
    }
}

export async function deleteCentroCostoAction(id: number) {
    try {
        const ctx = await requireAdmin()
        const enUso = await prisma.agencia.count({ where: { centroCostoId: id } })
        if (enUso > 0) {
            return fail(`No se puede eliminar: hay ${enUso} agencia(s) usando este centro de costo.`)
        }
        await prisma.centroCosto.delete({ where: { id } })
        await audit({ ctx, accion: "CATALOGO_ELIMINAR", entidad: "CentroCosto", entidadId: id })
        revalidatePath("/admin/centros-costo")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al eliminar el centro de costo")
    }
}

// ── Sedes (parametrización) ────────────────────────────────────────────────────
export async function createSedeAction(prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const parsed = sedeSchema.safeParse({
            name: formData.get("name"),
            address: (formData.get("address") as string) || "",
        })
        if (!parsed.success) return fail(firstZodError(parsed))

        const created = await prisma.sede.create({
            data: { name: parsed.data.name, address: parsed.data.address || null },
        })
        await audit({ ctx, accion: "CATALOGO_CREAR", entidad: "Sede", entidadId: created.id })
        revalidatePath("/admin/sedes")
        revalidatePath("/admin/agencias")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al crear la sede")
    }
}

export async function updateSedeAction(id: number, prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const parsed = sedeSchema.safeParse({
            name: formData.get("name"),
            address: (formData.get("address") as string) || "",
        })
        if (!parsed.success) return fail(firstZodError(parsed))

        await prisma.sede.update({
            where: { id },
            data: { name: parsed.data.name, address: parsed.data.address || null },
        })
        await audit({ ctx, accion: "CATALOGO_EDITAR", entidad: "Sede", entidadId: id })
        revalidatePath("/admin/sedes")
        revalidatePath("/admin/agencias")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al actualizar la sede")
    }
}

export async function deleteSedeAction(id: number) {
    try {
        const ctx = await requireAdmin()
        const enUso = await prisma.agencia.count({ where: { sedeId: id } })
        if (enUso > 0) {
            return fail(`No se puede eliminar: hay ${enUso} agencia(s) usando esta sede.`)
        }
        await prisma.sede.delete({ where: { id } })
        await audit({ ctx, accion: "CATALOGO_ELIMINAR", entidad: "Sede", entidadId: id })
        revalidatePath("/admin/sedes")
        return ok()
    } catch (e) {
        return handleActionError(e, "Error al eliminar la sede")
    }
}
