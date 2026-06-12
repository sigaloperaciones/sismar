import { prisma } from '@/lib/prisma'

/**
 * Server Component que inyecta los colores de marca de EmpresaConfig
 * como CSS custom properties en :root, sobreescribiendo los valores por defecto.
 * Al ser Server Component se ejecuta en cada request sin caché (usa Prisma directamente).
 */
export async function ThemeInjector() {
    const config = await prisma.empresaConfig.findFirst()

    if (!config) return null

    const overrides = [
        config.colorPrimary ? `--primary: ${config.colorPrimary};` : null,
        config.colorSecondary ? `--secondary: ${config.colorSecondary};` : null,
        config.colorAccent ? `--accent: ${config.colorAccent};` : null,
    ].filter(Boolean)

    if (overrides.length === 0) return null

    const css = `:root { ${overrides.join(' ')} }`

    // eslint-disable-next-line react/no-danger
    return <style dangerouslySetInnerHTML={{ __html: css }} />
}
