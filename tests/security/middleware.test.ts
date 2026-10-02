import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'

/**
 * H-003 / C-001, C-006, C-009, C-010 (A-05, A-06, M-05, M-06, B-01) — Middleware.
 */
const key = () => new TextEncoder().encode(process.env.JWT_SECRET!)

async function token(payload: Record<string, unknown>, exp = '1h') {
    return new SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(exp).sign(key())
}

function req(path: string, opts: { cookie?: string; host?: string; proto?: string } = {}) {
    const headers: Record<string, string> = {}
    if (opts.cookie) headers.cookie = `session=${opts.cookie}`
    if (opts.host) headers.host = opts.host
    if (opts.proto) headers['x-forwarded-proto'] = opts.proto
    return new NextRequest(`http://localhost:3002${path}`, { headers })
}

beforeEach(() => { process.env.ALLOWED_HOSTS = 'sismar.ejemplo.test' })
afterEach(() => { delete process.env.ALLOWED_HOSTS })

describe('middleware', () => {
    it('sin cookie → redirige a /login del host permitido y limpia la cookie con atributos seguros (B-01)', async () => {
        const { middleware } = await import('@/middleware')
        const res = await middleware(req('/planillas', { host: 'atacante.test', proto: 'https' }))
        expect(res.status).toBeGreaterThanOrEqual(300)
        expect(res.headers.get('location')).toBe('https://sismar.ejemplo.test/login')
        const c = res.cookies.get('session')
        expect(c?.value).toBe('')
        expect(c?.httpOnly).toBe(true)
        expect(c?.sameSite).toBe('lax')
        expect(c?.path).toBe('/')
        expect(new Date(c!.expires!).getTime()).toBe(0)
    })

    it('S-018: Host fuera de la allowlist nunca gobierna la redirección (M-05)', async () => {
        const { middleware } = await import('@/middleware')
        const res = await middleware(req('/login', { cookie: await token({ userId: 1, sid: 's1' }), host: 'evil.test', proto: 'https' }))
        expect(res.headers.get('location')).toBe('https://sismar.ejemplo.test/')
    })

    it('JWT expirado o mal firmado → /login', async () => {
        const { middleware } = await import('@/middleware')
        const expired = await token({ userId: 1, sid: 's1' }, '-1s')
        expect((await middleware(req('/', { cookie: expired }))).headers.get('location')).toContain('/login')
        expect((await middleware(req('/', { cookie: 'basura.jwt.x' }))).headers.get('location')).toContain('/login')
    })

    it('JWT del formato antiguo (sin sid) ya no sirve (A-05: sesión en BD)', async () => {
        const { middleware } = await import('@/middleware')
        const old = await token({ userId: 1, username: 'admin', role: 'ADMIN' })
        expect((await middleware(req('/', { cookie: old }))).headers.get('location')).toContain('/login')
    })

    it('S-019: con JWT válido continúa y añade CSP con nonce (M-06); el middleware NO re-firma la cookie', async () => {
        const { middleware } = await import('@/middleware')
        const res = await middleware(req('/planillas', { cookie: await token({ userId: 1, sid: 's1' }) }))
        expect(res.headers.get('location')).toBeNull()
        const csp = res.headers.get('Content-Security-Policy')!
        expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/)
        expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/)
        expect(res.cookies.get('session')).toBeUndefined()
    })

    it('la página de login también lleva CSP con nonce', async () => {
        const { middleware } = await import('@/middleware')
        const res = await middleware(req('/login'))
        expect(res.headers.get('Content-Security-Policy')).toContain("'nonce-")
    })

    it('S-012 (A-06): el directorio estático legado /uploads responde 404 incluso con sesión', async () => {
        const { middleware } = await import('@/middleware')
        const res = await middleware(req('/uploads/1779454295913-Document_o1.pdf', { cookie: await token({ userId: 1, sid: 's1' }) }))
        expect(res.status).toBe(404)
    })

    it('el matcher protege /uploads/*.png (ya no exime imágenes fuera de la raíz)', async () => {
        const { config } = await import('@/middleware')
        const pattern = config.matcher[0]
        // Construimos la regex equivalente al matcher de Next para comprobar rutas.
        const re = new RegExp('^' + pattern.replace(/^\/\(/, '/(').replace(/\\\\/g, '\\') + '$')
        expect(re.test('/uploads/foto.png')).toBe(true)
        expect(re.test('/planillas/3')).toBe(true)
        expect(re.test('/logo-clinica-foscal.png')).toBe(false)
        expect(re.test('/fonts/NEBULA-Regular.otf')).toBe(false) // fuente de marca pública (login sin sesión)
        expect(re.test('/favicon.ico')).toBe(false)
        expect(re.test('/_next/static/chunk.js')).toBe(false)
        expect(re.test('/api/uploads')).toBe(false)
    })
})

describe('C-001: salida de sesión inválida sin bucle de redirecciones', () => {
    it('/login?expired=1 con JWT aún válido NO rebota a "/" (la cookie ya fue borrada por /api/auth/expired)', async () => {
        const { middleware } = await import('@/middleware')
        const res = await middleware(req('/login?expired=1', { cookie: await token({ userId: 1, sid: 's1' }) }))
        expect(res.headers.get('location')).toBeNull()
        expect(res.headers.get('Content-Security-Policy')).toContain("'nonce-")
    })

    it('GET /api/auth/expired borra la cookie con atributos seguros y envía a /login?expired=1 del host permitido', async () => {
        const { GET } = await import('@/app/api/auth/expired/route')
        const res = await GET(req('/api/auth/expired', { cookie: 'x', host: 'evil.test', proto: 'https' }))
        expect(res.status).toBe(303)
        expect(res.headers.get('location')).toBe('https://sismar.ejemplo.test/login?expired=1')
        const c = res.cookies.get('session')
        expect(c?.value).toBe('')
        expect(c?.httpOnly).toBe(true)
        expect(c?.path).toBe('/')
        expect(new Date(c!.expires!).getTime()).toBe(0)
    })
})

describe('R-042(8): la ruta pública es exactamente /login', () => {
    it('/loginx y /login-admin NO son públicas', async () => {
        const { middleware } = await import('@/middleware')
        expect((await middleware(req('/loginx'))).headers.get('location')).toContain('/login')
        expect((await middleware(req('/login-admin'))).headers.get('location')).toContain('/login')
    })
})
