/**
 * Exportación CSV segura (Guardian R-037 — inyección de fórmulas, OWASP A03).
 *
 * Excel/LibreOffice interpretan como fórmula una celda que empieza por
 * `=`, `+`, `-`, `@`, tabulador o retorno de carro. Un usuario podría guardar
 * `=HYPERLINK("http://atacante.test","…")` en un asunto y ejecutarlo en el
 * equipo de quien exporte el reporte. Se antepone un apóstrofo a esas celdas.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/

export function csvSafe(value: string): string {
    return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

/** Celda CSV completa: neutraliza fórmulas, escapa comillas y envuelve en comillas. */
export function csvCell(value: unknown): string {
    const text = value === null || value === undefined ? '' : String(value)
    return `"${csvSafe(text).replace(/"/g, '""')}"`
}
