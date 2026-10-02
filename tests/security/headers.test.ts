import { describe, it, expect } from 'vitest'
import nextConfig from '../../next.config'

/**
 * SEC-011 / SEC-012 (FOSCAL) — Headers de seguridad.
 * H-003 / C-010: la CSP se emite desde el middleware con nonce (ver
 * tests/security/middleware.test.ts y csp-branding.test.ts); aquí se verifica
 * que next.config conserve HSTS y los básicos y NO duplique la CSP.
 */
describe('SEC-011/012: headers de seguridad en next.config', () => {
    it('incluye Strict-Transport-Security con max-age de 2 años', async () => {
        const rules = await nextConfig.headers!()
        const all = rules.flatMap(r => r.headers)
        const hsts = all.find(h => h.key === 'Strict-Transport-Security')
        expect(hsts).toBeDefined()
        expect(hsts!.value).toContain('max-age=63072000')
        expect(hsts!.value).toContain('includeSubDomains')
    })

    it('conserva los headers previos (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy)', async () => {
        const rules = await nextConfig.headers!()
        const all = rules.flatMap(r => r.headers)
        for (const key of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) {
            expect(all.find(h => h.key === key), `falta ${key}`).toBeDefined()
        }
    })

    it('no define CSP estática (la emite el middleware con nonce)', async () => {
        const rules = await nextConfig.headers!()
        const all = rules.flatMap(r => r.headers)
        expect(all.find(h => h.key === 'Content-Security-Policy')).toBeUndefined()
    })

    it('permite subidas de hasta 10 MB vía server actions', () => {
        expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe('11mb')
    })
})
