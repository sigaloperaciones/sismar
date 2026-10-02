/**
 * Content-Security-Policy con nonce por petición (H-003 / C-010 — hallazgo M-06).
 * Módulo puro, apto para runtime Edge (middleware).
 *
 * - `script-src` usa nonce + 'strict-dynamic': los scripts inline de Next llevan
 *   el nonce (Next lo toma de la cabecera `x-nonce`) y 'unsafe-inline' deja de
 *   aplicar en navegadores modernos. En desarrollo Next requiere 'unsafe-eval'.
 * - `style-src` conserva 'unsafe-inline': Next y Radix inyectan estilos inline y
 *   la app usa <style> para impresión. Riesgo residual registrado (R-022); los
 *   colores de marca se validan con regex HSL antes de llegar a un <style>.
 */

export function generateNonce(): string {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    let bin = ''
    for (const b of bytes) bin += String.fromCharCode(b)
    return btoa(bin)
}

export function buildCsp(nonce: string, opts: { dev: boolean }): string {
    const scriptSrc = [
        "'self'",
        `'nonce-${nonce}'`,
        "'strict-dynamic'",
        ...(opts.dev ? ["'unsafe-eval'"] : []),
    ].join(' ')

    const directives = [
        "default-src 'self'",
        `script-src ${scriptSrc}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'self'",
        "frame-src 'self'",
        ...(opts.dev ? [] : ['upgrade-insecure-requests']),
    ]
    return directives.join('; ')
}

/**
 * CSP para respuestas de archivos servidos por /api/uploads: nada ejecutable y
 * solo embebible desde la propia app. NO se usa la directiva `sandbox`: el visor
 * de PDF de Chrome no funciona dentro de documentos sandboxed y la
 * previsualización del soporte de firma (req. cliente #4) dejaría de verse. El
 * riesgo que `sandbox` cubriría (ejecutar scripts de un documento servido) ya
 * está cerrado aguas arriba: solo se sirven inline PDF/PNG/JPG cuyo contenido se
 * validó por magic bytes; cualquier otro tipo baja como adjunto octet-stream.
 */
export const UPLOADS_RESPONSE_CSP = "default-src 'none'; frame-ancestors 'self'"
