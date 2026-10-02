import {
    EstadoCorrespondencia,
    EstadoPlanilla,
    EstadoRecorrido,
    Importancia,
    Role,
    TipoCorrespondencia,
    TipoRecorrido,
} from '@prisma/client'

export { EstadoCorrespondencia, EstadoPlanilla, EstadoRecorrido, Importancia, Role, TipoCorrespondencia, TipoRecorrido }

/**
 * Convierte un valor desconocido (query string, FormData) al enum si es un
 * miembro válido; si no, `undefined`. (H-003 / C-013 — hallazgo B-02.)
 */
export function asEnum<T extends Record<string, string>>(e: T, value: unknown): T[keyof T] | undefined {
    if (typeof value !== 'string') return undefined
    return (Object.values(e) as string[]).includes(value) ? (value as T[keyof T]) : undefined
}
