import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * H-003 / C-012 (hallazgo M-02) — Seed no destructivo y sin credenciales conocidas.
 * Verificación estática del script (su ejecución se valida en el smoke local).
 */
const seed = readFileSync(path.resolve(__dirname, '../../prisma/seed.ts'), 'utf-8')

describe('S-022: prisma/seed.ts', () => {
    it('no contiene la contraseña conocida ni ninguna contraseña literal', () => {
        expect(seed).not.toMatch(/["'`]123456["'`]/)
        expect(seed).not.toMatch(/bcrypt\.hash\(\s*["'`]/)
    })
    it('no borra datos (sin deleteMany)', () => {
        expect(seed).not.toMatch(/deleteMany/)
    })
    it('solo crea usuarios si la tabla está vacía', () => {
        expect(seed).toMatch(/usuario\.count\(\)/)
        expect(seed).toMatch(/userCount > 0/)
    })
    it('se bloquea en producción salvo bandera explícita', () => {
        expect(seed).toContain("process.env.NODE_ENV === 'production'")
        expect(seed).toContain('SEED_ALLOW_PRODUCTION')
    })
    it('usa el catálogo único de permisos (sincronización idempotente)', () => {
        expect(seed).toContain('syncPermissions(prisma)')
    })
    it('las contraseñas vienen del entorno o se generan con generateStrongPassword', () => {
        expect(seed).toContain('generateStrongPassword(16)')
        expect(seed).toContain('SEED_ADMIN_PASSWORD')
    })
    it('R-039: una SEED_*_PASSWORD que no cumple la política ABORTA (no genera otra en silencio)', () => {
        expect(seed).toMatch(/cumple la política/)
        expect(seed).toMatch(/process\.exit\(3\)/)
    })
})
