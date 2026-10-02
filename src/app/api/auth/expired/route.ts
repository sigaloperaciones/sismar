import { NextRequest, NextResponse } from "next/server"
import { SESSION_COOKIE_NAME, SESSION_COOKIE_CLEAR_OPTIONS } from "@/lib/session-cookie"
import { resolveOrigin } from "@/lib/request-origin"

/**
 * GET /api/auth/expired — cierre de una sesión que ya no es válida en servidor
 * (H-003 / C-001). Los Server Components no pueden modificar cookies, así que
 * cuando `requireSession()` detecta una cookie cuya sesión fue revocada, expiró
 * o pertenece a un usuario eliminado, redirige aquí: esta ruta BORRA la cookie
 * (mismos atributos de seguridad, B-01) y envía al login. Sin este paso, el
 * middleware (que solo valida la firma del JWT, sin BD) volvería a enviar al
 * usuario a "/" y se produciría un bucle de redirecciones.
 */
export async function GET(request: NextRequest) {
    const origin = resolveOrigin({
        hostHeader: request.headers.get("host"),
        forwardedProto: request.headers.get("x-forwarded-proto"),
        fallbackHost: request.nextUrl.host,
        fallbackProto: request.nextUrl.protocol,
        allowedHosts: process.env.ALLOWED_HOSTS,
    })
    const response = NextResponse.redirect(`${origin}/login?expired=1`, { status: 303 })
    response.cookies.set({ name: SESSION_COOKIE_NAME, value: "", ...SESSION_COOKIE_CLEAR_OPTIONS })
    response.headers.set("Cache-Control", "no-store")
    return response
}
