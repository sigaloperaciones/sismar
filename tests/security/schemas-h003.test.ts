import { describe, it, expect } from 'vitest'
import { createUserSchema, updateUserSchema } from '@/lib/schemas/admin'
import { updateMailSchema, anexoIdentifiersSchema, incomingMailSchema, outgoingMailSchema, MAX_ANEXOS } from '@/lib/schemas/correspondencia'
import { PERMISOS, PERMISOS_CATALOGO, ROL_PERMISOS_DEFAULT } from '@/lib/permissions-catalog'

/**
 * H-003 / C-015 (B-05, B-09), C-003 (B-06), C-004 (nuevos permisos).
 */
describe('S-025: usuarios — email válido y AGENCIA con agencia obligatoria', () => {
    const base = { username: 'nuevo', password: 'ClaveFuerte9', role: 'AGENCIA' as const }

    it('AGENCIA sin agencia → rechazado (B-09)', () => {
        const r = createUserSchema.safeParse({ ...base, agenciaId: '' })
        expect(r.success).toBe(false)
        if (!r.success) expect(r.error.issues[0].path).toContain('agenciaId')
        expect(createUserSchema.safeParse({ ...base }).success).toBe(false)
    })
    it('AGENCIA con agencia → aceptado; ADMIN sin agencia → aceptado', () => {
        expect(createUserSchema.safeParse({ ...base, agenciaId: '1' }).success).toBe(true)
        expect(createUserSchema.safeParse({ ...base, role: 'ADMIN' }).success).toBe(true)
    })
    it('email inválido → rechazado; vacío o válido → aceptado (B-05)', () => {
        expect(createUserSchema.safeParse({ ...base, agenciaId: '1', email: 'no-es-correo' }).success).toBe(false)
        expect(createUserSchema.safeParse({ ...base, agenciaId: '1', email: '' }).success).toBe(true)
        expect(createUserSchema.safeParse({ ...base, agenciaId: '1', email: 'ana@institucion.test' }).success).toBe(true)
    })
    it('updateUserSchema aplica las mismas reglas y permite contraseña vacía', () => {
        expect(updateUserSchema.safeParse({ username: 'user1', password: '', role: 'AGENCIA', agenciaId: '' }).success).toBe(false)
        expect(updateUserSchema.safeParse({ username: 'user1', password: '', role: 'AGENCIA', agenciaId: '2', email: 'a@b.co' }).success).toBe(true)
    })
})

describe('B-06: updateMailSchema', () => {
    it('rechaza id no numérico, importancia inválida y asunto corto', () => {
        expect(updateMailSchema.safeParse({ id: 'x', asunto: 'Asunto ok', importancia: 'NORMAL', remitenteNombre: 'R' }).success).toBe(false)
        expect(updateMailSchema.safeParse({ id: 1, asunto: 'Asunto ok', importancia: 'URGENTE', remitenteNombre: 'Rem' }).success).toBe(false)
        expect(updateMailSchema.safeParse({ id: 1, asunto: 'ab', importancia: 'NORMAL', remitenteNombre: 'Rem' }).success).toBe(false)
    })
    it('exige nombre de remitente O de destinatario (formularios entrante/saliente)', () => {
        expect(updateMailSchema.safeParse({ id: 1, asunto: 'Asunto ok', importancia: 'NORMAL' }).success).toBe(false)
        expect(updateMailSchema.safeParse({ id: 1, asunto: 'Asunto ok', importancia: 'NORMAL', destinatarioNombre: 'Destino' }).success).toBe(true)
    })
    it('acota longitudes', () => {
        expect(updateMailSchema.safeParse({ id: 1, asunto: 'A'.repeat(501), importancia: 'NORMAL', remitenteNombre: 'Rem' }).success).toBe(false)
        expect(updateMailSchema.safeParse({ id: 1, asunto: 'Asunto', importancia: 'NORMAL', remitenteNombre: 'Rem', numeroGuia: 'G'.repeat(81) }).success).toBe(false)
    })
    it('identificadores de anexo: máximo 50, cada uno ≤ 100 caracteres', () => {
        expect(anexoIdentifiersSchema.safeParse(Array.from({ length: 51 }, (_, i) => `F${i}`)).success).toBe(false)
        expect(anexoIdentifiersSchema.safeParse(['x'.repeat(101)]).success).toBe(false)
        expect(anexoIdentifiersSchema.safeParse(['FAC-001', 'FAC-002']).success).toBe(true)
    })
})

describe('catálogo de permisos (C-004)', () => {
    it('incluye los permisos nuevos y los asigna a los roles correctos por defecto', () => {
        const codigos = PERMISOS_CATALOGO.map(p => p.codigo)
        expect(codigos).toContain(PERMISOS.PLANILLAS_GESTIONAR)
        expect(codigos).toContain(PERMISOS.RECIBIR)
        expect(ROL_PERMISOS_DEFAULT.MENSAJERO).toContain(PERMISOS.PLANILLAS_GESTIONAR)
        expect(ROL_PERMISOS_DEFAULT.MENSAJERO).not.toContain(PERMISOS.RECIBIR)
        expect(ROL_PERMISOS_DEFAULT.AGENCIA).toContain(PERMISOS.RECIBIR)
        expect(ROL_PERMISOS_DEFAULT.AGENCIA).not.toContain(PERMISOS.PLANILLAS_GESTIONAR)
        expect(ROL_PERMISOS_DEFAULT.AGENCIA).not.toContain(PERMISOS.RECORRIDOS_GESTIONAR)
        expect(ROL_PERMISOS_DEFAULT.ADMIN).toEqual(codigos)
    })
    it('los códigos son únicos', () => {
        const codigos = PERMISOS_CATALOGO.map(p => p.codigo)
        expect(new Set(codigos).size).toBe(codigos.length)
    })
})

describe('R-040: topes en el alta de correspondencia', () => {
    const base = { empresaMensajeria: 'Servientrega', remitenteNombre: 'Remitente', agenciaId: '1', asunto: 'Asunto', importancia: 'NORMAL' as const }
    it('asunto y nombres con máximo', () => {
        expect(incomingMailSchema.safeParse({ ...base, asunto: 'A'.repeat(501) }).success).toBe(false)
        expect(incomingMailSchema.safeParse({ ...base, remitenteNombre: 'R'.repeat(201) }).success).toBe(false)
        expect(incomingMailSchema.safeParse(base).success).toBe(true)
        expect(outgoingMailSchema.safeParse({ agenciaId: '1', empresaMensajeria: 'S', destinatarioNombre: 'D'.repeat(201), asunto: 'Asunto', importancia: 'NORMAL' }).success).toBe(false)
    })
    it('el número de anexos por pieza está acotado', () => {
        expect(MAX_ANEXOS).toBeLessThanOrEqual(50)
    })
})
