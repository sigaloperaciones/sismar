"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import * as bcrypt from "bcryptjs"
import { getSession } from "@/lib/auth"
import { redirect } from "next/navigation"
import { empresaConfigSchema, createUserSchema, updateUserSchema } from "@/lib/schemas/admin"

// ── Utilidad: verificar que el usuario es ADMIN ────────────────────────────────
async function requireAdmin() {
    const session = await getSession()
    if (!session || session.role !== "ADMIN") redirect("/")
}

/** Extrae el primer mensaje de error de un resultado Zod fallido. */
function firstZodError(result: { error: { issues: Array<{ message: string }> } }): string {
    return result.error.issues[0]?.message ?? "Datos inválidos"
}

// ── EmpresaConfig ─────────────────────────────────────────────────────────────
export async function saveEmpresaConfigAction(prevState: unknown, formData: FormData) {
    await requireAdmin()
    try {
        // SEC-007: validación real con el esquema Zod compartido con el formulario
        const parsed = empresaConfigSchema.safeParse({
            nombre: formData.get("nombre"),
            nit: (formData.get("nit") as string) || undefined,
            logoUrl: (formData.get("logoUrl") as string) || undefined,
            colorPrimary: (formData.get("colorPrimary") as string) || undefined,
            colorSecondary: (formData.get("colorSecondary") as string) || undefined,
            colorAccent: (formData.get("colorAccent") as string) || undefined,
        })
        if (!parsed.success) return { error: firstZodError(parsed) }

        const { nombre, nit, logoUrl, colorPrimary, colorSecondary, colorAccent } = parsed.data

        await prisma.empresaConfig.upsert({
            where: { id: 1 },
            create: {
                id: 1,
                nombre,
                nit: nit || null,
                logoUrl: logoUrl || null,
                colorPrimary: colorPrimary || null,
                colorSecondary: colorSecondary || null,
                colorAccent: colorAccent || null,
            },
            update: {
                nombre,
                nit: nit || null,
                logoUrl: logoUrl || null,
                colorPrimary: colorPrimary || null,
                colorSecondary: colorSecondary || null,
                colorAccent: colorAccent || null,
            },
        })

        revalidatePath("/admin/config")
        revalidatePath("/", "layout") // Fuerza recarga del ThemeInjector
        return { success: true }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        return { error: "Error al guardar la configuración" }
    }
}

// ── Usuarios ──────────────────────────────────────────────────────────────────
export async function createUserAction(formData: FormData) {
    await requireAdmin()
    try {
        // SEC-007: validación real con el esquema Zod compartido con el formulario
        const parsed = createUserSchema.safeParse({
            username: formData.get("username"),
            password: formData.get("password"),
            role: formData.get("role"),
            agenciaId: (formData.get("agenciaId") as string) || undefined,
        })
        if (!parsed.success) return { error: firstZodError(parsed) }

        const { username, password, role } = parsed.data
        const agenciaIdRaw = parsed.data.agenciaId
        const agenciaId = agenciaIdRaw ? parseInt(agenciaIdRaw) : undefined

        const exists = await prisma.usuario.findUnique({ where: { username } })
        if (exists) return { error: "El nombre de usuario ya existe" }

        const passwordHash = await bcrypt.hash(password, 12)

        await prisma.usuario.create({
            data: { username, password: passwordHash, role, agenciaId: agenciaId ?? null },
        })

        revalidatePath("/admin/usuarios")
        return { success: true }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        return { error: "Error al crear el usuario" }
    }
}

export async function updateUserAction(id: number, formData: FormData) {
    await requireAdmin()
    try {
        // SEC-007: validación real con el esquema Zod compartido con el formulario
        const parsed = updateUserSchema.safeParse({
            username: formData.get("username"),
            password: (formData.get("password") as string) || "",
            role: formData.get("role"),
            agenciaId: (formData.get("agenciaId") as string) || undefined,
        })
        if (!parsed.success) return { error: firstZodError(parsed) }

        const { username, password, role } = parsed.data
        const agenciaIdRaw = parsed.data.agenciaId
        const agenciaId = agenciaIdRaw ? parseInt(agenciaIdRaw) : undefined

        const data: Record<string, unknown> = {
            username,
            role,
            agenciaId: agenciaId ?? null,
        }

        if (password && password.length > 0) {
            data.password = await bcrypt.hash(password, 12)
        }

        await prisma.usuario.update({ where: { id }, data })

        revalidatePath("/admin/usuarios")
        return { success: true }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        return { error: "Error al actualizar el usuario" }
    }
}

export async function deleteUserAction(id: number) {
    await requireAdmin()
    try {
        const session = await getSession()
        if (session?.userId === id) return { error: "No puede eliminar su propia cuenta" }

        await prisma.usuarioPermiso.deleteMany({ where: { usuarioId: id } })
        await prisma.usuario.delete({ where: { id } })

        revalidatePath("/admin/usuarios")
        return { success: true }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        return { error: "Error al eliminar el usuario" }
    }
}

// ── Matriz de Permisos ────────────────────────────────────────────────────────
interface PermissionMatrixChanges {
    roleChanges: Array<{ rol: string; permisoId: number; concedido: boolean }>
    userChanges: Array<{ usuarioId: number; permisoId: number; concedido: boolean | null }>
}

export async function savePermissionMatrixAction(changes: PermissionMatrixChanges) {
    await requireAdmin()
    try {
        // Procesar cambios de rol (upsert)
        for (const rc of changes.roleChanges) {
            await prisma.rolPermiso.upsert({
                where: { rol_permisoId: { rol: rc.rol, permisoId: rc.permisoId } },
                create: { rol: rc.rol, permisoId: rc.permisoId, concedido: rc.concedido },
                update: { concedido: rc.concedido },
            })
        }

        // Procesar cambios de usuario
        for (const uc of changes.userChanges) {
            if (uc.concedido === null) {
                // Eliminar override → hereda del rol
                await prisma.usuarioPermiso.deleteMany({
                    where: { usuarioId: uc.usuarioId, permisoId: uc.permisoId },
                })
            } else {
                // Upsert override
                await prisma.usuarioPermiso.upsert({
                    where: { usuarioId_permisoId: { usuarioId: uc.usuarioId, permisoId: uc.permisoId } },
                    create: { usuarioId: uc.usuarioId, permisoId: uc.permisoId, concedido: uc.concedido },
                    update: { concedido: uc.concedido },
                })
            }
        }

        revalidatePath("/admin/permisos")
        return { success: true }
    } catch (error) {
        console.error(error instanceof Error ? error.message : String(error))
        return { error: "Error al guardar los permisos" }
    }
}
