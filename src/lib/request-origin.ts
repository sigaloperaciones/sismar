/**
 * Resolución segura del origen para redirecciones del middleware
 * (H-003 / C-009 — hallazgo M-05). Módulo puro, apto para runtime Edge.
 *
 * Problema original: la app corre tras Caddy en 127.0.0.1, por lo que
 * `request.url` apunta a localhost. Se tomaban `Host` y `X-Forwarded-Proto`
 * tal cual → open redirect si Node es alcanzable sin el proxy.
 *
 * Solución: allowlist `ALLOWED_HOSTS` (separada por comas). El `Host` solo se
 * respeta si está en la lista; si no, se usa el PRIMER host permitido. Sin
 * allowlist configurada (desarrollo) se usa el host de la propia petición
 * que Next ya resolvió (`request.nextUrl`), nunca la cabecera cruda.
 */

export interface OriginInput {
    hostHeader: string | null
    forwardedProto: string | null
    /** Host/proto resueltos por Next (`request.nextUrl`). */
    fallbackHost: string
    fallbackProto: string
    /** Valor de ALLOWED_HOSTS. */
    allowedHosts: string | undefined
}

export function parseAllowedHosts(raw: string | undefined): string[] {
    if (!raw) return []
    return raw
        .split(',')
        .map(h => h.trim().toLowerCase())
        .filter(Boolean)
}

function sanitizeProto(proto: string | null, fallback: string): 'http' | 'https' {
    const p = (proto ?? '').split(',')[0].trim().toLowerCase()
    if (p === 'http' || p === 'https') return p
    const f = fallback.replace(':', '').toLowerCase()
    return f === 'http' ? 'http' : 'https'
}

export function resolveOrigin(input: OriginInput): string {
    const allowed = parseAllowedHosts(input.allowedHosts)
    const proto = sanitizeProto(input.forwardedProto, input.fallbackProto)

    if (allowed.length === 0) {
        // Sin allowlist (desarrollo local): host resuelto por Next, no la cabecera cruda.
        return `${proto}://${input.fallbackHost}`
    }

    const host = (input.hostHeader ?? '').trim().toLowerCase()
    if (host && allowed.includes(host)) {
        return `${proto}://${host}`
    }
    return `${proto}://${allowed[0]}`
}
