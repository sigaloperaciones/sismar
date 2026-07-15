import { randomUUID } from "crypto"

/**
 * Generador de consecutivos a prueba de colisiones.
 * (Remediación SEC-019 — Auditoría FOSCAL jul/2026.)
 *
 * Conserva el timestamp (ordenable y legible) y añade un sufijo aleatorio
 * criptográficamente fuerte que elimina colisiones en operaciones concurrentes.
 */
export function generateConsecutive(prefix = ""): string {
    return `${prefix}${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`
}
