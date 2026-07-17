import { describe, it, expect, vi } from 'vitest'

/**
 * SEC-006 / SEC-010 / SEC-017 (Auditoría FOSCAL) — Validación central de uploads.
 * Whitelist de tipos (PDF/PNG/JPG), tamaño máximo 10 MB, y SVG bloqueado (XSS).
 */

// validateUploadFile es una función pura; evitamos cargar el cliente Prisma real
// (que importa @/lib/uploads → ./prisma) y su init en frío, causa de flakiness.
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

const MB = 1024 * 1024

function fakeFile(name: string, type: string, size: number) {
    return { name, type, size }
}

describe('SEC-006/010: validateUploadFile', () => {
    it('acepta PDF, PNG y JPG dentro del límite', async () => {
        const { validateUploadFile } = await import('@/lib/uploads')
        expect(validateUploadFile(fakeFile('doc.pdf', 'application/pdf', 1 * MB)).ok).toBe(true)
        expect(validateUploadFile(fakeFile('foto.png', 'image/png', 2 * MB)).ok).toBe(true)
        expect(validateUploadFile(fakeFile('guia.jpg', 'image/jpeg', 3 * MB)).ok).toBe(true)
        expect(validateUploadFile(fakeFile('guia.jpeg', 'image/jpeg', 3 * MB)).ok).toBe(true)
    })

    it('rechaza archivos de más de 10 MB (DoS)', async () => {
        const { validateUploadFile } = await import('@/lib/uploads')
        expect(validateUploadFile(fakeFile('grande.pdf', 'application/pdf', 11 * MB)).ok).toBe(false)
    })

    it('rechaza SVG (XSS almacenado — SEC-010)', async () => {
        const { validateUploadFile } = await import('@/lib/uploads')
        expect(validateUploadFile(fakeFile('logo.svg', 'image/svg+xml', 1024)).ok).toBe(false)
    })

    it('rechaza ejecutables y tipos fuera de whitelist', async () => {
        const { validateUploadFile } = await import('@/lib/uploads')
        expect(validateUploadFile(fakeFile('virus.exe', 'application/x-msdownload', 1024)).ok).toBe(false)
        expect(validateUploadFile(fakeFile('pagina.html', 'text/html', 1024)).ok).toBe(false)
    })

    it('rechaza extensión que no corresponde al MIME declarado', async () => {
        const { validateUploadFile } = await import('@/lib/uploads')
        expect(validateUploadFile(fakeFile('doc.exe', 'application/pdf', 1024)).ok).toBe(false)
    })
})
