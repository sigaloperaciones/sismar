import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * SEC-005 (Auditoría FOSCAL) — bcryptjs y cookie deben estar en dependencies.
 * En devDependencies no se instalan con `npm ci --omit=dev` → crash en producción.
 */
describe('SEC-005: dependencias de runtime en "dependencies"', () => {
    const pkg = JSON.parse(
        readFileSync(path.resolve(__dirname, '../../package.json'), 'utf-8')
    )

    it('bcryptjs está en dependencies', () => {
        expect(pkg.dependencies.bcryptjs).toBeDefined()
        expect(pkg.devDependencies?.bcryptjs).toBeUndefined()
    })

    it('cookie está en dependencies', () => {
        expect(pkg.dependencies.cookie).toBeDefined()
        expect(pkg.devDependencies?.cookie).toBeUndefined()
    })

    it('@types/bcryptjs permanece en devDependencies', () => {
        expect(pkg.devDependencies['@types/bcryptjs']).toBeDefined()
    })
})
