import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import path from 'path'

/**
 * SEC-005 (FOSCAL) — dependencias de runtime en "dependencies".
 * H-003 / C-016 (B-08) — `cookie` no se usa: eliminada. `panillas.ts` renombrado.
 */
describe('SEC-005 / B-08: dependencias y saneamiento', () => {
    const root = path.resolve(__dirname, '../..')
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf-8'))

    it('bcryptjs está en dependencies (runtime)', () => {
        expect(pkg.dependencies.bcryptjs).toBeDefined()
        expect(pkg.devDependencies?.bcryptjs).toBeUndefined()
    })

    it('la dependencia `cookie` fue eliminada (no se importa en ningún sitio)', () => {
        expect(pkg.dependencies.cookie).toBeUndefined()
        expect(pkg.devDependencies?.cookie).toBeUndefined()
    })

    it('@types/bcryptjs permanece en devDependencies', () => {
        expect(pkg.devDependencies['@types/bcryptjs']).toBeDefined()
    })

    it('el módulo de planillas se llama planillas.ts (no panillas.ts)', () => {
        expect(existsSync(path.join(root, 'src/app/actions/planillas.ts'))).toBe(true)
        expect(existsSync(path.join(root, 'src/app/actions/panillas.ts'))).toBe(false)
    })
})
