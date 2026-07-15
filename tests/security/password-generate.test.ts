import { describe, it, expect } from 'vitest'
import { generateStrongPassword } from '@/lib/password'
import { createUserSchema } from '@/lib/schemas/admin'

/**
 * Rotación de usuarios seed (SEC-020 / SEC-002) — el generador de contraseñas
 * debe producir siempre contraseñas que cumplan la política de admin.
 */
describe('generateStrongPassword', () => {
    it('cumple SIEMPRE la política de contraseñas (500 muestras)', () => {
        for (let i = 0; i < 500; i++) {
            const pwd = generateStrongPassword()
            const parsed = createUserSchema.safeParse({
                username: 'seeduser',
                password: pwd,
                role: 'ADMIN',
            })
            expect(parsed.success, `falló con "${pwd}"`).toBe(true)
        }
    })

    it('genera contraseñas únicas (sin colisiones en 500)', () => {
        const set = new Set(Array.from({ length: 500 }, () => generateStrongPassword()))
        expect(set.size).toBe(500)
    })

    it('respeta la longitud solicitada y el mínimo de 8', () => {
        expect(generateStrongPassword(20).length).toBe(20)
        expect(generateStrongPassword(4).length).toBe(8) // eleva al mínimo
    })
})
