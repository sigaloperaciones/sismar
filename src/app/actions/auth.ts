"use server"

import { prisma } from "@/lib/prisma"
import { encrypt, SESSION_COOKIE_OPTIONS } from "@/lib/auth"
import { checkRateLimit } from "@/lib/rate-limit"
import * as bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function loginAction(formData: FormData) {
    const username = formData.get("username") as string
    const password = formData.get("password") as string

    if (!username || !password) {
        return { error: "Usuario y contraseña requeridos" }
    }

    // SEC-009 (Auditoría FOSCAL): protección contra fuerza bruta.
    // Máx. 5 intentos por minuto por usuario. En despliegue multi-instancia,
    // migrar a un backend compartido (Redis) — registrado en RADAR.
    const rate = checkRateLimit(`login:${username.trim().toLowerCase()}`)
    if (!rate.allowed) {
        return {
            error: `Demasiados intentos. Espere ${rate.retryAfterSeconds} segundos e intente de nuevo.`,
        }
    }

    try {
        const user = await prisma.usuario.findUnique({
            where: { username },
        })

        if (!user) {
            return { error: "Credenciales inválidas" }
        }

        const isValid = await bcrypt.compare(password, user.password)

        if (!isValid) {
            return { error: "Credenciales inválidas" }
        }

        // Create session
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const sessionPayload = {
            userId: user.id,
            username: user.username,
            role: user.role,
            agenciaId: user.agenciaId,
            expires
        }
        const session = await encrypt(sessionPayload)

        const cookieStore = await cookies()
        cookieStore.set("session", session, {
            ...SESSION_COOKIE_OPTIONS,
            expires,
        })

    } catch (error) {
        console.error("Login error:", error instanceof Error ? error.message : String(error))
        return { error: "Error en el servidor" }
    }

    redirect("/")
}

export async function logoutAction() {
    const cookieStore = await cookies()
    // SEC-008: la limpieza de la cookie usa los mismos atributos de seguridad.
    cookieStore.set("session", "", {
        ...SESSION_COOKIE_OPTIONS,
        expires: new Date(0),
    })
    redirect("/login")
}
