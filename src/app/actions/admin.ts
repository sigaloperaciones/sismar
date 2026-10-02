"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import * as bcrypt from "bcryptjs"
import type { Role } from "@prisma/client"
import { requireAdmin, handleActionError, ok, fail } from "@/lib/auth-guard"
import { empresaConfigSchema, createUserSchema, updateUserSchema } from "@/lib/schemas/admin"
import { revokeAllSessions } from "@/lib/session-store"
import { audit } from "@/lib/audit"

/**
 * Administración (usuarios, permisos, configuración).
 *
 * H-003 / C-005: se usa el `requireAdmin()` ÚNICO de `lib/auth-guard` (antes
 * había una copia local basada en el rol del JWT; ahora el rol se lee de BD).
 * H-003 / C-001: al cambiar rol, agencia o contraseña de un usuario se revocan
 * TODAS sus sesiones; al eliminarlo, la FK en cascada las elimina.
 */

/** Extrae el primer mensaje de error de un resultado Zod fallido. */
function firstZodError(result: { error: { issues: Array<{ message: string }> } }): string {
    return result.error.issues[0]?.message ?? "Datos inválidos"
}

// ── EmpresaConfig ─────────────────────────────────────────────────────────────
export async function saveEmpresaConfigAction(prevState: unknown, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        // SEC-007 + C-010: validación real (incluye formato HSL de los colores y URL segura del logo)
        const parsed = empresaConfigSchema.safeParse({
            nombre: formData.get("nombre"),
            nit: (formData.get("nit") as string) || "",
            logoUrl: (formData.get("logoUrl") as string) || "",
            colorPrimary: (formData.get("colorPrimary") as string) || "",
            colorSecondary: (formData.get("colorSecondary") as string) || "",
            colorAccent: (formData.get("colorAccent") as string) || "",
        })
        if (!parsed.success) return fail(firstZodError(parsed))

        const { nombre, nit, logoUrl, colorPrimary, colorSecondary, colorAccent } = parsed.data
        const values = {
            nombre,
            nit: nit || null,
            logoUrl: logoUrl || null,
            colorPrimary: colorPrimary || null,
            colorSecondary: colorSecondary || null,
            colorAccent: colorAccent || null,
        }

        await prisma.empresaConfig.upsert({
            where: { id: 1 },
            create: { id: 1, ...values },
            update: values,
        })

        await audit({ ctx, accion: "CONFIG_EDITAR", entidad: "EmpresaConfig", entidadId: 1 })
        revalidatePath("/admin/config")
        revalidatePath("/", "layout") // Fuerza recarga del ThemeInjector
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al guardar la configuración")
    }
}

// ── Usuarios ──────────────────────────────────────────────────────────────────
export async function createUserAction(formData: FormData) {
    try {
        const ctx = await requireAdmin()
        // SEC-007 + C-015: validación real (email válido; AGENCIA exige agencia)
        const parsed = createUserSchema.safeParse({
            username: formData.get("username"),
            email: (formData.get("email") as string) || "",
            password: formData.get("password"),
            role: formData.get("role"),
            agenciaId: (formData.get("agenciaId") as string) || undefined,
        })
        if (!parsed.success) return fail(firstZodError(parsed))

        const { username, password, role, email } = parsed.data
        const agenciaId = role === "AGENCIA" && parsed.data.agenciaId ? parseInt(parsed.data.agenciaId) : null
        if (role === "AGENCIA" && (agenciaId === null || isNaN(agenciaId))) {
            return fail("Un usuario con rol AGENCIA debe tener una agencia asignada")
        }
        if (agenciaId !== null) {
            const agencia = await prisma.agencia.findUnique({ where: { id: agenciaId }, select: { id: true } })
            if (!agencia) return fail("La agencia seleccionada no existe")
        }

        const exists = await prisma.usuario.findUnique({ where: { username } })
        if (exists) return fail("El nombre de usuario ya existe")

        const passwordHash = await bcrypt.hash(password, 12)

        const created = await prisma.usuario.create({
            data: { username, email: email || null, password: passwordHash, role: role as Role, agenciaId },
        })

        await audit({ ctx, accion: "USUARIO_CREAR", entidad: "Usuario", entidadId: created.id, detalle: { role, agenciaId } })
        revalidatePath("/admin/usuarios")
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al crear el usuario")
    }
}

