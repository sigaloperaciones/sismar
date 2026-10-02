/**
 * Constantes de la cookie de sesión. Módulo SIN dependencias para que pueda
 * importarse tanto desde el runtime Edge (middleware) como desde Node.
 *
 * SEC-008 (Auditoría FOSCAL) + B-01 (Auditoría 2): los MISMOS atributos en
 * set, clear y en la limpieza que hace el middleware (incluido `path: '/'`).
 */
export const SESSION_COOKIE_NAME = 'session'

/** Expiración ABSOLUTA de la sesión (H-003 / C-001). Sin renovación rolling. */
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000

export const SESSION_COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
}

/**
 * Ruta que borra la cookie de una sesión ya inválida en servidor y envía al
 * login. Los Server Components no pueden escribir cookies; sin esta ruta, el
 * middleware (que no consulta la BD) devolvería al usuario a "/" en bucle.
 */
export const SESSION_EXPIRED_PATH = '/api/auth/expired'

/** Opciones para borrar la cookie (expira en el pasado) conservando los atributos. */
export const SESSION_COOKIE_CLEAR_OPTIONS = {
    ...SESSION_COOKIE_OPTIONS,
    expires: new Date(0),
}
