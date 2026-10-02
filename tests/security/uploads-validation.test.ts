import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

/**
 * SEC-006 / SEC-010 / SEC-017 (FOSCAL) + H-003 / C-006 (M-03, A-06):
 * whitelist de tipos, tamaño máximo, SVG bloqueado, MAGIC BYTES, directorio
 * privado y nombres generados en servidor.
 */
vi.mock('@/lib/prisma', () => ({ prisma: { empresaConfig: { findFirst: vi.fn(async () => ({ uploadsDir: null })) } } }))

const MB = 1024 * 1024

function fakeFile(name: string, type: string, size: number) {
    return { name, type, size }
}

describe('SEC-006/010: validateUploadFile (metadatos)', () => {
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

describe('S-014 (M-03): magic bytes', () => {
    const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
    const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])
    const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10])
    const HTML = new TextEncoder().encode('<html><script>alert(1)</script>')

    it('detecta el tipo real', async () => {
        const { sniffUploadType } = await import('@/lib/uploads')
        expect(sniffUploadType(PDF)).toBe('pdf')
        expect(sniffUploadType(PNG)).toBe('png')
        expect(sniffUploadType(JPG)).toBe('jpeg')
        expect(sniffUploadType(HTML)).toBeNull()
    })
    it('un "image/jpeg" cuyo contenido es HTML se rechaza (polyglot)', async () => {
        const { validateUploadContent } = await import('@/lib/uploads')
        expect(validateUploadContent('foto.jpg', HTML).ok).toBe(false)
        expect(validateUploadContent('doc.pdf', PNG).ok).toBe(false)
        expect(validateUploadContent('doc.pdf', PDF).ok).toBe(true)
        expect(validateUploadContent('foto.png', PNG).ok).toBe(true)
    })
    it('.gif ya no se sirve inline (no está en la whitelist de subida)', async () => {
        const { INLINE_CONTENT_TYPES } = await import('@/lib/uploads')
        expect(INLINE_CONTENT_TYPES['.gif']).toBeUndefined()
        expect(INLINE_CONTENT_TYPES['.svg']).toBeUndefined()
    })
})

describe('S-012 (A-06): directorio privado y nombres de servidor', () => {
    it('el directorio por defecto NO está bajo public/', async () => {
        const { defaultUploadsDir, isInsidePublicDir } = await import('@/lib/uploads')
        const cwd = path.resolve('/app')
        expect(isInsidePublicDir(defaultUploadsDir(cwd), cwd)).toBe(false)
        expect(isInsidePublicDir(path.join(cwd, 'public', 'uploads'), cwd)).toBe(true)
        expect(isInsidePublicDir(path.join(cwd, 'public'), cwd)).toBe(true)
        expect(isInsidePublicDir(path.join(cwd, 'publicidad'), cwd)).toBe(false)
    })
    it('la URL siempre va por la API y el nombre se genera en servidor', async () => {
        const { buildStoredFilename, uploadUrlFor, uploadFilenameFromUrl } = await import('@/lib/uploads')
        const name = buildStoredFilename('../../etc/passwd Mi Guía.PDF', 'planilla-firma-3-')
        expect(name).toMatch(/^planilla-firma-3-\d+-[0-9a-f-]{36}\.pdf$/)
        expect(name).not.toContain('passwd')
        expect(uploadUrlFor(name)).toBe(`/api/uploads?filename=${name}`)
        expect(uploadFilenameFromUrl(uploadUrlFor(name))).toBe(name)
        expect(uploadFilenameFromUrl('/uploads/legado.pdf')).toBe('legado.pdf')
        expect(uploadFilenameFromUrl('https://evil.test/x.pdf')).toBeNull()
    })
})

describe('saveUploadedFile (integración con disco temporal)', () => {
    let dir: string
    beforeAll(() => {
        dir = mkdtempSync(path.join(tmpdir(), 'sismar-save-'))
        process.env.UPLOADS_DIR = dir
    })
    afterAll(() => {
        delete process.env.UPLOADS_DIR
        rmSync(dir, { recursive: true, force: true })
    })

    it('rechaza un polyglot aunque MIME y extensión sean válidos', async () => {
        const { saveUploadedFile } = await import('@/lib/uploads')
        const file = new File([new TextEncoder().encode('<html>evil</html>')], 'foto.jpg', { type: 'image/jpeg' })
        const res = await saveUploadedFile(file)
        expect('error' in res && res.error).toMatch(/contenido/i)
        expect(readdirSync(dir)).toHaveLength(0)
    })

    it('guarda un PDF válido en el directorio privado con nombre generado', async () => {
        const { saveUploadedFile } = await import('@/lib/uploads')
        const file = new File([new TextEncoder().encode('%PDF-1.4\n%fake')], 'guia original.pdf', { type: 'application/pdf' })
        const res = await saveUploadedFile(file, 'g-')
        expect('url' in res).toBe(true)
        if ('url' in res) {
            expect(res.url.startsWith('/api/uploads?filename=')).toBe(true)
            expect(existsSync(path.join(dir, res.filename))).toBe(true)
            expect(res.filename).not.toContain('original')
        }
    })
})
