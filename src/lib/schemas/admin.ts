import { z } from 'zod'

export const empresaConfigSchema = z.object({
    nombre: z.string().min(2, 'El nombre de la empresa es requerido'),
    nit: z.string().optional(),
    logoUrl: z.string().optional(),
    colorPrimary: z.string().optional(),
    colorSecondary: z.string().optional(),
    colorAccent: z.string().optional(),
})

// SEC-020 (Auditoría FOSCAL): mínimo 8 caracteres con mayúscula, minúscula
// y número (alineado a NIST). Aplica a creación y a cambio de contraseña.
const passwordPolicy = z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[a-z]/, 'La contraseña debe incluir al menos una minúscula')
    .regex(/[A-Z]/, 'La contraseña debe incluir al menos una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe incluir al menos un número')

export const createUserSchema = z.object({
    username: z.string().min(3, 'Mínimo 3 caracteres').max(30, 'Máximo 30 caracteres'),
    password: passwordPolicy,
    role: z.enum(['ADMIN', 'MENSAJERO', 'AGENCIA'], { error: 'Seleccione un rol válido' }),
    agenciaId: z.string().optional(),
})

export const updateUserSchema = z.object({
    username: z.string().min(3, 'Mínimo 3 caracteres').max(30, 'Máximo 30 caracteres'),
    password: passwordPolicy.optional().or(z.literal('')),
    role: z.enum(['ADMIN', 'MENSAJERO', 'AGENCIA'], { error: 'Seleccione un rol válido' }),
    agenciaId: z.string().optional(),
})

export type EmpresaConfigFormData = z.infer<typeof empresaConfigSchema>
export type CreateUserFormData = z.infer<typeof createUserSchema>
export type UpdateUserFormData = z.infer<typeof updateUserSchema>
