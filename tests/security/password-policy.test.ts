import { describe, it, expect } from 'vitest'
import { createUserSchema, updateUserSchema } from '@/lib/schemas/admin'

/**
 * SEC-020 (Auditoría FOSCAL) — Política de contraseñas:
 * mínimo 8 caracteres con mayúscula, minúscula y número (alineado a NIST).
 */
describe('SEC-020: política de contraseñas', () => {
    // H-003 (B-09): un AGENCIA exige agencia; la base la incluye para aislar la política de contraseña.
    const base = { username: 'usuario1', role: 'AGENCIA' as const, agenciaId: '1' }

    it('rechaza contraseñas de 6 caracteres', () => {
        expect(createUserSchema.safeParse({ ...base, password: '123456' }).success).toBe(false)
    })

    it('rechaza 8+ caracteres sin complejidad', () => {
        expect(createUserSchema.safeParse({ ...base, password: 'abcdefgh' }).success).toBe(false)
        expect(createUserSchema.safeParse({ ...base, password: '12345678' }).success).toBe(false)
        expect(createUserSchema.safeParse({ ...base, password: 'ABCDEFGH' }).success).toBe(false)
    })

    it('acepta contraseñas con mayúscula, minúscula y número', () => {
        expect(createUserSchema.safeParse({ ...base, password: 'Passw0rd' }).success).toBe(true)
        expect(createUserSchema.safeParse({ ...base, password: 'Sismar2026x' }).success).toBe(true)
    })

    it('updateUserSchema permite vacío (no cambiar) pero exige política si se envía', () => {
        expect(updateUserSchema.safeParse({ ...base, password: '' }).success).toBe(true)
        expect(updateUserSchema.safeParse({ ...base, password: '123456' }).success).toBe(false)
        expect(updateUserSchema.safeParse({ ...base, password: 'Passw0rd' }).success).toBe(true)
    })
})
