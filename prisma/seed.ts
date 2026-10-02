/**
 * Seed de SISMAR — NO DESTRUCTIVO (H-003 / C-012 — hallazgo M-02).
 *
 *  - Jamás borra datos: catálogos y permisos se sincronizan con upsert.
 *  - Los usuarios iniciales solo se crean si la tabla `Usuario` está VACÍA.
 *  - Sin credenciales conocidas: cada contraseña viene de una variable de
 *    entorno (SEED_ADMIN_PASSWORD, SEED_MENSAJERO_PASSWORD, SEED_GERENCIA_PASSWORD,
 *    SEED_TALENTO_PASSWORD) o, si falta, se GENERA una contraseña fuerte que se
 *    imprime UNA sola vez en pantalla (nunca se escribe a disco ni a logs).
 *  - En producción (NODE_ENV=production) aborta salvo SEED_ALLOW_PRODUCTION=1.
 *
 * Uso:
 *   npx tsx prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
import { generateStrongPassword } from '../src/lib/password'
import { syncPermissions } from '../src/lib/permissions-sync'

const prisma = new PrismaClient()

const BCRYPT_COST = 12

async function main() {
    if (process.env.NODE_ENV === 'production' && process.env.SEED_ALLOW_PRODUCTION !== '1') {
        console.error('✖ Seed bloqueado: NODE_ENV=production. Si realmente desea sembrar una base NUEVA, exporte SEED_ALLOW_PRODUCTION=1.')
        process.exit(2)
    }

    console.log('Seeding database (modo no destructivo)...')

    // ── EmpresaConfig (solo si no existe) ────────────────────────────────────
    const configCount = await prisma.empresaConfig.count()
    if (configCount === 0) {
        await prisma.empresaConfig.create({
            data: { nombre: 'Mi Empresa S.A.S.', nit: '900.123.456-7' },
        })
        console.log('  · EmpresaConfig inicial creada')
    }

    // ── Estructura organizativa (upsert por nombre/código) ───────────────────
    let sedePrincipal = await prisma.sede.findFirst({ where: { name: 'Sede Principal' } })
    if (!sedePrincipal) {
        sedePrincipal = await prisma.sede.create({ data: { name: 'Sede Principal', address: 'Calle 123 # 45-67' } })
    }

    const ccAdmin = await prisma.centroCosto.upsert({
        where: { code: '001' },
        create: { code: '001', name: 'Administración' },
        update: {},
    })
    const ccRecursos = await prisma.centroCosto.upsert({
        where: { code: '002' },
        create: { code: '002', name: 'Recursos Humanos' },
        update: {},
    })

    async function ensureAgencia(name: string, centroCostoId: number) {
        const existing = await prisma.agencia.findFirst({ where: { name } })
        if (existing) return existing
        return prisma.agencia.create({ data: { name, sedeId: sedePrincipal!.id, centroCostoId } })
    }
    const agenciaGerencia = await ensureAgencia('Gerencia General', ccAdmin.id)
    const agenciaTalento = await ensureAgencia('Talento Humano', ccRecursos.id)

    // ── Tipos de Anexo ───────────────────────────────────────────────────────
    for (const name of ['Documento', 'Paquete', 'CD', 'USB', 'Contrato', 'Tutela', 'Factura', 'Otro']) {
        await prisma.tipoAnexo.upsert({ where: { name }, create: { name }, update: {} })
    }

    // ── Permisos y permisos por rol (catálogo único, idempotente) ────────────
    const sync = await syncPermissions(prisma)
    console.log(`  · Permisos sincronizados: ${sync.permisos} permisos, ${sync.rolPermisosCreados} asignaciones de rol nuevas`)

    // ── Usuarios iniciales: SOLO si la tabla está vacía ──────────────────────
    const userCount = await prisma.usuario.count()
    if (userCount > 0) {
        console.log(`  · La base ya tiene ${userCount} usuario(s): no se crean usuarios iniciales.`)
    } else {
        const definiciones = [
            { username: 'admin', role: 'ADMIN' as const, agenciaId: null, env: 'SEED_ADMIN_PASSWORD' },
            { username: 'mensajero', role: 'MENSAJERO' as const, agenciaId: null, env: 'SEED_MENSAJERO_PASSWORD' },
            { username: 'gerencia', role: 'AGENCIA' as const, agenciaId: agenciaGerencia.id, env: 'SEED_GERENCIA_PASSWORD' },
            { username: 'talento', role: 'AGENCIA' as const, agenciaId: agenciaTalento.id, env: 'SEED_TALENTO_PASSWORD' },
        ]

        // R-039: una contraseña de entorno inválida ABORTA (no se genera otra en silencio).
        const cumplePolitica = (p: string) => p.length >= 8 && /[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p)
        for (const d of definiciones) {
            const fromEnv = process.env[d.env]
            if (fromEnv !== undefined && !cumplePolitica(fromEnv)) {
                console.error(`✖ ${d.env} no cumple la política (≥ 8 caracteres con mayúscula, minúscula y número). No se crea ningún usuario.`)
                process.exit(3)
            }
        }

        const generadas: Array<{ usuario: string; clave: string }> = []
        for (const d of definiciones) {
            const fromEnv = process.env[d.env]
            const clave = fromEnv ?? generateStrongPassword(16)
            if (!fromEnv) generadas.push({ usuario: d.username, clave })
            const hash = await bcrypt.hash(clave, BCRYPT_COST)
            await prisma.usuario.create({
                data: { username: d.username, password: hash, role: d.role, agenciaId: d.agenciaId },
            })
        }
        console.log(`  · ${definiciones.length} usuarios iniciales creados`)

        if (generadas.length > 0) {
            console.log('\n  Contraseñas GENERADAS (guárdelas AHORA en un gestor seguro; no se volverán a mostrar):\n')
            console.log('  ┌───────────────┬──────────────────────┐')
            console.log('  │ USUARIO       │ CONTRASEÑA           │')
            console.log('  ├───────────────┼──────────────────────┤')
            for (const g of generadas) console.log(`  │ ${g.usuario.padEnd(13)} │ ${g.clave.padEnd(20)} │`)
            console.log('  └───────────────┴──────────────────────┘\n')
        }
    }

    console.log('✅ Seed completado.')
}

main()
    .then(async () => { await prisma.$disconnect() })
    .catch(async (e) => {
        console.error('Error en seed:', e instanceof Error ? e.message : String(e))
        await prisma.$disconnect()
        process.exit(1)
    })
