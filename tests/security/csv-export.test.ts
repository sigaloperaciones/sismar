import { describe, it, expect } from 'vitest'
import { csvSafe, csvCell } from '@/lib/csv'

/**
 * Guardian R-037 — Inyección de fórmulas en la exportación CSV (OWASP A03).
 * Una AGENCIA puede plantar `=HYPERLINK(...)` en un asunto; al abrir el CSV en
 * Excel se ejecutaría. Las celdas que empiezan por = + - @ \t \r se neutralizan.
 */
describe('R-037: csvSafe', () => {
    it('neutraliza fórmulas y conserva texto normal', () => {
        expect(csvSafe('=HYPERLINK("http://evil.test","x")')).toBe("'=HYPERLINK(\"http://evil.test\",\"x\")")
        expect(csvSafe('+1234')).toBe("'+1234")
        expect(csvSafe('-5')).toBe("'-5")
        expect(csvSafe('@SUM(A1)')).toBe("'@SUM(A1)")
        expect(csvSafe('\tx')).toBe("'\tx")
        expect(csvSafe('Carta normal')).toBe('Carta normal')
        expect(csvSafe('')).toBe('')
    })
    it('csvCell además escapa comillas y envuelve en comillas', () => {
        expect(csvCell('dice "hola"')).toBe('"dice ""hola"""')
        expect(csvCell('=1+1')).toBe("\"'=1+1\"")
        expect(csvCell(null)).toBe('""')
    })
})
