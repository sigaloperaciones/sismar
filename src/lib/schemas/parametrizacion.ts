import { z } from 'zod'

// Centro de Costo: el código es correlativo automático (no lo ingresa el usuario).
export const centroCostoSchema = z.object({
    name: z.string().trim().min(2, 'El nombre del centro de costo es requerido').max(100, 'Máximo 100 caracteres'),
})

export const sedeSchema = z.object({
    name: z.string().trim().min(2, 'El nombre de la sede es requerido').max(100, 'Máximo 100 caracteres'),
    address: z.string().trim().max(200, 'Máximo 200 caracteres').optional().or(z.literal('')),
})

export type CentroCostoFormData = z.infer<typeof centroCostoSchema>
export type SedeFormData = z.infer<typeof sedeSchema>
