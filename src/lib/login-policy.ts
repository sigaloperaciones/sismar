import { createHmac } from 'crypto'

/**
 * Política de bloqueo de cuenta (H-003 / C-008 — hallazgo M-08). Funciones puras.
 *
 * Tras MAX_FAILED_LOGINS fallos consecutivos la cuenta queda bloqueada
 * LOCKOUT_MINUTES; el estado se persiste en `Usuario` para sobrevivir reinicios
 * y múltiples instancias. Un login correcto reinicia el contador.
 */
export const MAX_FAILED_LOGINS = 10
export const LOCKOUT_MINUTES = 15

export interface LockState {
    failedLoginAttempts: number
    lockedUntil: Date | null
}

export function isLocked(state: LockState, now: Date = new Date()): boolean {
    return !!state.lockedUntil && state.lockedUntil.getTime() > now.getTime()
}

/** Estado resultante tras un fallo de contraseña. */
export function afterFailedLogin(state: LockState, now: Date = new Date()): LockState {
    // Si el bloqueo anterior ya venció, el contador empieza de nuevo.
    const base = state.lockedUntil && state.lockedUntil.getTime() <= now.getTime() ? 0 : state.failedLoginAttempts
    const attempts = base + 1
    if (attempts >= MAX_FAILED_LOGINS) {
        return {
            failedLoginAttempts: attempts,
            lockedUntil: new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000),
        }
    }
    return { failedLoginAttempts: attempts, lockedUntil: null }
}

/** Estado tras un login correcto. */
export function afterSuccessfulLogin(): LockState {
    return { failedLoginAttempts: 0, lockedUntil: null }
}

/** Coste bcrypt vigente para TODAS las contraseñas (alta, rotación y re-hash). */
export const BCRYPT_COST = 12

/**
 * R-032 (AC-020): un hash heredado de menor coste (el seed anterior usaba 10)
 * responde unas 4 veces más rápido que el hash de relleno y delata qué cuentas
 * existen. Tras un login correcto se re-hashea de forma transparente.
 */
export function needsRehash(hash: string): boolean {
    const m = /^\$2[aby]\$(\d{2})\$/.exec(hash)
    if (!m) return true
    return parseInt(m[1], 10) < BCRYPT_COST
}

/**
 * R-042(5): en un login fallido el "usuario" tecleado puede ser una contraseña
 * escrita en el campo equivocado. La bitácora guarda un identificador derivado
 * (correlacionable entre intentos, no legible), nunca el texto en claro.
 * Guardian (re-verificación): HMAC con un secreto del servidor, no un hash sin
 * sal, para que no pueda recuperarse por diccionario desde la propia bitácora.
 */
export function anonymizeUsername(username: string, secret: string | undefined = process.env.JWT_SECRET): string {
    const key = secret && secret.length >= 16 ? `audit:${secret}` : 'audit:sin-secreto-configurado'
    const digest = createHmac('sha256', key).update(username.trim().toLowerCase()).digest('hex').slice(0, 16)
    return `usuario#${digest}`
}

/**
 * Hash bcrypt de relleno para igualar el tiempo de respuesta cuando el usuario
 * no existe (oráculo de tiempo). Es el hash (coste 12) de una cadena aleatoria
 * descartada; no corresponde a ninguna contraseña válida.
 */
export const DUMMY_BCRYPT_HASH = '$2b$12$CXjRAzmIH8ANppG6PsMcPuVjoBMbsCd1o2T3cyH3T1QyVLYsSLCYO'
