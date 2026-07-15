import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

/**
 * SEC-002 (Auditoría FOSCAL) — Credenciales de prueba expuestas.
 * Regresión: ninguna contraseña de los usuarios semilla ("123456") puede
 * existir en el código fuente de la app (src/). El seed (prisma/) se audita aparte.
 */
function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) {
            if (entry === 'node_modules' || entry === '.next' || entry === 'generated') continue
            walk(full, acc)
        } else if (/\.(ts|tsx)$/.test(entry)) {
            acc.push(full)
        }
    }
    return acc
}

describe('SEC-002: sin credenciales hardcodeadas en src/', () => {
    it('ningún archivo de src/ contiene la contraseña de prueba "123456" como literal', () => {
        const srcDir = path.resolve(__dirname, '../../src')
        // Literal exacto entre comillas (evita falsos positivos como "GUIA123456")
        const CREDENTIAL = /["'`]123456["'`]/
        const offenders = walk(srcDir).filter(f =>
            CREDENTIAL.test(readFileSync(f, 'utf-8'))
        )
        expect(offenders, `Credenciales expuestas en: ${offenders.join(', ')}`).toEqual([])
    })
})
