import type { NextConfig } from "next";

// Cabeceras estáticas de seguridad (SEC-011/SEC-012 — Auditoría FOSCAL).
//
// H-003 / C-010 (M-06): la Content-Security-Policy ya NO se define aquí sino en
// `src/middleware.ts`, con un nonce distinto por petición (sin 'unsafe-inline'
// en script-src). Definirla en ambos sitios haría que el navegador aplicara la
// intersección de las dos políticas. `/api/uploads` fija su propia CSP.
const securityHeaders = [
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    // SEC-012: impide downgrade HTTPS→HTTP (2 años, subdominios, preload)
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
    async headers() {
        return [{ source: '/(.*)', headers: securityHeaders }]
    },
    experimental: {
        serverActions: {
            // Las subidas (guías, firmas) viajan por server actions. El límite de
            // la app es 10 MB (lib/uploads.ts); el de Next debe permitirlo.
            bodySizeLimit: '11mb',
        },
    },
}

export default nextConfig;
