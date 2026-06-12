import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

const PUBLIC_PATHS = ['/login']

function getKey() {
    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET no está definida')
    return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl
    const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

    const sessionCookie = request.cookies.get('session')?.value

    // Rutas públicas: si ya tiene sesión válida, redirigir al dashboard
    if (isPublic) {
        if (sessionCookie) {
            try {
                const key = getKey()
                const { payload } = await jwtVerify(sessionCookie, key, { algorithms: ['HS256'] })
                if (payload?.userId) {
                    return NextResponse.redirect(new URL('/', request.url))
                }
            } catch {
                // Token inválido — dejar acceder al login
            }
        }
        return NextResponse.next()
    }

    // Rutas protegidas: sin sesión → redirigir al login
    if (!sessionCookie) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    try {
        const key = getKey()
        const { payload } = await jwtVerify(sessionCookie, key, { algorithms: ['HS256'] })

        if (!payload?.userId) {
            return NextResponse.redirect(new URL('/login', request.url))
        }

        // Renovar sesión (rolling expiration)
        const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const newPayload = { ...payload, expires: newExpires }
        const newToken = await new SignJWT(newPayload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('24h')
            .sign(key)

        const response = NextResponse.next()
        response.cookies.set({
            name: 'session',
            value: newToken,
            httpOnly: true,
            expires: newExpires,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
        })
        return response
    } catch {
        // Token inválido o expirado
        const response = NextResponse.redirect(new URL('/login', request.url))
        response.cookies.set('session', '', { expires: new Date(0) })
        return response
    }
}

export const config = {
    matcher: [
        // Proteger todas las rutas excepto assets estáticos
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
