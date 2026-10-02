import { prisma } from './prisma'
import { getClientIp } from './request-meta'

/**
 * Bitácora de auditoría (H-003 / C-011 — hallazgo M-07).
 *
 * `audit()` NUNCA interrumpe la operación de negocio: cualquier fallo al
 * escribir se registra en consola (solo el mensaje) y se continúa.
 * La tabla es append-only desde la aplicación.
 */

export type AuditAction =
    | 'LOGIN_OK'
    | 'LOGIN_FALLIDO'
    | 'LOGIN_BLOQUEADO'
    | 'LOGIN_LIMITADO'
    | 'LOGOUT'
    | 'ACCESO_DENEGADO'
    | 'CORRESPONDENCIA_CREAR'
    | 'CORRESPONDENCIA_EDITAR'
    | 'CORRESPONDENCIA_APROBAR'
    | 'CORRESPONDENCIA_DEVOLVER'
    | 'PLANILLA_GENERAR'
    | 'PLANILLA_CERRAR'
    | 'PLANILLA_REABRIR'
    | 'PLANILLA_PROCESAR'
    | 'PLANILLA_RETIRAR_ITEM'
    | 'PLANILLA_FIRMA'
    | 'RECORRIDO_CREAR'
    | 'RECORRIDO_ANULAR'
    | 'CATALOGO_CREAR'
    | 'CATALOGO_EDITAR'
    | 'CATALOGO_ELIMINAR'
    | 'USUARIO_CREAR'
    | 'USUARIO_EDITAR'
    | 'USUARIO_ELIMINAR'
    | 'PERMISOS_EDITAR'
    | 'CONFIG_EDITAR'
    | 'ARCHIVO_SUBIR'
    | 'ARCHIVO_DENEGADO'
    | 'SESIONES_REVOCADAS'

export interface AuditEntry {
    /** Usuario que ejecuta (null en login fallido / sin sesión). */
    ctx?: { userId: number; username: string } | null
    /** Para login fallido: nombre de usuario intentado (no existe sesión). */
    username?: string | null
    accion: AuditAction
    entidad?: string
    entidadId?: number | string | null
    detalle?: Record<string, unknown>
    /** Si no se pasa, se intenta obtener de las cabeceras de la petición. */
    ip?: string | null
}

export async function audit(entry: AuditEntry): Promise<void> {
    try {
        const ip = entry.ip === undefined ? await getClientIp() : entry.ip
        await prisma.auditLog.create({
            data: {
                usuarioId: entry.ctx?.userId ?? null,
                username: entry.ctx?.username ?? entry.username ?? null,
                accion: entry.accion,
                entidad: entry.entidad ?? null,
                entidadId: entry.entidadId === undefined || entry.entidadId === null ? null : String(entry.entidadId),
                detalle: entry.detalle === undefined ? undefined : JSON.parse(JSON.stringify(entry.detalle)),
                ip: ip ?? null,
            },
        })
    } catch (e) {
        console.error('[audit] no se pudo registrar la bitácora:', e instanceof Error ? e.message : String(e))
    }
}
