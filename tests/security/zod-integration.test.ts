import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * SEC-007 (Auditoría FOSCAL) — Los esquemas Zod definidos deben usarse
 * REALMENTE en las server actions (regresión estática).
 */
const CASES = [
    { file: 'correspondencia.ts', schemas: ['incomingMailSchema', 'outgoingMailSchema'] },
    { file: 'admin.ts', schemas: ['empresaConfigSchema', 'createUserSchema', 'updateUserSchema'] },
]

describe('SEC-007: server actions validan con Zod (safeParse)', () => {
    for (const c of CASES) {
        it(`${c.file} usa safeParse con sus esquemas`, () => {
            const full = path.resolve(__dirname, '../../src/app/actions', c.file)
            const source = readFileSync(full, 'utf-8')
            expect(source, `${c.file} no invoca safeParse`).toMatch(/\.safeParse\(/)
            for (const s of c.schemas) {
                expect(source, `${c.file} no usa ${s}`).toContain(s)
            }
        })
    }
})
