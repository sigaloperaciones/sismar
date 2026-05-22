import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('Seeding database...')

    // Clean up (orden respeta foreign keys)
    try {
        await prisma.usuarioPermiso.deleteMany()
        await prisma.rolPermiso.deleteMany()
        await prisma.permiso.deleteMany()
        await prisma.anexo.deleteMany()
        await prisma.correspondencia.deleteMany()
        await prisma.planilla.deleteMany()
        await prisma.usuario.deleteMany()
        await prisma.agencia.deleteMany()
        await prisma.centroCosto.deleteMany()
        await prisma.sede.deleteMany()
        await prisma.tipoAnexo.deleteMany()
        await prisma.empresaConfig.deleteMany()
    } catch (e) {
        console.log('Error limpiando tablas (pueden no existir aún):', e)
    }

    // ── EmpresaConfig ────────────────────────────────────────────────────────
    await prisma.empresaConfig.create({
        data: {
            nombre: 'Mi Empresa S.A.S.',
            nit: '900.123.456-7',
        },
    })

    // ── Estructura organizativa ───────────────────────────────────────────────
    const sedePrincipal = await prisma.sede.create({
        data: { name: 'Sede Principal', address: 'Calle 123 # 45-67' },
    })

    const ccAdmin = await prisma.centroCosto.create({
        data: { code: '001', name: 'Administración' },
    })
    const ccRecursos = await prisma.centroCosto.create({
        data: { code: '002', name: 'Recursos Humanos' },
    })

    const agenciaGerencia = await prisma.agencia.create({
        data: { name: 'Gerencia General', sedeId: sedePrincipal.id, centroCostoId: ccAdmin.id },
    })
    const agenciaTalento = await prisma.agencia.create({
        data: { name: 'Talento Humano', sedeId: sedePrincipal.id, centroCostoId: ccRecursos.id },
    })

    // ── Usuarios ──────────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash('123456', 10)

    await prisma.usuario.create({ data: { username: 'admin', password: passwordHash, role: 'ADMIN' } })
    await prisma.usuario.create({ data: { username: 'mensajero', password: passwordHash, role: 'MENSAJERO' } })
    await prisma.usuario.create({ data: { username: 'gerencia', password: passwordHash, role: 'AGENCIA', agenciaId: agenciaGerencia.id } })
    await prisma.usuario.create({ data: { username: 'talento', password: passwordHash, role: 'AGENCIA', agenciaId: agenciaTalento.id } })

    // ── Tipos de Anexo ────────────────────────────────────────────────────────
    for (const name of ['Documento', 'Paquete', 'CD', 'USB', 'Contrato', 'Tutela', 'Factura', 'Otro']) {
        await prisma.tipoAnexo.create({ data: { name } })
    }

    // ── Permisos ──────────────────────────────────────────────────────────────
    const permisosData = [
        // Correspondencia
        { codigo: 'correspondencia.entrante.ver', nombre: 'Ver Correspondencia Entrante', modulo: 'correspondencia' },
        { codigo: 'correspondencia.entrante.crear', nombre: 'Registrar Correspondencia Entrante', modulo: 'correspondencia' },
        { codigo: 'correspondencia.saliente.ver', nombre: 'Ver Correspondencia Saliente', modulo: 'correspondencia' },
        { codigo: 'correspondencia.saliente.crear', nombre: 'Registrar Correspondencia Saliente', modulo: 'correspondencia' },
        // Planillas
        { codigo: 'planillas.ver', nombre: 'Ver Planillas de Entrega', modulo: 'planillas' },
        { codigo: 'planillas.crear', nombre: 'Generar Planillas de Entrega', modulo: 'planillas' },
        // Recorridos
        { codigo: 'recorridos.ver', nombre: 'Ver Recorridos', modulo: 'recorridos' },
        { codigo: 'recorridos.gestionar', nombre: 'Confirmar/Devolver Entregas', modulo: 'recorridos' },
        // Reportes
        { codigo: 'reportes.ver', nombre: 'Ver Reportes', modulo: 'reportes' },
        // Admin
        { codigo: 'admin.usuarios.ver', nombre: 'Ver Usuarios', modulo: 'admin' },
        { codigo: 'admin.usuarios.gestionar', nombre: 'Crear/Editar/Eliminar Usuarios', modulo: 'admin' },
        { codigo: 'admin.config.ver', nombre: 'Ver Configuración de Empresa', modulo: 'admin' },
        { codigo: 'admin.config.gestionar', nombre: 'Editar Configuración de Empresa', modulo: 'admin' },
        { codigo: 'admin.permisos.ver', nombre: 'Ver Matriz de Permisos', modulo: 'admin' },
        { codigo: 'admin.permisos.gestionar', nombre: 'Editar Matriz de Permisos', modulo: 'admin' },
    ]

    const permisos = await Promise.all(
        permisosData.map(p => prisma.permiso.create({ data: p }))
    )

    const permisoMap = Object.fromEntries(permisos.map(p => [p.codigo, p.id]))

    // ── RolPermiso por defecto ────────────────────────────────────────────────
    const rolPermisosData: Array<{ rol: string; codigo: string; concedido: boolean }> = [
        // ADMIN: todos los permisos
        ...permisosData.map(p => ({ rol: 'ADMIN', codigo: p.codigo, concedido: true })),

        // MENSAJERO
        { rol: 'MENSAJERO', codigo: 'correspondencia.entrante.ver', concedido: true },
        { rol: 'MENSAJERO', codigo: 'correspondencia.saliente.ver', concedido: true },
        { rol: 'MENSAJERO', codigo: 'planillas.ver', concedido: true },
        { rol: 'MENSAJERO', codigo: 'recorridos.ver', concedido: true },
        { rol: 'MENSAJERO', codigo: 'recorridos.gestionar', concedido: true },

        // AGENCIA
        { rol: 'AGENCIA', codigo: 'correspondencia.entrante.ver', concedido: true },
        { rol: 'AGENCIA', codigo: 'correspondencia.entrante.crear', concedido: true },
        { rol: 'AGENCIA', codigo: 'correspondencia.saliente.ver', concedido: true },
        { rol: 'AGENCIA', codigo: 'correspondencia.saliente.crear', concedido: true },
        { rol: 'AGENCIA', codigo: 'planillas.ver', concedido: true },
        { rol: 'AGENCIA', codigo: 'reportes.ver', concedido: true },
    ]

    for (const rp of rolPermisosData) {
        const permisoId = permisoMap[rp.codigo]
        if (permisoId) {
            await prisma.rolPermiso.create({
                data: { rol: rp.rol, permisoId, concedido: rp.concedido },
            })
        }
    }

    console.log('✅ Seed completado.')
}

main()
    .then(async () => { await prisma.$disconnect() })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
