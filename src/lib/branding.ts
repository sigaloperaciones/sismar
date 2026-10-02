/**
 * Validación de valores de marca (H-003 / C-010 — hallazgo M-06).
 *
 * Los colores se inyectan en un <style> global; cualquier carácter fuera del
 * formato HSL de Tailwind ("221.2 83.2% 53.3%") podría cerrar la etiqueta e
 * inyectar HTML/JS (XSS almacenado de alcance global). Regla única usada por
 * el esquema Zod (entrada) y por ThemeInjector (salida, defensa en profundidad).
 */
export const HSL_REGEX = /^\d{1,3}(\.\d+)?\s+\d{1,3}(\.\d+)?%\s+\d{1,3}(\.\d+)?%$/

export function isValidHsl(value: unknown): value is string {
    return typeof value === 'string' && HSL_REGEX.test(value.trim())
}

/** Devuelve el HSL normalizado o null si no es válido. */
export function sanitizeHsl(value: unknown): string | null {
    if (!isValidHsl(value)) return null
    return value.trim().replace(/\s+/g, ' ')
}

/**
 * URL de logo admitida: ruta relativa a la app o https. Nunca `javascript:`
 * ni `data:` (evita inyección vía <img src>).
 */
export function isSafeLogoUrl(value: unknown): value is string {
    if (typeof value !== 'string') return false
    const v = value.trim()
    if (v.length === 0 || v.length > 500) return false
    // Ruta relativa a la app: "/" seguido de algo que no sea otra barra ni una barra
    // invertida (R-042: "/\host" lo normalizan algunos navegadores como "//host").
    if (/^\/(?![\/\\])/.test(v) && !/[\s"'<>]/.test(v)) return true
    return /^https:\/\/[^\s"'<>]+$/i.test(v)
}
