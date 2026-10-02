import { describe, it, expect } from 'vitest'
import { resolveOrigin, parseAllowedHosts } from '@/lib/request-origin'

/**
 * H-003 / C-009 (hallazgo M-05) — Redirecciones solo a orígenes permitidos.
 */
const base = { fallbackHost: 'localhost:3002', fallbackProto: 'http:' }

describe('S-018: resolveOrigin', () => {
    it('Host en la allowlist → se respeta (con el proto reenviado)', () => {
        expect(resolveOrigin({ ...base, hostHeader: 'sismar.ejemplo.test', forwardedProto: 'https', allowedHosts: 'sismar.ejemplo.test' }))
            .toBe('https://sismar.ejemplo.test')
    })
    it('Host atacante fuera de la allowlist → primer host permitido', () => {
        expect(resolveOrigin({ ...base, hostHeader: 'atacante.test', forwardedProto: 'https', allowedHosts: 'sismar.ejemplo.test, otro.ejemplo.test' }))
            .toBe('https://sismar.ejemplo.test')
    })
    it('Host ausente → primer host permitido', () => {
        expect(resolveOrigin({ ...base, hostHeader: null, forwardedProto: 'https', allowedHosts: 'sismar.ejemplo.test' }))
            .toBe('https://sismar.ejemplo.test')
    })
    it('la comparación ignora mayúsculas y espacios', () => {
        expect(resolveOrigin({ ...base, hostHeader: ' SISMAR.Ejemplo.TEST ', forwardedProto: 'https', allowedHosts: 'sismar.ejemplo.test' }))
            .toBe('https://sismar.ejemplo.test')
    })
    it('proto inválido (inyección) → cae a https/http válido', () => {
        expect(resolveOrigin({ ...base, hostHeader: 'sismar.ejemplo.test', forwardedProto: 'javascript', allowedHosts: 'sismar.ejemplo.test' }))
            .toBe('http://sismar.ejemplo.test') // fallbackProto http:
        expect(resolveOrigin({ ...base, fallbackProto: 'https:', hostHeader: 'sismar.ejemplo.test', forwardedProto: 'gopher, https', allowedHosts: 'sismar.ejemplo.test' }))
            .toBe('https://sismar.ejemplo.test')
    })
    it('sin allowlist (desarrollo) → host resuelto por Next, NUNCA la cabecera cruda', () => {
        expect(resolveOrigin({ ...base, hostHeader: 'atacante.test', forwardedProto: null, allowedHosts: undefined }))
            .toBe('http://localhost:3002')
        expect(resolveOrigin({ ...base, hostHeader: 'atacante.test', forwardedProto: null, allowedHosts: '' }))
            .toBe('http://localhost:3002')
    })
    it('parseAllowedHosts normaliza', () => {
        expect(parseAllowedHosts(' A.test, b.test ,,')).toEqual(['a.test', 'b.test'])
        expect(parseAllowedHosts(undefined)).toEqual([])
    })
})
