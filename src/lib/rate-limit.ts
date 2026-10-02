/**
 * Rate limiter de ventana fija (SEC-009 + H-003 / C-008 — hallazgo M-04).
 *
 * Store intercambiable: por defecto en memoria (instancia única PM2). Si la app
 * escala a varios procesos, implementar `RateLimitStore` sobre Redis y
 * registrarlo con `setRateLimitStore` (RADAR R-020). El bloqueo PERSISTENTE de
 * cuenta (M-08) vive en BD (`Usuario.lockedUntil`), no aquí.
 */

type Bucket = { count: number; resetAt: number }

export interface RateLimitStore {
    get(key: string): Bucket | undefined
    set(key: string, bucket: Bucket): void
    clear(): void
}

class MemoryStore implements RateLimitStore {
    private buckets = new Map<string, Bucket>()
    get(key: string) { return this.buckets.get(key) }
    set(key: string, bucket: Bucket) {
        // Limpieza oportunista para que el Map no crezca sin límite.
        if (this.buckets.size > 10_000) {
            const now = Date.now()
            for (const [k, b] of this.buckets) if (b.resetAt <= now) this.buckets.delete(k)
        }
        this.buckets.set(key, bucket)
    }
    clear() { this.buckets.clear() }
}

let store: RateLimitStore = new MemoryStore()

export function setRateLimitStore(s: RateLimitStore) { store = s }

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number }

export function checkRateLimit(
    key: string,
    max = 5,
    windowMs = 60_000,
    now = Date.now()
): RateLimitResult {
    const bucket = store.get(key)

    if (!bucket || now >= bucket.resetAt) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, retryAfterSeconds: 0 }
    }

    bucket.count++
    store.set(key, bucket)
    if (bucket.count > max) {
        return {
            allowed: false,
            retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
        }
    }
    return { allowed: true, retryAfterSeconds: 0 }
}

/** Límites de login: por usuario (frena fuerza bruta a una cuenta) y por IP (frena stuffing). */
export const LOGIN_USER_LIMIT = { max: 5, windowMs: 60_000 }
export const LOGIN_IP_LIMIT = { max: 20, windowMs: 60_000 }

export type LoginRateLimitResult = RateLimitResult & { scope: 'none' | 'usuario' | 'ip' }

export function checkLoginRateLimits(username: string, ip: string | null, now = Date.now()): LoginRateLimitResult {
    const byUser = checkRateLimit(`login:user:${username.trim().toLowerCase()}`, LOGIN_USER_LIMIT.max, LOGIN_USER_LIMIT.windowMs, now)
    if (!byUser.allowed) return { ...byUser, scope: 'usuario' }
    if (ip) {
        const byIp = checkRateLimit(`login:ip:${ip}`, LOGIN_IP_LIMIT.max, LOGIN_IP_LIMIT.windowMs, now)
        if (!byIp.allowed) return { ...byIp, scope: 'ip' }
    }
    return { allowed: true, retryAfterSeconds: 0, scope: 'none' }
}

/** Solo para tests. */
export function resetRateLimit() {
    store.clear()
}
