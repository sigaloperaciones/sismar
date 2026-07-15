import { describe, it, expect } from 'vitest'

/**
 * SEC-019 (Auditoría FOSCAL) — El consecutivo no puede colisionar
 * en operaciones concurrentes (Date.now() solo no basta).
 */
describe('SEC-019: generateConsecutive', () => {
    it('genera valores únicos aunque se invoque en el mismo milisegundo', async () => {
        const { generateConsecutive } = await import('@/lib/consecutive')
        const values = new Set(Array.from({ length: 500 }, () => generateConsecutive()))
        expect(values.size).toBe(500)
    })

    it('respeta el prefijo (ej. SAL-)', async () => {
        const { generateConsecutive } = await import('@/lib/consecutive')
        expect(generateConsecutive('SAL-').startsWith('SAL-')).toBe(true)
    })
})
