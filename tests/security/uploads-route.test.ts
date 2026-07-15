import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * SEC-004 (Auditoría FOSCAL) — API de uploads sin autenticación.
 * GET /api/uploads debe responder 401 sin sesión válida (el middleware
 * excluye /api, así que la protección debe ser explícita en la ruta).
 */

vi.mock('@/lib/prisma', () => ({
    prisma: {
        empresaConfig: {
            findFirst: vi.fn(async () => ({ uploadsDir: 'C:/no/existe' })),
        },
    },
}))

function makeRequest(url: string, sessionToken?: string) {
    return new NextRequest(url, {
        headers: sessionToken ? { cookie: `session=${sessionToken}` } : {},
    })
}

describe('SEC-004: GET /api/uploads exige sesión', () => {
    it('sin cookie de sesión → 401', async () => {
        const { GET } = await import('@/app/api/uploads/route')
        const res = await GET(makeRequest('http://localhost/api/uploads?filename=doc.pdf'))
        expect(res.status).toBe(401)
    })

    it('con JWT inválido → 401', async () => {
        const { GET } = await import('@/app/api/uploads/route')
        const res = await GET(
            makeRequest('http://localhost/api/uploads?filename=doc.pdf', 'jwt-falso')
        )
        expect(res.status).toBe(401)
    })

    it('con sesión válida → NO 401 (404 porque el archivo no existe)', async () => {
        const { encrypt } = await import('@/lib/auth')
        const token = await encrypt({ userId: 1, username: 'admin', role: 'ADMIN' })
        const { GET } = await import('@/app/api/uploads/route')
        const res = await GET(
            makeRequest('http://localhost/api/uploads?filename=doc.pdf', token)
        )
        expect(res.status).not.toBe(401)
        expect(res.status).toBe(404)
    })
})
