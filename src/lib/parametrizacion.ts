/**
 * Utilidades de parametrización (Centros de Costo / Sedes).
 * Atiende comentarios del cliente: falta administración de estas entidades.
 */

/**
 * Calcula el siguiente código correlativo de Centro de Costo con relleno a 3 dígitos.
 * Ignora códigos no numéricos. Base vacía -> "001".
 *   []                 -> "001"
 *   ["001","002"]      -> "003"
 *   ["001","002","010"]-> "011"
 */
export function nextCentroCostoCode(existingCodes: string[]): string {
    const maxNum = existingCodes.reduce((max, c) => {
        const n = parseInt(c, 10)
        return Number.isNaN(n) ? max : Math.max(max, n)
    }, 0)
    return String(maxNum + 1).padStart(3, '0')
}
