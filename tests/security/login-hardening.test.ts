import { describe, it, expect, beforeEach } from 'vitest'
import * as bcrypt from 'bcryptjs'

/**
 * H-003 / C-008 (hallazgos M-04, M-08) — Login endurecido:
 * límite por IP además de por usuario, bloqueo persistente de cuenta y
 * comparación bcrypt de relleno para evitar el oráculo de tiempo.
 */
import { checkLoginRateLimits, resetRateLimit, LOGIN_IP_LIMIT, LOGIN_USER_LIMIT } from '@/lib/rate-limit'
import { afterFailedLogin, afterSuccessfulLogin, isLocked, needsRehash, BCRYPT_COST, DUMMY_BCRYPT_HASH, MAX_FAILED_LOGINS, LOCKOUT_MINUTES } from '@/lib/login-policy'
import { clientIpFromHeaders } from '@/lib/request-meta'

describe('S-017: rate limit por usuario Y por IP', () => {
    beforeEach(() => resetRateLimit())

    it('bloquea al usuario tras el máximo por usuario', () => {
        const now = 1_000_000
        for (let i = 0; i < LOGIN_USER_LIMIT.max; i++) expect(checkLoginRateLimits('admin', '10.0.0.1', now).allowed).toBe(true)
        const r = checkLoginRateLimits('admin', '10.0.0.1', now)
        expect(r.allowed).toBe(false)
        expect(r.scope).toBe('usuario')
    })

    it('credential stuffing: muchos usuarios distintos desde una IP → bloqueo por IP', () => {
        const now = 1_000_000
        for (let i = 0; i < LOGIN_IP_LIMIT.max; i++) {
            expect(checkLoginRateLimits(`user${i}`, '198.51.100.7', now).allowed).toBe(true)
        }
        const r = checkLoginRateLimits('otro', '198.51.100.7', now)
        expect(r.allowed).toBe(false)
        expect(r.scope).toBe('ip')
        // Otra IP no queda afectada
        expect(checkLoginRateLimits('otro', '198.51.100.8', now).allowed).toBe(true)
    })

    it('sin IP conocida sigue aplicando el límite por usuario', () => {
        const now = 1_000_000
        for (let i = 0; i < LOGIN_USER_LIMIT.max; i++) checkLoginRateLimits('Admin', null, now)
        expect(checkLoginRateLimits('admin', null, now).allowed).toBe(false) // misma clave normalizada
    })
})

describe('IP del cliente (X-Forwarded-For)', () => {
    it('toma el ÚLTIMO valor (el añadido por el proxy de confianza), no el primero', () => {
        const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9' })
        expect(clientIpFromHeaders(h)).toBe('203.0.113.9')
    })
    it('usa x-real-ip como alternativa y limpia IPv4-mapped', () => {
        expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '::ffff:192.0.2.1' }))).toBe('192.0.2.1')
        expect(clientIpFromHeaders(new Headers())).toBeNull()
    })
})

describe('S-017: bloqueo persistente de cuenta', () => {
    const now = new Date('2026-10-01T10:00:00Z')

    it(`bloquea tras ${MAX_FAILED_LOGINS} fallos por ${LOCKOUT_MINUTES} minutos`, () => {
        let state = { failedLoginAttempts: 0, lockedUntil: null as Date | null }
        for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) {
            state = afterFailedLogin(state, now)
            expect(isLocked(state, now)).toBe(false)
        }
        state = afterFailedLogin(state, now)
        expect(isLocked(state, now)).toBe(true)
        expect(state.lockedUntil!.getTime()).toBe(now.getTime() + LOCKOUT_MINUTES * 60_000)
        // Sigue bloqueada un minuto después; libre tras vencer
        expect(isLocked(state, new Date(now.getTime() + 60_000))).toBe(true)
        expect(isLocked(state, new Date(now.getTime() + (LOCKOUT_MINUTES + 1) * 60_000))).toBe(false)
    })

    it('un fallo tras vencer el bloqueo reinicia el contador', () => {
        const expired = { failedLoginAttempts: 10, lockedUntil: new Date(now.getTime() - 1000) }
        const next = afterFailedLogin(expired, now)
        expect(next.failedLoginAttempts).toBe(1)
        expect(next.lockedUntil).toBeNull()
    })

    it('un login correcto limpia el estado', () => {
        expect(afterSuccessfulLogin()).toEqual({ failedLoginAttempts: 0, lockedUntil: null })
    })
})

describe('S-016: oráculo de tiempo', () => {
    it('el hash de relleno es un bcrypt válido que nunca coincide (compare no lanza)', async () => {
        expect(DUMMY_BCRYPT_HASH).toMatch(/^\$2[aby]\$12\$/)
        await expect(bcrypt.compare('cualquier-cosa', DUMMY_BCRYPT_HASH)).resolves.toBe(false)
    })
    it('loginAction ejecuta bcrypt.compare aunque el usuario no exista', () => {
        // Verificación estática del flujo (el comportamiento temporal real se valida en E2E).
        const src = require('fs').readFileSync(require('path').resolve(__dirname, '../../src/app/actions/auth.ts'), 'utf-8')
        const noUser = src.indexOf('if (!user) {')
        const block = src.slice(noUser, src.indexOf('}', noUser))
        expect(block).toContain('bcrypt.compare(password, DUMMY_BCRYPT_HASH)')
        expect(src).toContain('isLocked(user, now)')
        expect(src).toContain('afterFailedLogin(user, now)')
    })
})

describe('R-032 / AC-020: hashes heredados de menor coste', () => {
    it('needsRehash detecta coste < 12 (el oráculo de tiempo invertido)', () => {
        expect(BCRYPT_COST).toBe(12)
        expect(needsRehash('$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')).toBe(true)
        expect(needsRehash('$2a$12$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')).toBe(false)
        expect(needsRehash('basura')).toBe(true)
    })
})
