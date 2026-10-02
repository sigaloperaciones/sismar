import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE_NAME, SESSION_COOKIE_CLEAR_OPTIONS } from '@/lib/session-cookie'
import { resolveOrigin } from '@/lib/request-origin'
import { buildCsp, generateNonce } from '@/lib/csp'

/**
 * Middleware (runtime Edge). Responsabilidades, y SOLO estas:
 *  1. Puerta rápida: sin cookie o con JWT inválido/expirado → /login.
 *     La autorización REAL (sesión viva en BD, rol/agencia frescos, permisos,
 *     tenencia) ocurre en servidor: layouts, páginas, acciones y API.
 *     (H-003 / C-001: ya NO se re-firma el token ni se renueva la expiración.)
 *  2. Redirecciones solo a orígenes de la allowlist (C-009 — M-05).
 *  3. CSP con nonce por petición para páginas (C-010 — M-06).
 *  4. Bloqueo del directorio estático legado /uploads (C-006 — A-06).
 */

const PUBLIC_PATHS = ['/login']

function getKey() {
    const secret = process.env.JWT_SECRET
    if (!secret || secret.length < 32) throw new Error('JWT_SECRET no está definida o es demasiado corta (mínimo 32 caracteres)')
    return new TextEncoder().encode(secret)
}

function redirectTo(request: NextRequest, pathname: string) {
    const origin = resolveOrigin({
        hostHeader: request.headers.get('host'),
        forwardedProto: request.headers.get('x-forwarded-proto'),
        fallbackHost: request.nextUrl.host,
        fallbackProto: request.nextUrl.protocol,
        allowedHosts: process.env.ALLOWED_HOSTS,
    })
    return NextResponse.redirect(`${origin}${pathname}`)
}

async function verifyToken(token: string | undefined): Promise<boolean> {
    if (!token) return false
    try {
        const { payload } = await jwtVerify(token, getKey(), { algorithms: ['HS256'] })
        return typeof payload?.userId === 'number' && typeof payload?.sid === 'string'
    } catch {
        return false
    }
}

function withCsp(request: NextRequest): NextResponse {
    const nonce = generateNonce()
    const csp = buildCsp(nonce, { dev: process.env.NODE_ENV !== 'production' })

    // Next lee `x-nonce` para marcar sus scripts inline; la CSP de la petición
    // le indica además que debe aplicar el nonce.
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('content-security-policy', csp)

    const response = NextResponse.next({ request: { headers: requestHeaders } })
    response.headers.set('Content-Security-Policy', csp)
    return response
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // A-06: el directorio público legado de uploads queda deshabilitado. Los
    // archivos se sirven únicamente por /api/uploads (sesión + ACL por objeto).
    if (pathname.startsWith('/uploads/')) {
        return new NextResponse('Not Found', { status: 404 })
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
    // R-042(8): comparación exacta (no por prefijo) para no abrir rutas como /loginx.
    const isPublic = PUBLIC_PATHS.includes(pathname)
    const valid = await verifyToken(token)

    if (isPublic) {
        // Con JWT válido se envía al inicio, SALVO que venga de una sesión que el
        // servidor acaba de invalidar (?expired=1): la cookie ya fue borrada por
        // /api/auth/expired; si el navegador la conservara, evitamos el bucle.
        const fromExpired = request.nextUrl.searchParams.get('expired') === '1'
        if (valid && !fromExpired) return redirectTo(request, '/')
        return withCsp(request)
    }

    if (!valid) {
        const response = redirectTo(request, '/login')
        // B-01: la limpieza usa los MISMOS atributos (httpOnly, sameSite, secure, path).
        response.cookies.set({ name: SESSION_COOKIE_NAME, value: '', ...SESSION_COOKIE_CLEAR_OPTIONS })
        return response
    }

    return withCsp(request)
}

export const config = {
    matcher: [
        // Protege todo salvo /api (se protege explícitamente en cada ruta), los
        // chunks de Next y los assets estáticos de la RAÍZ de public/ (logo,
        // favicon, iconos). NOTA: `/uploads/...` ya NO está exento (A-06).
        // `fonts/` también queda exento: la fuente de marca (NEBULA) debe cargar en /login sin sesión.
        '/((?!api|_next/static|_next/image|fonts/|favicon\\.ico|[^/]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
}
