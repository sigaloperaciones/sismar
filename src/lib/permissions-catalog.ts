/**
 * Catálogo ÚNICO de permisos y permisos por defecto de cada rol.
 * Sin dependencias (lo importan la app, el seed y el script de sincronización).
 *
 * H-003 añade:
 *  - `planillas.gestionar`      → cerrar/reabrir/retirar ítems/subir firma (C-004).
 *  - `correspondencia.recibir`  → aprobar/devolver piezas y procesar la planilla
 *                                 recibida como agencia (C-003, C-004).
 */
export const PERMISOS = {
    ENTRANTE_VER: 'correspondencia.entrante.ver',
    ENTRANTE_CREAR: 'correspondencia.entrante.crear',
    SALIENTE_VER: 'correspondencia.saliente.ver',
    SALIENTE_CREAR: 'correspondencia.saliente.crear',
    RECIBIR: 'correspondencia.recibir',
    PLANILLAS_VER: 'planillas.ver',
    PLANILLAS_CREAR: 'planillas.crear',
    PLANILLAS_GESTIONAR: 'planillas.gestionar',
    RECORRIDOS_VER: 'recorridos.ver',
    RECORRIDOS_GESTIONAR: 'recorridos.gestionar',
    REPORTES_VER: 'reportes.ver',
    ADMIN_USUARIOS_VER: 'admin.usuarios.ver',
    ADMIN_USUARIOS_GESTIONAR: 'admin.usuarios.gestionar',
    ADMIN_CONFIG_VER: 'admin.config.ver',
    ADMIN_CONFIG_GESTIONAR: 'admin.config.gestionar',
    ADMIN_PERMISOS_VER: 'admin.permisos.ver',
    ADMIN_PERMISOS_GESTIONAR: 'admin.permisos.gestionar',
} as const

export type PermisoCodigo = (typeof PERMISOS)[keyof typeof PERMISOS]

export interface PermisoDef {
    codigo: PermisoCodigo
    nombre: string
    modulo: string
    descripcion?: string
}

export const PERMISOS_CATALOGO: PermisoDef[] = [
    { codigo: PERMISOS.ENTRANTE_VER, nombre: 'Ver Correspondencia Entrante', modulo: 'correspondencia' },
    { codigo: PERMISOS.ENTRANTE_CREAR, nombre: 'Registrar Correspondencia Entrante', modulo: 'correspondencia' },
    { codigo: PERMISOS.SALIENTE_VER, nombre: 'Ver Correspondencia Saliente', modulo: 'correspondencia' },
    { codigo: PERMISOS.SALIENTE_CREAR, nombre: 'Registrar Correspondencia Saliente', modulo: 'correspondencia' },
    { codigo: PERMISOS.RECIBIR, nombre: 'Recibir correspondencia (aprobar/devolver y procesar planilla)', modulo: 'correspondencia',
      descripcion: 'Permite a la agencia confirmar o devolver las piezas que le llegan en un recorrido.' },
    { codigo: PERMISOS.PLANILLAS_VER, nombre: 'Ver Planillas de Entrega', modulo: 'planillas' },
    { codigo: PERMISOS.PLANILLAS_CREAR, nombre: 'Generar Planillas de Entrega', modulo: 'planillas' },
    { codigo: PERMISOS.PLANILLAS_GESTIONAR, nombre: 'Gestionar Planillas (cerrar, reabrir, retirar ítems, subir firma)', modulo: 'planillas' },
    { codigo: PERMISOS.RECORRIDOS_VER, nombre: 'Ver Recorridos', modulo: 'recorridos' },
    { codigo: PERMISOS.RECORRIDOS_GESTIONAR, nombre: 'Iniciar/Anular Recorridos', modulo: 'recorridos' },
    { codigo: PERMISOS.REPORTES_VER, nombre: 'Ver Reportes', modulo: 'reportes' },
    { codigo: PERMISOS.ADMIN_USUARIOS_VER, nombre: 'Ver Usuarios', modulo: 'admin' },
    { codigo: PERMISOS.ADMIN_USUARIOS_GESTIONAR, nombre: 'Crear/Editar/Eliminar Usuarios', modulo: 'admin' },
    { codigo: PERMISOS.ADMIN_CONFIG_VER, nombre: 'Ver Configuración de Empresa', modulo: 'admin' },
    { codigo: PERMISOS.ADMIN_CONFIG_GESTIONAR, nombre: 'Editar Configuración de Empresa', modulo: 'admin' },
    { codigo: PERMISOS.ADMIN_PERMISOS_VER, nombre: 'Ver Matriz de Permisos', modulo: 'admin' },
    { codigo: PERMISOS.ADMIN_PERMISOS_GESTIONAR, nombre: 'Editar Matriz de Permisos', modulo: 'admin' },
]

export type RolNombre = 'ADMIN' | 'MENSAJERO' | 'AGENCIA'

/** Permisos concedidos por defecto a cada rol (el ADMIN recibe todos). */
export const ROL_PERMISOS_DEFAULT: Record<RolNombre, PermisoCodigo[]> = {
    ADMIN: PERMISOS_CATALOGO.map(p => p.codigo),
    MENSAJERO: [
        PERMISOS.ENTRANTE_VER,
        PERMISOS.SALIENTE_VER,
        PERMISOS.PLANILLAS_VER,
        PERMISOS.PLANILLAS_CREAR,
        PERMISOS.PLANILLAS_GESTIONAR,
        PERMISOS.RECORRIDOS_VER,
        PERMISOS.RECORRIDOS_GESTIONAR,
    ],
    AGENCIA: [
        PERMISOS.ENTRANTE_VER,
        PERMISOS.ENTRANTE_CREAR,
        PERMISOS.SALIENTE_VER,
        PERMISOS.SALIENTE_CREAR,
        PERMISOS.RECIBIR,
        PERMISOS.PLANILLAS_VER,
        PERMISOS.REPORTES_VER,
    ],
}
