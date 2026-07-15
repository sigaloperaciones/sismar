import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

/**
 * SEC-003 (Auditoría FOSCAL) — Server actions sin autenticación.
 * Regresión estática: CADA función exportada de las server actions de negocio
 * debe invocar un guard (requireSession/requirePermission/requireAdmin) en su cuerpo.
 * Excluidas: auth.ts (login/logout son públicas por naturaleza).
 */

const ACTION_FILES = [
    'catalogos.ts',
    'correspondencia.ts',
    'panillas.ts',
    'recorridos.ts',
    'admin.ts',
]

const GUARD_REGEX = /await\s+(requireSession|requirePermission|requireAdmin)\s*\(/

function exportedFunctionChunks(source: string): { name: string; body: string }[] {
    const marker = /export async function\s+(\w+)/g
    const indices: { name: string; start: number }[] = []
    let m: RegExpExecArray | null
    while ((m = marker.exec(source)) !== null) {
        indices.push({ name: m[1], start: m.index })
    }
    return indices.map((entry, i) => ({
        name: entry.name,
        body: source.slice(entry.start, indices[i + 1]?.start ?? source.length),
    }))
}

describe('SEC-003: toda server action de negocio invoca un guard de auth', () => {
    for (const file of ACTION_FILES) {
        it(`${file}: todas sus funciones exportadas están protegidas`, () => {
            const full = path.resolve(__dirname, '../../src/app/actions', file)
            const source = readFileSync(full, 'utf-8')
            const chunks = exportedFunctionChunks(source)
            expect(chunks.length).toBeGreaterThan(0)

            const unguarded = chunks
                .filter(c => !GUARD_REGEX.test(c.body))
                .map(c => c.name)

            expect(unguarded, `Acciones SIN guard en ${file}: ${unguarded.join(', ')}`).toEqual([])
        })
    }
})
