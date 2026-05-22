"use server"

import { prisma } from "@/lib/prisma"
import { encrypt } from "@/lib/auth"
import * as bcrypt from "bcryptjs"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export async function loginAction(formData: FormData) {
    const username = formData.get("username") as string
    const password = formData.get("password") as string

    if (!username || !password) {
        return { error: "Usuario y contraseña requeridos" }
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
            expires,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
        })

    } catch (error) {
        console.error("Login error:", error)
        return { error: "Error en el servidor" }
    }

    redirect("/")
}

export async function logoutAction() {
    const cookieStore = await cookies()
    cookieStore.set("session", "", { expires: new Date(0) })
    redirect("/login")
}
