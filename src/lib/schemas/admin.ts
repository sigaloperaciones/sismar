import { z } from 'zod'

export const empresaConfigSchema = z.object({
    nombre: z.string().min(2, 'El nombre de la empresa es requerido'),
    nit: z.string().optional(),
    logoUrl: z.string().optional(),
    colorPrimary: z.string().optional(),
    colorSecondary: z.string().optional(),
    colorAccent: z.string().optional(),
})

export const createUserSchema = z.object({
    username: z.string().min(3, 'Mínimo 3 caracteres').max(30, 'Máximo 30 caracteres'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    role: z.enum(['ADMIN', 'MENSAJERO', 'AGENCIA'], { error: 'Seleccione un rol válido' }),
    agenciaId: z.string().optional(),
})

export const updateUserSchema = z.object({
    username: z.string().min(3, 'Mínimo 3 caracteres').max(30, 'Máximo 30 caracteres'),
    password: z.string().min(6, 'Mínimo 6 caracteres').optional().or(z.literal('')),
    role: z.enum(['ADMIN', 'MENSAJERO', 'AGENCIA'], { error: 'Seleccione un rol válido' }),
    agenciaId: z.string().optional(),
})

export type EmpresaConfigFormData = z.infer<typeof empresaConfigSchema>
export type CreateUserFormData = z.infer<typeof createUserSchema>
export type UpdateUserFormData = z.infer<typeof updateUserSchema>
