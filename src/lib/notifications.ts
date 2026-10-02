/**
 * Notificaciones (H-003 / C-011 — hallazgo B-05).
 *
 * El envío real de correo depende de credenciales SMTP del cliente (RADAR
 * R-021). Mientras tanto este módulo es el ÚNICO punto de salida: en
 * producción NO escribe datos personales en los logs; en desarrollo imprime un
 * resumen para depuración.
 */

export interface MailMessage {
    to: string[]
    subject: string
    /** Texto plano. Puede contener datos personales: no se registra en producción. */
    body: string
}

export type MailProvider = (msg: MailMessage) => Promise<void>

let provider: MailProvider | null = null

/** Permite registrar un proveedor real (p. ej. SMTP vía nodemailer) al arrancar. */
export function setMailProvider(p: MailProvider | null) {
    provider = p
}

export async function sendMail(msg: MailMessage): Promise<{ sent: boolean }> {
    const to = msg.to.filter(Boolean)
    if (to.length === 0) return { sent: false }
    if (provider) {
        try {
            await provider({ ...msg, to })
            return { sent: true }
        } catch (e) {
            console.error('[notificaciones] fallo al enviar correo:', e instanceof Error ? e.message : String(e))
            return { sent: false }
        }
    }
    if (process.env.NODE_ENV !== 'production') {
        console.log(`[EMAIL:dev] para=${to.length} destinatario(s) asunto="${msg.subject}"`)
    } else {
        console.log(`[notificaciones] proveedor de correo no configurado; ${to.length} aviso(s) omitido(s)`)
    }
    return { sent: false }
}
