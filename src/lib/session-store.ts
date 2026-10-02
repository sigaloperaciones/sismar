import { randomUUID } from 'crypto'
import { prisma } from './prisma'
import { SESSION_TTL_MS } from './session-cookie'

/**
 * Store de sesiones en base de datos (H-003 / C-001 — hallazgo A-05).
 *
 * - `createSession` emite un identificador aleatorio (`sid`) que viaja en el JWT.
 * - `resolveSession` es la ÚNICA fuente de verdad para autorizar: devuelve la
 *   sesión viva y el usuario con rol/agencia FRESCOS. Si la sesión fue revocada,
 *   expiró o el usuario ya no existe, devuelve null.
 * - `revokeSession` / `revokeAllSessions` implementan logout server-side y la
 *   invalidación al cambiar rol, agencia o contraseña, o al eliminar al usuario.
 */

/** Actualiza `lastSeenAt` como máximo una vez cada 5 minutos por sesión. */
const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000

export interface ResolvedSession {
    session: { id: string; usuarioId: number; expiresAt: Date }
    user: {
        id: number
        username: string
        role: import('@prisma/client').Role
        agenciaId: number | null
    }
}

export async function createSession(input: {
    userId: number
    ip?: string | null
    userAgent?: string | null
    now?: Date
}): Promise<{ id: string; expiresAt: Date }> {
    const now = input.now ?? new Date()
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
    const id = randomUUID()
    await prisma.sesion.create({
        data: {
            id,
            usuarioId: input.userId,
            expiresAt,
            ip: input.ip ?? null,
            userAgent: input.userAgent ? input.userAgent.slice(0, 300) : null,
        },
    })
    return { id, expiresAt }
}

export async function resolveSession(sid: string, now: Date = new Date()): Promise<ResolvedSession | null> {
    if (!sid || typeof sid !== 'string') return null

    const row = await prisma.sesion.findUnique({
        where: { id: sid },
        include: {
            usuario: { select: { id: true, username: true, role: true, agenciaId: true } },
        },
    })

    if (!row) return null
    if (row.revokedAt) return null
    if (row.expiresAt.getTime() <= now.getTime()) return null
    if (!row.usuario) return null

    if (now.getTime() - row.lastSeenAt.getTime() > LAST_SEEN_THROTTLE_MS) {
        // Fire-and-forget: nunca debe fallar la petición por esta escritura.
        prisma.sesion
            .update({ where: { id: sid }, data: { lastSeenAt: now } })
            .catch(() => undefined)
    }

    return {
        session: { id: row.id, usuarioId: row.usuarioId, expiresAt: row.expiresAt },
        user: row.usuario,
    }
}

export async function revokeSession(sid: string, now: Date = new Date()): Promise<void> {
    if (!sid) return
    await prisma.sesion.updateMany({
        where: { id: sid, revokedAt: null },
        data: { revokedAt: now },
    })
}

export async function revokeAllSessions(userId: number, now: Date = new Date()): Promise<number> {
    const res = await prisma.sesion.updateMany({
        where: { usuarioId: userId, revokedAt: null },
        data: { revokedAt: now },
    })
    return res.count
}

/** Limpieza operativa: elimina sesiones expiradas o revocadas hace más de `olderThanDays`. */
export async function purgeSessions(olderThanDays = 7, now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - olderThanDays * 24 * 60 * 60 * 1000)
    const res = await prisma.sesion.deleteMany({
        where: {
            OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
        },
    })
    return res.count
}
