import { randomInt } from "crypto"

/**
 * Generador de contraseñas fuertes.
 * (Apoyo a SEC-020 / rotación de usuarios seed — Auditoría FOSCAL.)
 *
 * Garantiza que la contraseña cumple la política de `lib/schemas/admin.ts`:
 * ≥ 8 caracteres con al menos una mayúscula, una minúscula y un número.
 * Por defecto genera 16 caracteres (incluye símbolos) para credenciales reales.
 */
const LOWER = "abcdefghijkmnpqrstuvwxyz"   // sin l
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"   // sin I, O
const DIGIT = "23456789"                   // sin 0, 1
const SYMBOL = "!@#$%*?-_"
const ALL = LOWER + UPPER + DIGIT + SYMBOL

function pick(alphabet: string): string {
    return alphabet[randomInt(0, alphabet.length)]
}

export function generateStrongPassword(length = 16): string {
    if (length < 8) length = 8
    // Garantiza la presencia de cada clase requerida por la política
    const required = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SYMBOL)]
    const rest = Array.from({ length: length - required.length }, () => pick(ALL))
    const chars = [...required, ...rest]

    // Barajado Fisher-Yates con aleatoriedad criptográfica
    for (let i = chars.length - 1; i > 0; i--) {
        const j = randomInt(0, i + 1)
        ;[chars[i], chars[j]] = [chars[j], chars[i]]
    }
    return chars.join("")
}
