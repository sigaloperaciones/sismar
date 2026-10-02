import { describe, it, expect, vi } from 'vitest'
import nextConfig from '../../next.config'
import { buildCsp, generateNonce, UPLOADS_RESPONSE_CSP } from '@/lib/csp'
import { HSL_REGEX, isValidHsl, sanitizeHsl, isSafeLogoUrl } from '@/lib/branding'
import { empresaConfigSchema } from '@/lib/schemas/admin'

/**
 * H-003 / C-010 (hallazgo M-06) — CSP con nonce y colores de marca validados.
 */
describe('S-019: CSP con nonce', () => {
    it('script-src usa nonce + strict-dynamic y NO unsafe-inline', () => {
        const nonce = generateNonce()
        const csp = buildCsp(nonce, { dev: false })
        const scriptSrc = csp.split(';').map(s => s.trim()).find(s => s.startsWith('script-src'))!
        expect(scriptSrc).toContain(`'nonce-${nonce}'`)
        expect(scriptSrc).toContain("'strict-dynamic'")
        expect(scriptSrc).not.toContain("'unsafe-inline'")
        expect(scriptSrc).not.toContain("'unsafe-eval'")
        expect(csp).toContain("object-src 'none'")
        expect(csp).toContain("frame-ancestors 'self'")
        expect(csp).toContain('upgrade-insecure-requests')
    })
    it('en desarrollo añade unsafe-eval (requisito de Next dev) y nada más', () => {
        const csp = buildCsp('abc', { dev: true })
        expect(csp).toContain("'unsafe-eval'")
        expect(csp).not.toContain('upgrade-insecure-requests')
    })
    it('el nonce es aleatorio y suficientemente largo', () => {
        const a = generateNonce(), b = generateNonce()
        expect(a).not.toBe(b)
        expect(a.length).toBeGreaterThanOrEqual(22)
    })
    it('next.config ya NO define CSP (evita doble política) pero conserva HSTS y básicos', async () => {
        const rules = await nextConfig.headers!()
        const all = rules.flatMap(r => r.headers)
        expect(all.find(h => h.key === 'Content-Security-Policy')).toBeUndefined()
        expect(all.find(h => h.key === 'Strict-Transport-Security')?.value).toContain('max-age=63072000')
        for (const key of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy']) {
            expect(all.find(h => h.key === key), `falta ${key}`).toBeDefined()
        }
    })
    it('la CSP de archivos servidos no permite cargar ni ejecutar nada y solo se embebe desde la app', () => {
        expect(UPLOADS_RESPONSE_CSP).toContain("default-src 'none'")
        expect(UPLOADS_RESPONSE_CSP).toContain("frame-ancestors 'self'")
    })
})

describe('S-020: colores de marca (HSL) y logo', () => {
    it('acepta el formato HSL de Tailwind', () => {
        for (const v of ['221.2 83.2% 53.3%', '210 40% 96.1%', '0 0% 100%']) expect(isValidHsl(v)).toBe(true)
    })
    it('rechaza intentos de XSS y basura', () => {
        for (const v of ['}</style><script>alert(1)</script>', '221.2 83.2% 53.3%; } body{display:none', 'red', '#fff', 'hsl(1 2% 3%)', '', null, 12]) {
            expect(isValidHsl(v)).toBe(false)
            expect(sanitizeHsl(v)).toBeNull()
        }
        expect(HSL_REGEX.test('1 2% 3%\n</style>')).toBe(false)
    })
    it('empresaConfigSchema rechaza un color malicioso y acepta vacío', () => {
        const bad = empresaConfigSchema.safeParse({ nombre: 'Empresa', colorPrimary: '}</style><script>alert(1)</script>' })
        expect(bad.success).toBe(false)
        const ok = empresaConfigSchema.safeParse({ nombre: 'Empresa', colorPrimary: '221.2 83.2% 53.3%', colorSecondary: '' })
        expect(ok.success).toBe(true)
    })
    it('logo: ruta relativa o https; nunca javascript:/data:', () => {
        expect(isSafeLogoUrl('/api/uploads?filename=logo.png')).toBe(true)
        expect(isSafeLogoUrl('https://cdn.ejemplo.test/logo.png')).toBe(true)
        expect(isSafeLogoUrl('javascript:alert(1)')).toBe(false)
        expect(isSafeLogoUrl('data:image/svg+xml;base64,PHN2Zz4=')).toBe(false)
        expect(isSafeLogoUrl('//evil.test/x.png')).toBe(false)
        expect(isSafeLogoUrl('/\\evil.test/x.png')).toBe(false) // R-042: barra invertida
        expect(empresaConfigSchema.safeParse({ nombre: 'E', logoUrl: 'javascript:alert(1)' }).success).toBe(false)
    })
})

describe('ThemeInjector re-valida antes de inyectar (defensa en profundidad)', () => {
    it('un valor malicioso en BD no llega al <style>', async () => {
        vi.doMock('@/lib/prisma', () => ({
            prisma: { empresaConfig: { findFirst: async () => ({ colorPrimary: '}</style><script>alert(1)</script>', colorSecondary: '210 40% 96.1%', colorAccent: null }) } },
        }))
        const { ThemeInjector } = await import('@/components/ThemeInjector')
        const el = (await ThemeInjector()) as { props: { dangerouslySetInnerHTML: { __html: string } } } | null
        expect(el).not.toBeNull()
        const css = el!.props.dangerouslySetInnerHTML.__html
        expect(css).not.toContain('<script>')
        expect(css).not.toContain('--primary')
        expect(css).toContain('--secondary: 210 40% 96.1%;')
        vi.doUnmock('@/lib/prisma')
    })
})
