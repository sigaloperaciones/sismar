"use server"

import * as bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { encrypt, getSessionPayload, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SESSION_COOKIE_CLEAR_OPTIONS } from "@/lib/auth"
import { checkLoginRateLimits } from "@/lib/rate-limit"
import { afterFailedLogin, afterSuccessfulLogin, anonymizeUsername, needsRehash, BCRYPT_COST, DUMMY_BCRYPT_HASH, isLocked } from "@/lib/login-policy"
import { createSession, revokeSession } from "@/lib/session-store"
import { getClientIp, getUserAgent } from "@/lib/request-meta"
import { audit } from "@/lib/audit"

const GENERIC_ERROR = "Credenciales inválidas"

/**
 * Login (SEC-009 + H-003 / C-001, C-008 — hallazgos A-05, M-04, M-08).
 *
 *  - Límite por usuario Y por IP (checkLoginRateLimits).
 *  - Si el usuario no existe se ejecuta igualmente un bcrypt.compare de relleno
 *    para que el tiempo de respuesta no revele la existencia de cuentas.
 *  - Bloqueo PERSISTENTE de cuenta tras N fallos (Usuario.lockedUntil).
 *  - Mensaje genérico en todos los casos de fallo.
 *  - Éxito: se crea una fila `Sesion` (revocable) y el JWT transporta su `sid`.
 */
export async function loginAction(formData: FormData) {
    const usernameRaw = formData.get("username")
    const passwordRaw = formData.get("password")
    const username = typeof usernameRaw === "string" ? usernameRaw.trim() : ""
    const password = typeof passwordRaw === "string" ? passwordRaw : ""

    if (!username || !password) {
        return { error: "Usuario y contraseña requeridos" }
    }
    if (username.length > 60 || password.length > 200) {
        return { error: GENERIC_ERROR }
    }

    const ip = await getClientIp()

    const rate = checkLoginRateLimits(username, ip)
    if (!rate.allowed) {
        await audit({ username: anonymizeUsername(username), accion: "LOGIN_LIMITADO", ip, detalle: { alcance: rate.scope } })
        return {
            error: `Demasiados intentos. Espere ${rate.retryAfterSeconds} segundos e intente de nuevo.`,
        }
    }

    try {
        const user = await prisma.usuario.findUnique({ where: { username } })

        if (!user) {
            // Oráculo de tiempo (M-08): mismo costo que una verificación real.
            await bcrypt.compare(password, DUMMY_BCRYPT_HASH)
            // R-042(5): el nombre tecleado puede ser una contraseña escrita en el campo
            // equivocado; se guarda un identificador derivado, no el texto en claro.
            await audit({ username: anonymizeUsername(username), accion: "LOGIN_FALLIDO", ip, detalle: { motivo: "usuario inexistente" } })
            return { error: GENERIC_ERROR }
        }

        const now = new Date()
        if (isLocked(user, now)) {
            await bcrypt.compare(password, DUMMY_BCRYPT_HASH)
            await audit({ ctx: { userId: user.id, username: user.username }, accion: "LOGIN_BLOQUEADO", ip })
            return { error: GENERIC_ERROR }
        }

        const isValid = await bcrypt.compare(password, user.password)

        if (!isValid) {
            const next = afterFailedLogin(user, now)
            await prisma.usuario.update({ where: { id: user.id }, data: next })
            await audit({
                ctx: { userId: user.id, username: user.username },
                accion: next.lockedUntil ? "LOGIN_BLOQUEADO" : "LOGIN_FALLIDO",
                ip,
                detalle: { intentosFallidos: next.failedLoginAttempts, bloqueadoHasta: next.lockedUntil?.toISOString() ?? null },
            })
            return { error: GENERIC_ERROR }
        }

        if (needsRehash(user.password)) {
            // R-032 (AC-020): hashes heredados de menor coste responden más rápido que el
            // hash de relleno y delatan qué cuentas existen → re-hash transparente a coste 12.
            await prisma.usuario.update({
                where: { id: user.id },
                data: { ...afterSuccessfulLogin(), password: await bcrypt.hash(password, BCRYPT_COST) },
            })
        } else if (user.failedLoginAttempts > 0 || user.lockedUntil) {
            await prisma.usuario.update({ where: { id: user.id }, data: afterSuccessfulLogin() })
        }

        const session = await createSession({ userId: user.id, ip, userAgent: await getUserAgent(), now })
        const token = await encrypt({
            sid: session.id,
            userId: user.id,
            username: user.username,
            role: user.role,
            agenciaId: user.agenciaId,
        })

        const cookieStore = await cookies()
        cookieStore.set(SESSION_COOKIE_NAME, token, {
            ...SESSION_COOKIE_OPTIONS,
            expires: session.expiresAt,
        })

        await audit({ ctx: { userId: user.id, username: user.username }, accion: "LOGIN_OK", ip, entidad: "Sesion", entidadId: session.id })
    } catch (error) {
        console.error("Login error:", error instanceof Error ? error.message : String(error))
        return { error: "Error en el servidor" }
    }

    redirect("/")
}

/** Logout server-side (C-001 / AC-007): revoca la sesión en BD y limpia la cookie. */
export async function logoutAction() {
    const payload = await getSessionPayload()
    if (payload?.sid) {
        try {
            await revokeSession(payload.sid)
            await audit({
                ctx: { userId: payload.userId, username: payload.username },
                accion: "LOGOUT",
                entidad: "Sesion",
                entidadId: payload.sid,
            })
        } catch (error) {
            console.error("Logout error:", error instanceof Error ? error.message : String(error))
        }
    }
    const cookieStore = await cookies()
    // SEC-008: la limpieza de la cookie usa los mismos atributos de seguridad.
    cookieStore.set(SESSION_COOKIE_NAME, "", SESSION_COOKIE_CLEAR_OPTIONS)
    redirect("/login")
}
