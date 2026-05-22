import { z } from 'zod'

export const incomingMailSchema = z.object({
    empresaMensajeria: z.string().min(1, 'La empresa de mensajería es requerida'),
    remitenteNombre: z.string().min(2, 'El nombre del remitente es requerido'),
    remitenteCiudad: z.string().optional(),
    agenciaId: z.string().min(1, 'Debe seleccionar una agencia destinataria'),
    asunto: z.string().min(3, 'El asunto debe tener al menos 3 caracteres'),
    importancia: z.enum(['NORMAL', 'ALTA']),
    necesitaRespuesta: z.boolean().optional(),
})

export const outgoingMailSchema = z.object({
    agenciaId: z.string().min(1, 'Debe seleccionar la agencia de origen'),
    empresaMensajeria: z.string().min(1, 'La empresa de mensajería es requerida'),
    destinatarioNombre: z.string().min(2, 'El nombre del destinatario es requerido'),
    destinatarioCiudad: z.string().optional(),
    asunto: z.string().min(3, 'El asunto debe tener al menos 3 caracteres'),
    importancia: z.enum(['NORMAL', 'ALTA']),
})

export type IncomingMailFormData = z.infer<typeof incomingMailSchema>
export type OutgoingMailFormData = z.infer<typeof outgoingMailSchema>
