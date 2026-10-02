import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { cookies } from 'next/headers'
import {
    SESSION_COOKIE_NAME,
    SESSION_COOKIE_OPTIONS,
    SESSION_COOKIE_CLEAR_OPTIONS,
    SESSION_TTL_MS,
} from './session-cookie'

export { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SESSION_COOKIE_CLEAR_OPTIONS, SESSION_TTL_MS }

const secretKey = process.env.JWT_SECRET
if (!secretKey) throw new Error('La variable de entorno JWT_SECRET no está definida')
// R-052: el secreto debe ser realmente aleatorio y largo (mínimo 32 caracteres; recomendado
// `openssl rand -hex 64`). Un secreto corto haría viable forjar tokens por fuerza bruta.
if (secretKey.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres (recomendado: openssl rand -hex 64)')
const key = new TextEncoder().encode(secretKey)

/**
 * Payload del JWT de sesión (SEC-013 tipado; H-003 / C-001 rediseño).
 *
 * El JWT solo IDENTIFICA la sesión (`sid`) y al usuario (`userId`). `username`,
 * `role` y `agenciaId` viajan únicamente como pista para la UI; la autorización
 * NUNCA debe basarse en ellos: `requireSession()` (auth-guard) los relee de la
 * base de datos en cada petición y verifica que la sesión no esté revocada.
 */
export interface SessionPayload {
    sid: string
    userId: number
    username: string
    role: string
    agenciaId?: number | null
    [claim: string]: unknown
}

export async function encrypt(payload: SessionPayload) {
    return await new SignJWT(payload as JWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor((Date.now() + SESSION_TTL_MS) / 1000))
        .sign(key)
}

export async function decrypt(input: string): Promise<SessionPayload> {
    const { payload } = await jwtVerify(input, key, {
        algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
}

/**
 * Decodifica el JWT de la cookie SIN consultar la base de datos.
 * Úsalo solo para obtener el `sid` (p. ej. en logout). Para autorizar,
 * usa `requireSession()` / `getAuthContext()` de `auth-guard`.
 */
export async function getSessionPayload(): Promise<SessionPayload | null> {
    const session = (await cookies()).get(SESSION_COOKIE_NAME)?.value
    if (!session) return null
    try {
        return await decrypt(session)
    } catch {
        return null
    }
}

/** @deprecated Alias de compatibilidad; prefiere `getAuthContext()` de auth-guard. */
export const getSession = getSessionPayload

/** Borra la cookie de sesión con los mismos atributos de seguridad (SEC-008). */
export async function clearSessionCookie() {
    (await cookies()).set(SESSION_COOKIE_NAME, '', SESSION_COOKIE_CLEAR_OPTIONS)
}

/** @deprecated Alias de compatibilidad. */
export const logout = clearSessionCookie
