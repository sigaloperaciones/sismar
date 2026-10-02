import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

/**
 * SEC-004 (FOSCAL) + H-003 / C-006 (A-06) — GET /api/uploads:
 * sesión VIVA (no solo JWT), ACL por objeto, anti-traversal y cabeceras endurecidas.
 */
const state = { ctx: null as null | { userId: number; username: string; role: string; agenciaId: number | null; sid: string }, access: 'ALLOW' as 'ALLOW' | 'FORBIDDEN' | 'NOT_FOUND' }

vi.mock('@/lib/prisma', () => ({ prisma: { empresaConfig: { findFirst: vi.fn(async () => ({ uploadsDir: null })) } } }))
vi.mock('@/lib/auth-guard', () => ({ getAuthContext: async () => state.ctx }))
vi.mock('@/lib/upload-access', () => ({ resolveUploadAccess: async () => state.access }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(async () => {}) }))

import { audit } from '@/lib/audit'

let dir: string
beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'sismar-uploads-'))
    process.env.UPLOADS_DIR = dir
    writeFileSync(path.join(dir, 'doc.pdf'), Buffer.from('%PDF-1.4 test'))
})
afterAll(() => {
    delete process.env.UPLOADS_DIR
    rmSync(dir, { recursive: true, force: true })
})

function req(qs: string) {
    return new NextRequest(`http://localhost/api/uploads?${qs}`)
}

describe('GET /api/uploads', () => {
    it('sin sesión viva → 401', async () => {
        state.ctx = null
        const { GET } = await import('@/app/api/uploads/route')
        expect((await GET(req('filename=doc.pdf'))).status).toBe(401)
    })

    it('S-013: con sesión pero sin derecho sobre el objeto → 403 y bitácora ARCHIVO_DENEGADO', async () => {
        state.ctx = { userId: 3, username: 'gerencia', role: 'AGENCIA', agenciaId: 1, sid: 's' }
        state.access = 'FORBIDDEN'
        const { GET } = await import('@/app/api/uploads/route')
        expect((await GET(req('filename=doc.pdf'))).status).toBe(403)
        expect(vi.mocked(audit)).toHaveBeenCalledWith(expect.objectContaining({ accion: 'ARCHIVO_DENEGADO' }))
    })

    it('archivo no referenciado → 404 (no se sirven huérfanos)', async () => {
        state.ctx = { userId: 1, username: 'admin', role: 'ADMIN', agenciaId: null, sid: 's' }
        state.access = 'NOT_FOUND'
        const { GET } = await import('@/app/api/uploads/route')
        expect((await GET(req('filename=doc.pdf'))).status).toBe(404)
    })

    it('path traversal o caracteres no permitidos → 400', async () => {
        state.ctx = { userId: 1, username: 'admin', role: 'ADMIN', agenciaId: null, sid: 's' }
        state.access = 'ALLOW'
        const { GET } = await import('@/app/api/uploads/route')
        expect((await GET(req('filename=..%2F..%2F.env'))).status).toBe(400)
        expect((await GET(req('filename=a%20b.pdf'))).status).toBe(400)
    })

    it('con derecho → 200 inline con nosniff, CSP sin ejecución y sin caché compartida', async () => {
        state.ctx = { userId: 1, username: 'admin', role: 'ADMIN', agenciaId: null, sid: 's' }
        state.access = 'ALLOW'
        const { GET } = await import('@/app/api/uploads/route')
        const res = await GET(req('filename=doc.pdf'))
        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('application/pdf')
        expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
        expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
        // Sin `sandbox`: rompería el visor de PDF de Chrome embebido (req. cliente #4)
        expect(res.headers.get('Content-Security-Policy')).not.toContain('sandbox')
        expect(res.headers.get('Cache-Control')).toContain('no-store')
        expect(res.headers.get('Content-Disposition')).toContain('inline')
    })

    it('tipo fuera de la whitelist se fuerza como descarga', async () => {
        writeFileSync(path.join(dir, 'raro.svg'), '<svg onload="alert(1)"/>')
        state.ctx = { userId: 1, username: 'admin', role: 'ADMIN', agenciaId: null, sid: 's' }
        state.access = 'ALLOW'
        const { GET } = await import('@/app/api/uploads/route')
        const res = await GET(req('filename=raro.svg'))
        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toBe('application/octet-stream')
        expect(res.headers.get('Content-Disposition')).toContain('attachment')
    })
})
