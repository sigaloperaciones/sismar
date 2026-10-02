/**
 * Migra los archivos legados de `public/uploads` al directorio PRIVADO y
 * reescribe las URLs almacenadas (H-003 / C-006 — hallazgo A-06).
 *
 *  - Mueve cada archivo de public/uploads → UPLOADS_DIR (o storage/uploads).
 *  - Reescribe `/uploads/<x>` → `/api/uploads?filename=<x>` en
 *    Correspondencia.guiaUrl, Correspondencia.documentoRecibidoUrl,
 *    Planilla.documentoFirmaUrl y EmpresaConfig.logoUrl.
 *  - Idempotente: puede ejecutarse varias veces. Con `--dry-run` solo informa.
 *
 * Uso (en el servidor, con la app detenida o justo antes de reiniciarla):
 *   npx tsx prisma/migrate-uploads.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client'
import { promises as fs } from 'fs'
import path from 'path'
import { defaultUploadsDir, isInsidePublicDir, legacyPublicUploadsDir, uploadUrlFor } from '../src/lib/uploads'

const prisma = new PrismaClient()
const dryRun = process.argv.includes('--dry-run')

async function resolveTargetDir(): Promise<string> {
    let candidate = process.env.UPLOADS_DIR?.trim()
    if (!candidate) {
        const cfg = await prisma.empresaConfig.findFirst({ select: { uploadsDir: true } })
        candidate = cfg?.uploadsDir?.trim() || undefined
    }
    let dir = candidate ? (path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate)) : defaultUploadsDir()
    if (isInsidePublicDir(dir)) {
        console.warn(`  ⚠ El directorio configurado (${dir}) está dentro de public/; se usa ${defaultUploadsDir()}`)
        dir = defaultUploadsDir()
    }
    return dir
}

function rewriteUrl(url: string | null): string | null {
    if (!url || !url.startsWith('/uploads/')) return null
    const name = path.basename(url.slice('/uploads/'.length).split('?')[0])
    return name ? uploadUrlFor(name) : null
}

async function main() {
    const targetDir = await resolveTargetDir()
    const legacyDir = legacyPublicUploadsDir()
    console.log(`Migración de uploads${dryRun ? ' (DRY-RUN)' : ''}`)
    console.log(`  origen : ${legacyDir}`)
    console.log(`  destino: ${targetDir}`)

    // 1) Mover archivos
    let movidos = 0
    try {
        const entries = await fs.readdir(legacyDir, { withFileTypes: true })
        if (!dryRun) await fs.mkdir(targetDir, { recursive: true })
        for (const e of entries) {
            if (!e.isFile()) continue
            const from = path.join(legacyDir, e.name)
            const to = path.join(targetDir, e.name)
            try {
                await fs.access(to)
                console.log(`  · ya existe en destino, se omite: ${e.name}`)
                continue
            } catch { /* no existe: mover */ }
            if (!dryRun) await fs.rename(from, to).catch(async () => {
                // rename falla entre volúmenes: copiar + borrar
                await fs.copyFile(from, to)
                await fs.unlink(from)
            })
            movidos++
            console.log(`  · movido: ${e.name}`)
        }
    } catch (e) {
        console.log(`  · sin directorio legado (${e instanceof Error ? e.message : String(e)})`)
    }

    // 2) Reescribir URLs
    let reescritas = 0
    const piezas = await prisma.correspondencia.findMany({
        where: { OR: [{ guiaUrl: { startsWith: '/uploads/' } }, { documentoRecibidoUrl: { startsWith: '/uploads/' } }] },
        select: { id: true, guiaUrl: true, documentoRecibidoUrl: true },
    })
    for (const p of piezas) {
        const data: { guiaUrl?: string; documentoRecibidoUrl?: string } = {}
        const g = rewriteUrl(p.guiaUrl); if (g) data.guiaUrl = g
        const d = rewriteUrl(p.documentoRecibidoUrl); if (d) data.documentoRecibidoUrl = d
        if (Object.keys(data).length === 0) continue
        if (!dryRun) await prisma.correspondencia.update({ where: { id: p.id }, data })
        reescritas++
    }
    const planillas = await prisma.planilla.findMany({
        where: { documentoFirmaUrl: { startsWith: '/uploads/' } },
        select: { id: true, documentoFirmaUrl: true },
    })
    for (const pl of planillas) {
        const u = rewriteUrl(pl.documentoFirmaUrl)
        if (!u) continue
        if (!dryRun) await prisma.planilla.update({ where: { id: pl.id }, data: { documentoFirmaUrl: u } })
        reescritas++
    }
    const cfg = await prisma.empresaConfig.findFirst({ select: { id: true, logoUrl: true } })
    if (cfg) {
        const u = rewriteUrl(cfg.logoUrl)
        if (u) {
            if (!dryRun) await prisma.empresaConfig.update({ where: { id: cfg.id }, data: { logoUrl: u } })
            reescritas++
        }
    }

    console.log(`\n✅ ${movidos} archivo(s) movido(s), ${reescritas} URL(s) reescrita(s)${dryRun ? ' (simulación)' : ''}.`)
}

main()
    .then(async () => { await prisma.$disconnect() })
    .catch(async e => {
        console.error('Error migrando uploads:', e instanceof Error ? e.message : String(e))
        await prisma.$disconnect()
        process.exit(1)
    })
