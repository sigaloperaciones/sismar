import { headers } from 'next/headers'

/**
 * Metadatos de la petición (IP y user-agent) para rate limiting y bitácora
 * (H-003 / C-008, C-011).
 *
 * Detrás de Caddy, `X-Forwarded-For` lo fija el proxy: por defecto Caddy NO
 * confía en el valor entrante y lo sustituye por la IP real del cliente. Si
 * existiera una cadena, el último valor es el añadido por el proxy de confianza
 * (el primero lo controla el atacante). Por eso se toma el ÚLTIMO.
 */
export function clientIpFromHeaders(h: Headers): string | null {
    const xff = h.get('x-forwarded-for')
    if (xff) {
        const parts = xff.split(',').map(s => s.trim()).filter(Boolean)
        const last = parts[parts.length - 1]
        if (last) return normalizeIp(last)
    }
    const real = h.get('x-real-ip')
    if (real) return normalizeIp(real.trim())
    return null
}

function normalizeIp(ip: string): string {
    // Quita el prefijo IPv4-mapped y limita longitud (defensa ante cabeceras basura).
    const clean = ip.replace(/^::ffff:/, '')
    return clean.slice(0, 64)
}

export async function getClientIp(): Promise<string | null> {
    try {
        return clientIpFromHeaders(await headers())
    } catch {
        // Fuera de un contexto de petición (scripts, tests) no hay cabeceras.
        return null
    }
}

export async function getUserAgent(): Promise<string | null> {
    try {
        return (await headers()).get('user-agent')
    } catch {
        return null
    }
}
