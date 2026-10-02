/**
 * PoC E2E — Guardian R-028 / AC-016 (no se ejecuta con `npm test`; es manual).
 *
 * Demuestra que los layouts de Next NO son frontera de seguridad y que cada página
 * de /admin tiene su guard propio. Una petición RSC con `Next-Router-State-Tree`
 * que declara (dashboard) y admin "ya renderizados" hace que el servidor ejecute
 * SOLO la página:
 *   - AGENCIA   → debe recibir "Acceso denegado" (sin usuarios ni correos).
 *   - REVOCADA  → debe recibir la redirección codificada a /api/auth/expired.
 *   - ADMIN     → control: SÍ recibe los datos (prueba que la petición omite layouts).
 *
 * Requisitos: servidor local arrancado (`npm run build && npm start`), `.env` con
 * DATABASE_URL/JWT_SECRET de la BD LOCAL y usuarios `gerencia` y `admin`.
 * Crea filas en `Sesion` (ip = 'poc'); bórralas después si molestan.
 *
 * Uso (bash):  set -a && . ./.env && set +a && npx tsx tests/e2e/rsc-admin-bypass.poc.ts
 */
import { PrismaClient } from '@prisma/client'
import { SignJWT } from 'jose'
import { randomUUID } from 'crypto'

const p = new PrismaClient()
const BASE = process.env.E2E_BASE ?? 'http://localhost:3000'

async function mintCookie(username: string, revoke = false) {
    const u = await p.usuario.findUnique({ where: { username } })
    if (!u) throw new Error('no existe ' + username)
    const sid = randomUUID()
    await p.sesion.create({ data: { id: sid, usuarioId: u.id, expiresAt: new Date(Date.now() + 3600_000), revokedAt: revoke ? new Date() : null, ip: 'poc' } })
    const key = new TextEncoder().encode(process.env.JWT_SECRET!)
    const token = await new SignJWT({ sid, userId: u.id, username: u.username, role: u.role, agenciaId: u.agenciaId })
        .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(key)
    return `session=${token}`
}

// Esquema de Next 16: [segmento, {paralelas}, url?|null, 'refetch'|'inside-shared-layout'|null, número?].
// El cliente declara que (dashboard) y admin YA están renderizados y solo pide la página (refetch).
function makeTree(leafSegment: string) {
    return encodeURIComponent(JSON.stringify(['', { children: ['(dashboard)', { children: ['admin', { children: [leafSegment, { children: ['__PAGE__', {}, null, 'refetch'] }] }] }] }, null, null]))
}

async function probe(label: string, cookie: string, path: string) {
    // Next responde 307 a /ruta?_rsc=... en la primera petición RSC: seguimos la
    // redirección conservando cookie y cabeceras (hasta 3 saltos) y registramos
    // si en algún salto nos manda fuera del área admin (login / expired).
    let url = BASE + path
    let r!: Response
    let hops: string[] = []
    for (let i = 0; i < 3; i++) {
        r = await fetch(url, { redirect: 'manual', headers: { cookie, RSC: '1', 'Next-Router-State-Tree': makeTree(path.split('/')[2]), 'Next-Url': path } })
        const loc = r.headers.get('location')
        if (r.status >= 300 && r.status < 400 && loc) { hops.push(loc); url = loc.startsWith('http') ? loc : BASE + loc; continue }
        break
    }
    const body = await r.text()
    // Un redirect() dentro de un Server Component viaja codificado en el payload RSC (NEXT_REDIRECT)
    const salida = hops.some(h => /\/login|\/api\/auth\/expired/.test(h)) || /NEXT_REDIRECT|\/api\/auth\/expired|\/login/.test(body)
    // Fuga = datos de OTROS usuarios (la propia sesión siempre viaja en el layout)
    const leak = /talento/.test(body) && /mensajero/.test(body)
    const denied = /Acceso denegado|403/.test(body)
    console.log(`${label.padEnd(36)} status=${r.status} saltos=${hops.length} salida=${salida} denegado=${denied} fuga=${leak} bytes=${body.length}`)
    return { status: r.status, leak, denied, salida }
}

async function main() {
    const agencia = await mintCookie('gerencia')
    const revocada = await mintCookie('gerencia', true)
    const admin = await mintCookie('admin')
    const a = await probe('AGENCIA + RSC tree (admin/usuarios)', agencia, '/admin/usuarios')
    const b = await probe('REVOCADA + RSC tree (admin/usuarios)', revocada, '/admin/usuarios')
    const c = await probe('ADMIN + RSC tree (control)', admin, '/admin/usuarios')
    const d = await probe('AGENCIA + RSC tree (admin/permisos)', agencia, '/admin/permisos')
    // El control ADMIN debe recibir los datos (prueba de que la petición RSC sí renderiza solo la página)
    const ok = !a.leak && a.denied && !b.leak && (b.salida || b.denied) && c.status === 200 && c.leak && !d.leak && d.denied
    console.log(ok ? 'POC R-028: OK (sin fuga)' : 'POC R-028: FALLA')
    process.exitCode = ok ? 0 : 1
}
main().finally(() => p.$disconnect())
