import { describe, it, expect } from 'vitest'
import { nextCentroCostoCode } from '@/lib/parametrizacion'
import { centroCostoSchema, sedeSchema } from '@/lib/schemas/parametrizacion'

/**
 * Comentarios del cliente (jul/2026): faltaba administrar Centros de Costo y Sedes.
 * Código de Centro de Costo = correlativo automático.
 */
describe('nextCentroCostoCode', () => {
    it('base vacía genera 001', () => {
        expect(nextCentroCostoCode([])).toBe('001')
    })
    it('continúa el correlativo con relleno a 3 dígitos', () => {
        expect(nextCentroCostoCode(['001', '002'])).toBe('003')
        expect(nextCentroCostoCode(['001', '002', '010'])).toBe('011')
    })
    it('usa el máximo, no la cantidad (soporta huecos)', () => {
        expect(nextCentroCostoCode(['001', '005'])).toBe('006')
    })
    it('ignora códigos no numéricos', () => {
        expect(nextCentroCostoCode(['ABC', '002'])).toBe('003')
    })
    it('pasa de 3 dígitos cuando corresponde', () => {
        expect(nextCentroCostoCode(['999'])).toBe('1000')
    })
})

describe('centroCostoSchema', () => {
    it('acepta un nombre válido', () => {
        expect(centroCostoSchema.safeParse({ name: 'Financiera' }).success).toBe(true)
    })
    it('rechaza nombre vacío o muy corto', () => {
        expect(centroCostoSchema.safeParse({ name: '' }).success).toBe(false)
        expect(centroCostoSchema.safeParse({ name: 'A' }).success).toBe(false)
    })
})

describe('sedeSchema', () => {
    it('acepta nombre con dirección opcional', () => {
        expect(sedeSchema.safeParse({ name: 'Sede Norte' }).success).toBe(true)
        expect(sedeSchema.safeParse({ name: 'Sede Norte', address: 'Calle 1' }).success).toBe(true)
        expect(sedeSchema.safeParse({ name: 'Sede Norte', address: '' }).success).toBe(true)
    })
    it('rechaza nombre inválido', () => {
        expect(sedeSchema.safeParse({ name: '' }).success).toBe(false)
    })
})
