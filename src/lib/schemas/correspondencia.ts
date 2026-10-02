import { z } from 'zod'

// R-040: topes de longitud en el alta (antes solo había mínimos) y de anexos por pieza.
export const MAX_ANEXOS = 50

export const incomingMailSchema = z.object({
    empresaMensajeria: z.string().min(1, 'La empresa de mensajería es requerida').max(120, 'Máximo 120 caracteres'),
    remitenteNombre: z.string().min(2, 'El nombre del remitente es requerido').max(200, 'Máximo 200 caracteres'),
    remitenteCiudad: z.string().max(120, 'Máximo 120 caracteres').optional(),
    agenciaId: z.string().min(1, 'Debe seleccionar una agencia destinataria').max(20),
    asunto: z.string().min(3, 'El asunto debe tener al menos 3 caracteres').max(500, 'Máximo 500 caracteres'),
    importancia: z.enum(['NORMAL', 'ALTA']),
    necesitaRespuesta: z.boolean().optional(),
})

export const outgoingMailSchema = z.object({
    agenciaId: z.string().min(1, 'Debe seleccionar la agencia de origen').max(20),
    empresaMensajeria: z.string().min(1, 'La empresa de mensajería es requerida').max(120, 'Máximo 120 caracteres'),
    destinatarioNombre: z.string().min(2, 'El nombre del destinatario es requerido').max(200, 'Máximo 200 caracteres'),
    destinatarioCiudad: z.string().max(120, 'Máximo 120 caracteres').optional(),
    asunto: z.string().min(3, 'El asunto debe tener al menos 3 caracteres').max(500, 'Máximo 500 caracteres'),
    importancia: z.enum(['NORMAL', 'ALTA']),
})

/**
 * H-003 / C-003 (B-06): esquema de EDICIÓN ("Completar"). Antes la acción
 * aceptaba asunto, importancia, agencia y anexos sin validar.
 *
 * El formulario de salientes envía `destinatarioNombre/destinatarioCiudad` y el
 * de entrantes `remitenteNombre/remitenteCiudad`; en BD ambos se guardan en
 * `remitenteNombre/remitenteCiudad` (convención del modelo). El esquema acepta
 * cualquiera de los dos pares y la acción los normaliza.
 */
const optionalText = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres`).optional().or(z.literal(''))

export const updateMailSchema = z
    .object({
        id: z.coerce.number().int().positive('ID inválido'),
        remitenteNombre: optionalText(200),
        remitenteCiudad: optionalText(120),
        destinatarioNombre: optionalText(200),
        destinatarioCiudad: optionalText(120),
        asunto: z.string().trim().min(3, 'El asunto debe tener al menos 3 caracteres').max(500, 'Máximo 500 caracteres'),
        importancia: z.enum(['NORMAL', 'ALTA'], { error: 'Importancia inválida' }),
        necesitaRespuesta: z.boolean().optional(),
        agenciaId: z.coerce.number().int().positive().optional(),
        empresaMensajeria: optionalText(120),
        numeroGuia: optionalText(80),
        mensajero: optionalText(120),
    })
    .refine(
        d => (d.remitenteNombre && d.remitenteNombre.length >= 2) || (d.destinatarioNombre && d.destinatarioNombre.length >= 2),
        { message: 'El nombre del remitente/destinatario es requerido', path: ['remitenteNombre'] }
    )

export type UpdateMailFormData = z.infer<typeof updateMailSchema>

/** Identificadores de anexo: tope de cantidad y longitud (B-06: JSON.parse sin tope). */
export const MAX_ANEXO_IDENTIFIERS_JSON_CHARS = 4000
export const anexoIdentifiersSchema = z.array(z.string().trim().min(1).max(100)).max(50)

export type IncomingMailFormData = z.infer<typeof incomingMailSchema>
export type OutgoingMailFormData = z.infer<typeof outgoingMailSchema>
