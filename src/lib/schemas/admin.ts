import { z } from 'zod'
import { HSL_REGEX, isSafeLogoUrl } from '../branding'

// H-003 / C-010 (M-06): los colores de marca se inyectan en un <style> global.
// Solo se admite el formato HSL de Tailwind ("221.2 83.2% 53.3%").
const hslField = z
    .string()
    .trim()
    .regex(HSL_REGEX, 'Formato de color inválido. Use HSL, ej: "221.2 83.2% 53.3%"')
    .optional()
    .or(z.literal(''))

export const empresaConfigSchema = z.object({
    nombre: z.string().trim().min(2, 'El nombre de la empresa es requerido').max(120, 'Máximo 120 caracteres'),
    nit: z.string().trim().max(30, 'Máximo 30 caracteres').optional().or(z.literal('')),
    logoUrl: z
        .string()
        .trim()
        .refine(v => v === '' || isSafeLogoUrl(v), 'La URL del logo debe ser una ruta de la aplicación o https://')
        .optional()
        .or(z.literal('')),
    colorPrimary: hslField,
    colorSecondary: hslField,
    colorAccent: hslField,
})

// SEC-020 (Auditoría FOSCAL): mínimo 8 caracteres con mayúscula, minúscula
// y número (alineado a NIST). Aplica a creación y a cambio de contraseña.
const passwordPolicy = z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[a-z]/, 'La contraseña debe incluir al menos una minúscula')
    .regex(/[A-Z]/, 'La contraseña debe incluir al menos una mayúscula')
    .regex(/[0-9]/, 'La contraseña debe incluir al menos un número')

// H-003 / C-015 (B-05): email opcional pero válido si se ingresa.
const emailField = z.email('Correo electrónico inválido').max(120, 'Máximo 120 caracteres').optional().or(z.literal(''))

const roleField = z.enum(['ADMIN', 'MENSAJERO', 'AGENCIA'], { error: 'Seleccione un rol válido' })

// H-003 / C-015 (B-09): un usuario AGENCIA DEBE tener agencia asignada.
const agenciaRequerida = (d: { role: string; agenciaId?: string }) =>
    d.role !== 'AGENCIA' || (typeof d.agenciaId === 'string' && d.agenciaId.trim() !== '')
const agenciaRequeridaMsg = { message: 'Un usuario con rol AGENCIA debe tener una agencia asignada', path: ['agenciaId'] }

export const createUserSchema = z
    .object({
        username: z.string().trim().min(3, 'Mínimo 3 caracteres').max(30, 'Máximo 30 caracteres'),
        email: emailField,
        password: passwordPolicy,
        role: roleField,
        agenciaId: z.string().optional(),
    })
    .refine(agenciaRequerida, agenciaRequeridaMsg)

export const updateUserSchema = z
    .object({
        username: z.string().trim().min(3, 'Mínimo 3 caracteres').max(30, 'Máximo 30 caracteres'),
        email: emailField,
        password: passwordPolicy.optional().or(z.literal('')),
        role: roleField,
        agenciaId: z.string().optional(),
    })
    .refine(agenciaRequerida, agenciaRequeridaMsg)

export type EmpresaConfigFormData = z.infer<typeof empresaConfigSchema>
export type CreateUserFormData = z.infer<typeof createUserSchema>
export type UpdateUserFormData = z.infer<typeof updateUserSchema>
