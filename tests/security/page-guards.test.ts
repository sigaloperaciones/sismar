import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

/**
 * H-003 / C-007 — Guardian R-028 (AC-016).
 *
 * Los layouts de Next NO son una frontera de seguridad: una petición RSC puede
 * declarar en `Next-Router-State-Tree` que los segmentos `(dashboard)` y `admin`
 * ya están renderizados y el servidor ejecuta solo la página. Por eso CADA
 * `page.tsx` bajo (dashboard) debe invocar su propio guard, y las páginas de
 * administración el guard de ADMIN. El layout queda como defensa adicional.
 */
const ROOT = path.resolve(__dirname, '../../src/app/(dashboard)')

function walkPages(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) walkPages(full, acc)
        else if (entry === 'page.tsx') acc.push(full)
    }
    return acc
}

const GUARD = /await\s+(requireSession|requirePagePermission|requireAdminPage)\s*\(/
const ADMIN_GUARD = /await\s+requireAdminPage\s*\(/

describe('C-007 / R-028: toda página bajo (dashboard) tiene guard PROPIO', () => {
    const pages = walkPages(ROOT)

    it('hay páginas que revisar', () => {
        expect(pages.length).toBeGreaterThan(10)
    })

    for (const page of pages) {
        const rel = path.relative(ROOT, page).replace(/\\/g, '/')
        const source = readFileSync(page, 'utf-8')
        const isAdmin = rel.startsWith('admin/')

        it(`${rel} invoca ${isAdmin ? 'requireAdminPage' : 'un guard de sesión/permiso'} antes de consultar datos`, () => {
            expect(GUARD.test(source), `${rel} no invoca ningún guard`).toBe(true)
            if (isAdmin) expect(ADMIN_GUARD.test(source), `${rel} debe usar requireAdminPage`).toBe(true)

            // El guard debe ir ANTES del primer acceso a Prisma (si lo hay).
            const guardIdx = source.search(GUARD)
            const prismaIdx = source.indexOf('prisma.')
            if (prismaIdx !== -1) {
                expect(guardIdx, `${rel}: consulta Prisma antes del guard`).toBeLessThan(prismaIdx)
            }
        })
    }
})
