import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const secretKey = process.env.JWT_SECRET
if (!secretKey) throw new Error('La variable de entorno JWT_SECRET no está definida')
const key = new TextEncoder().encode(secretKey)

/**
 * Payload tipado de la sesión (SEC-013 — Auditoría FOSCAL).
 * Evita `any` en las funciones críticas de autenticación.
 */
export interface SessionPayload {
    userId: number
    username: string
    role: string
    agenciaId?: number | null
    expires?: Date | string
    [claim: string]: unknown
}

/**
 * Atributos de seguridad únicos para TODA operación sobre la cookie de sesión
 * (SEC-008 — Auditoría FOSCAL): set en login, refresh en updateSession y clear en logout.
 */
export const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
}

export async function encrypt(payload: SessionPayload) {
    return await new SignJWT(payload as JWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(key)
}

export async function decrypt(input: string): Promise<SessionPayload> {
    const { payload } = await jwtVerify(input, key, {
        algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
}

export async function getSession(): Promise<SessionPayload | null> {
    const session = (await cookies()).get('session')?.value
    if (!session) return null
    try {
        return await decrypt(session)
    } catch (error) {
        return null
    }
}

export async function logout() {
    (await cookies()).set('session', '', {
        ...SESSION_COOKIE_OPTIONS,
        expires: new Date(0),
    })
}

export async function updateSession(request: NextRequest) {
    const session = request.cookies.get('session')?.value
    if (!session) return

    // Refresca la sesión para que no expire mientras el usuario está activo
    const parsed = await decrypt(session)
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    parsed.expires = expires
    const res = NextResponse.next()
    res.cookies.set({
        name: 'session',
        value: await encrypt(parsed),
        ...SESSION_COOKIE_OPTIONS,
        expires,
    })
    return res
}
