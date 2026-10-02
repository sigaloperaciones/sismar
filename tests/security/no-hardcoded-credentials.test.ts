import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'fs'
import path from 'path'

/**
 * SEC-002 (Auditoría FOSCAL) — Credenciales de prueba expuestas.
 * Regresión: ninguna contraseña de los usuarios semilla ("123456") puede
 * existir en el código fuente de la app (src/) NI en los scripts (prisma/) — H-003 / M-02.
 */
function walk(dir: string, acc: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        if (statSync(full).isDirectory()) {
            if (entry === 'node_modules' || entry === '.next' || entry === 'generated') continue
            walk(full, acc)
        } else if (/\.(ts|tsx|md|sh|cjs)$/.test(entry)) {
            acc.push(full)
        }
    }
    return acc
}

describe('SEC-002: sin credenciales hardcodeadas en src/', () => {
    it('ningún archivo de src/, prisma/, docs/ ni deploy/ contiene la contraseña de prueba "123456" como literal', () => {
        const srcDir = path.resolve(__dirname, '../../src')
        const prismaDir = path.resolve(__dirname, '../../prisma')
        // Guardian (re-verificación H-003): ya no se exige que el literal vaya entre
        // comillas — "usuarios por defecto 123456" en un runbook también es una fuga.
        // Se evita el falso positivo de números más largos (p. ej. "GUIA1234567").
        const CREDENTIAL = /(?<![A-Za-z0-9])123456(?![0-9])/
        const docsDir = path.resolve(__dirname, '../../docs')
        const deployDir = path.resolve(__dirname, '../../deploy')
        const offenders = [...walk(srcDir), ...walk(prismaDir), ...walk(docsDir), ...walk(deployDir)].filter(f =>
            CREDENTIAL.test(readFileSync(f, 'utf-8'))
        )
        expect(offenders, `Credenciales expuestas en: ${offenders.join(', ')}`).toEqual([])
    })
})
