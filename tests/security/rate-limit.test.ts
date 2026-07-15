import { describe, it, expect, beforeEach } from 'vitest'

/**
 * SEC-009 (Auditoría FOSCAL) — Rate limiting en login.
 * Máximo 5 intentos por ventana de 60s por clave (usuario).
 */
describe('SEC-009: checkRateLimit', () => {
    beforeEach(async () => {
        const { resetRateLimit } = await import('@/lib/rate-limit')
        resetRateLimit()
    })

    it('permite hasta 5 intentos en la ventana', async () => {
        const { checkRateLimit } = await import('@/lib/rate-limit')
        for (let i = 1; i <= 5; i++) {
            expect(checkRateLimit('login:admin').allowed).toBe(true)
        }
    })

    it('bloquea el sexto intento e informa el tiempo de espera', async () => {
        const { checkRateLimit } = await import('@/lib/rate-limit')
        for (let i = 1; i <= 5; i++) checkRateLimit('login:admin')
        const sixth = checkRateLimit('login:admin')
        expect(sixth.allowed).toBe(false)
        expect(sixth.retryAfterSeconds).toBeGreaterThan(0)
    })

    it('las claves son independientes (otro usuario no queda bloqueado)', async () => {
        const { checkRateLimit } = await import('@/lib/rate-limit')
        for (let i = 1; i <= 6; i++) checkRateLimit('login:admin')
        expect(checkRateLimit('login:otro').allowed).toBe(true)
    })

    it('la ventana expira y vuelve a permitir intentos', async () => {
        const { checkRateLimit } = await import('@/lib/rate-limit')
        const now = 1_000_000
        for (let i = 1; i <= 6; i++) checkRateLimit('login:admin', 5, 60_000, now)
        expect(checkRateLimit('login:admin', 5, 60_000, now + 61_000).allowed).toBe(true)
    })
})
