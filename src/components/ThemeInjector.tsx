import { prisma } from '@/lib/prisma'
import { sanitizeHsl } from '@/lib/branding'

/**
 * Server Component que inyecta los colores de marca de EmpresaConfig
 * como CSS custom properties en :root, sobreescribiendo los valores por defecto.
 *
 * H-003 / C-010 (M-06): defensa en profundidad. Aunque el esquema Zod ya valida
 * el formato HSL al guardar, aquí se RE-VALIDA cada valor antes de escribirlo
 * en el <style>: un valor que no cumpla el formato se descarta en silencio. Así,
 * ni siquiera un dato inyectado directamente en la base puede cerrar la etiqueta.
 */
export async function ThemeInjector() {
    const config = await prisma.empresaConfig.findFirst()

    if (!config) return null

    const primary = sanitizeHsl(config.colorPrimary)
    const secondary = sanitizeHsl(config.colorSecondary)
    const accent = sanitizeHsl(config.colorAccent)

    const overrides = [
        primary ? `--primary: ${primary};` : null,
        secondary ? `--secondary: ${secondary};` : null,
        accent ? `--accent: ${accent};` : null,
    ].filter(Boolean)

    if (overrides.length === 0) return null

    const css = `:root { ${overrides.join(' ')} }`

    // eslint-disable-next-line react/no-danger
    return <style dangerouslySetInnerHTML={{ __html: css }} />
}
