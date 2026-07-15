import type { NextConfig } from "next";

// SEC-011 (Auditoría FOSCAL): Content-Security-Policy.
// Nota: Next.js App Router requiere 'unsafe-inline' para sus scripts/estilos
// embebidos; el resto de fuentes queda restringido al propio origen.
const contentSecurityPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
].join('; ')

const securityHeaders = [
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    // SEC-011: defensa principal contra XSS
    { key: 'Content-Security-Policy', value: contentSecurityPolicy },
    // SEC-012: impide downgrade HTTPS→HTTP (2 años, subdominios, preload)
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig: NextConfig = {
    async headers() {
        return [{ source: '/(.*)', headers: securityHeaders }]
    },
}

export default nextConfig;
