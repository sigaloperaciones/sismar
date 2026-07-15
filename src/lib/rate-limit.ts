/**
 * Rate limiter en memoria (ventana fija).
 * (Remediación SEC-009 — Auditoría FOSCAL jul/2026.)
 *
 * Adecuado para despliegue de instancia única (PM2 con 1 proceso).
 * Si la app escala horizontalmente, migrar a un backend compartido (Redis) —
 * registrado en el RADAR del proyecto.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

export function checkRateLimit(
    key: string,
    max = 5,
    windowMs = 60_000,
    now = Date.now()
): RateLimitResult {
    const bucket = buckets.get(key)

    if (!bucket || now >= bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, retryAfterSeconds: 0 }
    }

    bucket.count++
    if (bucket.count > max) {
        return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        }
    }
    return { allowed: true, retryAfterSeconds: 0 }
}

/** Solo para tests. */
export function resetRateLimit() {
    buckets.clear()
}
