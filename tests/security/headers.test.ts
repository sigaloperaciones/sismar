import { describe, it, expect } from 'vitest'
import nextConfig from '../../next.config'

/**
 * SEC-011 / SEC-012 (Auditoría FOSCAL) — Headers de seguridad:
 * Content-Security-Policy y Strict-Transport-Security.
 */
describe('SEC-011/012: headers de seguridad en next.config', () => {
    it('incluye Content-Security-Policy con restricción de fuentes', async () => {
        const rules = await nextConfig.headers!()
        const all = rules.flatMap(r => r.headers)
        const csp = all.find(h => h.key === 'Content-Security-Policy')
        expect(csp).toBeDefined()
        expect(csp!.value).toContain("default-src 'self'")
        expect(csp!.value).toContain("object-src 'none'")
        expect(csp!.value).toContain("frame-ancestors")
    })

    it('incluye Strict-Transport-Security con max-age de 2 años', async () => {
        const rules = await nextConfig.headers!()
        const all = rules.flatMap(r => r.headers)
        const hsts = all.find(h => h.key === 'Strict-Transport-Security')
        expect(hsts).toBeDefined()
        expect(hsts!.value).toContain('max-age=63072000')
        expect(hsts!.value).toContain('includeSubDomains')
    })

    it('conserva los headers previos (X-Frame-Options, nosniff, etc.)', async () => {
        const rules = await nextConfig.headers!()
        const all = rules.flatMap(r => r.headers)
        for (const key of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy']) {
            expect(all.find(h => h.key === key), `falta ${key}`).toBeDefined()
        }
    })
})