export async function updateUserAction(id: number, formData: FormData) {
    try {
        const ctx = await requireAdmin()
        const parsed = updateUserSchema.safeParse({
            username: formData.get("username"),
            email: (formData.get("email") as string) || "",
            password: (formData.get("password") as string) || "",
            role: formData.get("role"),
            agenciaId: (formData.get("agenciaId") as string) || undefined,
        })
        if (!parsed.success) return fail(firstZodError(parsed))

        const { username, password, role, email } = parsed.data
        const agenciaId = role === "AGENCIA" && parsed.data.agenciaId ? parseInt(parsed.data.agenciaId) : null
        if (role === "AGENCIA" && (agenciaId === null || isNaN(agenciaId))) {
            return fail("Un usuario con rol AGENCIA debe tener una agencia asignada")
        }
        if (agenciaId !== null) {
            const agencia = await prisma.agencia.findUnique({ where: { id: agenciaId }, select: { id: true } })
            if (!agencia) return fail("La agencia seleccionada no existe")
        }

        const current = await prisma.usuario.findUnique({ where: { id } })
        if (!current) return fail("Usuario no encontrado")

        if (username !== current.username) {
            const taken = await prisma.usuario.findUnique({ where: { username } })
            if (taken) return fail("El nombre de usuario ya existe")
        }

        const data: {
            username: string
            email: string | null
            role: Role
            agenciaId: number | null
            password?: string
            failedLoginAttempts?: number
            lockedUntil?: null
        } = {
            username,
            email: email || null,
            role: role as Role,
            agenciaId,
        }

        const passwordChanged = !!password && password.length > 0
        if (passwordChanged) {
            data.password = await bcrypt.hash(password, 12)
            // Un cambio de contraseña por el administrador también desbloquea la cuenta.
            data.failedLoginAttempts = 0
            data.lockedUntil = null
        }

        await prisma.usuario.update({ where: { id }, data })

        // C-001 / AC-006: privilegios o credenciales cambiados → sesiones revocadas.
        const privilegesChanged = current.role !== role || current.agenciaId !== agenciaId
        let revocadas = 0
        if (privilegesChanged || passwordChanged) {
            revocadas = await revokeAllSessions(id)
        }

        await audit({
            ctx,
            accion: "USUARIO_EDITAR",
            entidad: "Usuario",
            entidadId: id,
            detalle: { role, agenciaId, passwordChanged, privilegesChanged, sesionesRevocadas: revocadas },
        })
        revalidatePath("/admin/usuarios")
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al actualizar el usuario")
    }
}

export async function deleteUserAction(id: number) {
    try {
        const ctx = await requireAdmin()
        if (ctx.userId === id) return fail("No puede eliminar su propia cuenta")

        const target = await prisma.usuario.findUnique({ where: { id }, select: { id: true, username: true } })
        if (!target) return fail("Usuario no encontrado")

        // Las sesiones se eliminan por FK en cascada; la bitácora conserva las filas (SetNull).
        await prisma.usuarioPermiso.deleteMany({ where: { usuarioId: id } })
        await prisma.usuario.delete({ where: { id } })

        await audit({ ctx, accion: "USUARIO_ELIMINAR", entidad: "Usuario", entidadId: id, detalle: { username: target.username } })
        revalidatePath("/admin/usuarios")
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al eliminar el usuario")
    }
}

// ── Matriz de Permisos ────────────────────────────────────────────────────────
interface PermissionMatrixChanges {
    roleChanges: Array<{ rol: string; permisoId: number; concedido: boolean }>
    userChanges: Array<{ usuarioId: number; permisoId: number; concedido: boolean | null }>
}

const ROLES: readonly string[] = ["ADMIN", "MENSAJERO", "AGENCIA"]

export async function savePermissionMatrixAction(changes: PermissionMatrixChanges) {
    try {
        const ctx = await requireAdmin()

        const roleChanges = (changes?.roleChanges ?? []).filter(
            rc => ROLES.includes(rc.rol) && Number.isInteger(rc.permisoId) && typeof rc.concedido === "boolean"
        )
        const userChanges = (changes?.userChanges ?? []).filter(
            uc => Number.isInteger(uc.usuarioId) && Number.isInteger(uc.permisoId) && (uc.concedido === null || typeof uc.concedido === "boolean")
        )

        // Procesar cambios de rol (upsert)
        for (const rc of roleChanges) {
            const rol = rc.rol as Role
            await prisma.rolPermiso.upsert({
                where: { rol_permisoId: { rol, permisoId: rc.permisoId } },
                create: { rol, permisoId: rc.permisoId, concedido: rc.concedido },
                update: { concedido: rc.concedido },
            })
        }

        // Procesar cambios de usuario
        for (const uc of userChanges) {
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

        await audit({ ctx, accion: "PERMISOS_EDITAR", entidad: "Permisos", detalle: { roles: roleChanges.length, usuarios: userChanges.length } })
        revalidatePath("/admin/permisos")
        return ok()
    } catch (error) {
        return handleActionError(error, "Error al guardar los permisos")
    }
}
