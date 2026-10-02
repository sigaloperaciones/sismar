/**
 * Genera el Informe de Remediación — Auditoría de Seguridad y Arquitectura N.º 2 (SISMAR)
 * en formato Word (.docx), con la marca "By AISerNet Company" (NEBULA 10 pt) embebida.
 *
 * Uso (bash):
 *   NODE_PATH=%TEMP%/docxgen/node_modules node docs/auditoria/fuente/informe-remediacion-auditoria-2.cjs [salida.docx]
 * Requiere `docx@9` instalado en una carpeta temporal (no forma parte del proyecto) y la
 * fuente NEBULA en `public/fonts/NEBULA-Regular.otf` (o la variable NEBULA_FONT).
 *
 * Guardian: el informe no contiene secretos, IPs, puertos ni dominios reales.
 */
const fs = require("fs")
const path = require("path")
const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
    AlignmentType, HeadingLevel, BorderStyle, PageBreak, Header, Footer, PageNumber, LevelFormat,
    CharacterSet, TableLayoutType, VerticalAlign,
} = require("docx")

const ROOT = path.resolve(__dirname, "..", "..", "..")
const OUT = process.argv[2] || path.join(ROOT, "docs", "auditoria", "Informe_Remediacion_Auditoria2_SISMAR_ASIA.docx")
const FONT_FILE = process.env.NEBULA_FONT || path.join(ROOT, "public", "fonts", "NEBULA-Regular.otf")

// ── Paleta y tipografía ───────────────────────────────────────────────────────
const C = { ink: "1B3D3D", teal: "0F766E", tealSoft: "E6F4F2", grey: "5B6B6B", line: "C9D6D6", bgSoft: "F3F7F7",
    okBg: "DCFCE7", okFg: "166534", warnBg: "FEF3C7", warnFg: "92400E", redBg: "FEE2E2", redFg: "991B1B", white: "FFFFFF" }
const BODY = "Calibri"
const BRAND = "NEBULA"
const PAGE_W = 12240, PAGE_H = 15840, MARGIN = 1080 // Carta, márgenes 0,75"
const CONTENT_W = PAGE_W - 2 * MARGIN // 10080 DXA

// ── Utilidades ────────────────────────────────────────────────────────────────
const t = (text, opts = {}) => new TextRun({ text, font: BODY, size: 21, color: C.ink, ...opts })
const p = (children, opts = {}) => new Paragraph({ spacing: { after: 120, line: 276 }, ...opts, children: Array.isArray(children) ? children : [typeof children === "string" ? t(children) : children] })
const h1 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 360, after: 160 }, children: [new TextRun({ text, font: BODY, size: 32, bold: true, color: C.teal })] })
const h2 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, spacing: { before: 240, after: 120 }, children: [new TextRun({ text, font: BODY, size: 25, bold: true, color: C.ink })] })
const h3 = (text) => new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 80 }, keepNext: true, children: [new TextRun({ text, font: BODY, size: 22, bold: true, color: C.teal })] })
const bullet = (text, ref = "bullets", instance = 0) => new Paragraph({ numbering: { reference: ref, level: 0, instance }, spacing: { after: 80, line: 276 }, children: typeof text === "string" ? [t(text)] : text })
// Cada lista numerada usa una instancia distinta para que la numeración reinicie en 1.
let numInstance = 0
const numList = () => { numInstance++; return (text) => bullet(text, "numeros", numInstance) }
const bold = (text) => t(text, { bold: true })
const code = (text) => new TextRun({ text, font: "Consolas", size: 19, color: C.ink, shading: { type: ShadingType.CLEAR, fill: "EEF3F3", color: "auto" } })
const pageBreak = () => new Paragraph({ children: [new PageBreak()] })
const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] })

const noBorder = { style: BorderStyle.NONE, size: 0, color: C.white }
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder }
const thin = { style: BorderStyle.SINGLE, size: 4, color: C.line }
const tableBorders = { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin }

function cell(content, width, opts = {}) {
    const children = (Array.isArray(content) ? content : [content]).map(c =>
        c instanceof Paragraph ? c : new Paragraph({ spacing: { after: 40, line: 252 }, alignment: opts.align, children: Array.isArray(c) ? c : [typeof c === "string" ? t(c, { size: opts.size || 19, bold: opts.bold, color: opts.color }) : c] })
    )
    return new TableCell({
        width: { size: width, type: WidthType.DXA },
        margins: { top: 70, bottom: 70, left: 100, right: 100 },
        verticalAlign: opts.vAlign || VerticalAlign.CENTER,
        shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } : undefined,
        children,
    })
}

function table(columnWidths, rows, opts = {}) {
    return new Table({
        width: { size: columnWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
        columnWidths,
        layout: TableLayoutType.FIXED,
        borders: opts.borders || tableBorders,
        rows,
    })
}

function headerRow(labels, widths) {
    return new TableRow({ tableHeader: true, children: labels.map((l, i) => cell(l, widths[i], { fill: C.ink, color: C.white, bold: true, size: 18 })) })
}

function statusCell(estado, width) {
    const map = { RESUELTO: [C.okBg, C.okFg], CERRADO: [C.okBg, C.okFg], "RIESGO ACEPTADO": [C.warnBg, C.warnFg], RESIDUAL: [C.warnBg, C.warnFg], ABIERTO: [C.warnBg, C.warnFg], "DECISIÓN": [C.redBg, C.redFg], PENDIENTE: [C.redBg, C.redFg] }
    const [bg, fg] = map[estado] || [C.bgSoft, C.ink]
    return cell(estado, width, { fill: bg, color: fg, bold: true, size: 17, align: AlignmentType.CENTER })
}

function sevCell(sev, width) {
    const map = { ALTA: [C.redBg, C.redFg], CRÍTICA: [C.redBg, C.redFg], MEDIA: [C.warnBg, C.warnFg], BAJA: [C.tealSoft, C.teal], INFO: [C.bgSoft, C.grey] }
    const [bg, fg] = map[sev] || [C.bgSoft, C.ink]
    return cell(sev, width, { fill: bg, color: fg, bold: true, size: 17, align: AlignmentType.CENTER })
}

function kpiTable(items) {
    const w = Math.floor(CONTENT_W / items.length)
    const widths = items.map(() => w)
    return table(widths, [new TableRow({ children: items.map((k, i) => new TableCell({
        width: { size: widths[i], type: WidthType.DXA }, margins: { top: 140, bottom: 140, left: 80, right: 80 },
        shading: { type: ShadingType.CLEAR, fill: C.tealSoft, color: "auto" }, verticalAlign: VerticalAlign.CENTER,
        children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: k.value, font: BODY, size: 40, bold: true, color: C.teal })] }),
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: k.label, font: BODY, size: 15, bold: true, color: C.grey })] }),
        ],
    })) })], { borders: noBorders })
}

// ── Contenido ─────────────────────────────────────────────────────────────────
const FECHA = "2 de octubre de 2026"

const estadoHallazgos = [
    ["A-01", "ALTA", "Alcance por agencia (tenencia) en todas las lecturas: dashboard, reportes, correspondencia, planillas, recorridos", "RESUELTO"],
    ["A-02", "ALTA", "Edición, aprobación y devolución verifican permiso y pertenencia del registro; IDs ajenos → 403", "RESUELTO"],
    ["A-03", "ALTA", "Ciclo de planillas con permiso planillas.gestionar y dueño; salientes compartidas solo con alcance global", "RESUELTO"],
    ["A-04", "ALTA", "Las 15 acciones de catálogos exigen rol ADMIN leído de la base de datos", "RESUELTO"],
    ["A-05", "ALTA", "Sesión en base de datos, revocable; rol fresco por petición; sin renovación indefinida", "RESUELTO"],
    ["A-06", "ALTA", "Archivos fuera de public/, servidos solo por API con sesión viva y control de acceso por objeto", "RESUELTO"],
    ["M-01", "MEDIA", "Permiso explícito en cada página (incluidas las 11 de administración); «Acceso denegado» visible", "RESUELTO"],
    ["M-02", "MEDIA", "Seed no destructivo, sin contraseñas fijas, bloqueado en producción", "RESUELTO"],
    ["M-03", "MEDIA", "Validación del contenido real del archivo (magic bytes); .gif retirado", "RESUELTO"],
    ["M-04", "MEDIA", "Límite por usuario y por IP; bloqueo persistente de cuenta en BD (Redis si se escala: riesgo residual R-020)", "RESUELTO"],
    ["M-05", "MEDIA", "Redirecciones solo a hosts de una lista permitida (ALLOWED_HOSTS)", "RESUELTO"],
    ["M-06", "MEDIA", "CSP con nonce por petición (sin unsafe-inline en scripts); colores de marca validados dos veces", "RESUELTO"],
    ["M-07", "MEDIA", "Bitácora AuditLog de todas las operaciones con usuario, acción, entidad e IP; autoría en registros", "RESUELTO"],
    ["M-08", "MEDIA", "Tiempo de respuesta constante en el login y bloqueo persistente tras 10 fallos", "RESUELTO"],
    ["B-01", "BAJA", "Cookie de sesión con los mismos atributos seguros en todas las operaciones, incluido el middleware", "RESUELTO"],
    ["B-02", "BAJA", "Roles, tipos y estados como enumeraciones de base de datos (migración sin pérdida)", "RESUELTO"],
    ["B-03", "BAJA", "Transacciones y actualizaciones condicionadas al estado; índices en columnas de filtro", "RESUELTO"],
    ["B-04", "BAJA", "Tests de autorización por rol y comportamiento; guard esperado por acción; guard en cada página", "RESUELTO"],
    ["B-05", "BAJA", "Correo validado en usuarios; módulo de notificaciones (envío real pendiente de SMTP: R-021)", "RESUELTO"],
    ["B-06", "BAJA", "Esquema de validación completo en la edición de correspondencia; topes de anexos", "RESUELTO"],
    ["B-07", "BAJA", "README real y runbook de operación versionado sin secretos", "RESUELTO"],
    ["B-08", "BAJA", "Dependencia cookie eliminada; módulo planillas renombrado", "RESUELTO"],
    ["B-09", "BAJA", "Un usuario AGENCIA exige agencia asignada (formulario, servidor y alcance vacío si falta)", "RESUELTO"],
]

const detalles = [
    ["A-01 — Sin aislamiento de datos por agencia en lectura",
     "Se creó un módulo único de tenencia que decide el alcance de cada rol: ADMIN y MENSAJERO ven la operación completa; un usuario AGENCIA ve únicamente su agencia; y una cuenta AGENCIA sin agencia asignada no ve nada. Ese módulo construye los filtros de todas las consultas del dashboard, los reportes (incluidos los contadores y la lista de agencias del filtro), la correspondencia entrante y saliente, las planillas, el detalle de planilla, los recorridos y «Mis Planillas». Un identificador de agencia ajena forzado en la URL se ignora.",
     "Pruebas unitarias del módulo de tenencia y prueba de extremo a extremo con dos agencias: cada usuario ve solo sus registros y una planilla ajena responde 404."],
    ["A-02 — Edición y gestión de correspondencia ajena por identificador",
     "La acción de completar o editar una pieza ahora carga primero el registro, exige el permiso según el tipo real del registro (no el que envía el navegador), verifica que pertenezca a la agencia del usuario e impide que una agencia reasigne una pieza a otra. Aprobar y devolver exigen el permiso específico de recepción, que el mensajero no tiene, además de la pertenencia y de que la pieza esté pendiente dentro de una planilla cerrada en un recorrido activo. Se registra quién recibió cada pieza.",
     "Pruebas de comportamiento por rol (agencia ajena, tipo manipulado, mensajero) y aprobación real de una pieza propia en la prueba de extremo a extremo."],
    ["A-03 — Ciclo de vida de planillas sin permiso ni dueño",
     "Cerrar, reabrir, retirar piezas y subir la firma exigen el nuevo permiso de gestión de planillas y la pertenencia de la planilla; procesarla exige el permiso de recepción y la pertenencia. Como las planillas salientes agrupan piezas de todas las agencias, su gestión y su soporte firmado quedan reservados al alcance global, aunque una agencia tenga piezas dentro. Las transiciones de estado son atómicas.",
     "Pruebas de comportamiento para cada acción y generación de una planilla saliente desde la interfaz en la prueba de extremo a extremo."],
    ["A-04 — Catálogos modificables por cualquier usuario autenticado",
     "Las quince acciones de catálogos (ciudades, empresas de mensajería, agencias, centros de costo y sedes) exigen ahora el rol de administrador leído de la base de datos en el momento de la petición. Se eliminó la copia duplicada del control de administrador que existía en otro módulo.",
     "Prueba de comportamiento: un usuario de agencia o un mensajero con todos los permisos de la matriz reciben un 403 explícito y no se crea nada; prueba estática que falla si vuelve a usarse un control genérico de sesión."],
    ["A-05 — Sesión no revocable con rol congelado",
     "La sesión vive ahora en la base de datos: el token de la cookie solo la identifica, y en cada petición el servidor comprueba que siga viva y lee el rol y la agencia actuales del usuario. Cerrar sesión la revoca en el servidor; cambiar el rol, la agencia o la contraseña de un usuario revoca todas sus sesiones; eliminarlo las elimina. La expiración es absoluta (24 horas), sin renovación indefinida. Una cookie cuya sesión ya no sirve se borra automáticamente y el usuario vuelve al inicio de sesión con un aviso.",
     "Pruebas unitarias del almacén de sesiones y del control de acceso; prueba de extremo a extremo: una sesión revocada en la base de datos deja de servir en la petición siguiente."],
    ["A-06 — Archivos subidos accesibles sin autenticación",
     "Los archivos se guardan fuera de la carpeta pública (en un directorio privado configurable) y se entregan únicamente a través de la API, que exige sesión viva y comprueba que el archivo esté referenciado por una pieza, planilla o logotipo que el usuario puede ver. Los nombres los genera el servidor; el directorio público antiguo responde 404 aunque conserve archivos, y un script traslada los archivos existentes al nuevo directorio.",
     "Pruebas de la API (401 sin sesión, 403 ajeno, 404 huérfano, 400 ante intentos de recorrer directorios) y verificación de extremo a extremo con dos agencias."],
    ["M-01 — Permisos granulares no aplicados en las páginas",
     "Cada página de negocio exige su permiso al inicio y, si falta, muestra una pantalla de «Acceso denegado» en lugar de redirigir en silencio; el intento queda en la bitácora. Tras la revisión interna se añadió además el control propio a cada una de las once páginas de administración, porque los layouts del framework pueden omitirse en ciertas peticiones del cliente.",
     "Prueba estática que exige un control propio en todas las páginas antes de consultar datos, y prueba de concepto ejecutada contra el servidor local."],
    ["M-02 — Seed destructivo con contraseña por defecto",
     "El script de datos iniciales ya no borra nada: crea o actualiza catálogos y permisos de forma idempotente, solo crea usuarios si la tabla está vacía, toma las contraseñas del entorno o genera contraseñas fuertes que muestra una sola vez, y se niega a ejecutarse en producción salvo autorización explícita.",
     "Prueba estática del script y ejecución sobre la base de datos local."],
    ["M-03 — Validación del tipo de archivo basada en lo que declara el navegador",
     "Además del tipo declarado, la extensión y el tamaño, ahora se inspeccionan los primeros bytes del archivo para confirmar que realmente es un PDF, PNG o JPG. Un archivo HTML disfrazado de imagen se rechaza. El formato .gif dejó de servirse.",
     "Pruebas unitarias con archivos reales en disco."],
    ["M-04 — Límite de intentos solo por usuario y en memoria",
     "El límite de intentos se aplica por usuario y también por dirección IP del cliente real. El bloqueo de cuenta se guarda en la base de datos, por lo que sobrevive a reinicios y a varias instancias. El contador de ventana sigue en memoria, adecuado para la instancia única actual; queda documentado migrarlo a un almacén compartido si la aplicación escala (riesgo residual R-020).",
     "Pruebas unitarias de ambos límites y de la extracción de la IP del cliente."],
    ["M-05 — Redirecciones construidas con la cabecera Host",
     "Las redirecciones solo se construyen hacia hosts de una lista permitida configurada en el servidor; cualquier otro valor se sustituye por el primer host permitido y el protocolo se restringe a http o https.",
     "Pruebas unitarias y del middleware con una cabecera Host hostil."],
    ["M-06 — CSP con unsafe-inline y colores de marca sin validar",
     "La política de seguridad de contenido se genera por petición con un valor aleatorio (nonce) y «strict-dynamic», eliminando unsafe-inline para scripts; toda la aplicación se renderiza dinámicamente para que el nonce se aplique. Los colores de marca se validan contra el formato HSL al guardarse y de nuevo al inyectarse. Se conserva unsafe-inline solo para estilos, requisito del framework (riesgo residual R-022).",
     "Pruebas de la política y de la validación; en el navegador, cero violaciones y todos los scripts con nonce."],
    ["M-07 — Sin bitácora ni autoría de operaciones",
     "Se añadió una bitácora de solo inserción que registra inicio y cierre de sesión, accesos denegados, descargas denegadas y todas las operaciones de negocio y administración, con usuario, acción, entidad, detalle (incluidos los valores previos en las ediciones) y dirección IP. Los registros de correspondencia y planillas guardan quién los creó, modificó o recibió.",
     "Pruebas unitarias y verificación en la base de datos durante la prueba de extremo a extremo."],
    ["M-08 — Oráculo de tiempo en el login y sin bloqueo de cuenta",
     "El inicio de sesión tarda lo mismo exista o no el usuario, porque siempre se ejecuta una comparación de contraseña. Diez fallos consecutivos bloquean la cuenta durante quince minutos de forma persistente, con el mismo mensaje genérico. Las contraseñas con un coste de cifrado heredado menor se re-cifran al coste actual la siguiente vez que el usuario entra.",
     "Pruebas de comportamiento del inicio de sesión con base de datos simulada."],
    ["B-01 — Cookie emitida por el middleware sin path",
     "Los atributos de la cookie se definen en un único lugar compartido por todas las operaciones; el middleware ya no emite cookies salvo para limpiarlas, y lo hace con los mismos atributos.",
     "Pruebas del middleware y del cierre de sesión."],
    ["B-02 — Roles y estados almacenados como texto libre",
     "Roles, tipos y estados pasaron a enumeraciones de la base de datos mediante una migración escrita a mano que conserva los datos existentes y aborta con un mensaje claro si encontrara valores fuera de dominio.",
     "Migración aplicada sobre una base con datos; roles y permisos conservados."],
    ["B-03 — Sin transacciones ni índices en flujos concurrentes",
     "La generación de planillas se ejecuta en una transacción con actualizaciones condicionadas al estado, de modo que dos clics simultáneos no duplican ni pierden piezas; aprobar, devolver, cerrar, reabrir y procesar también son atómicos, y la base de datos impide dos recorridos activos a la vez. Se añadieron índices en las columnas de filtro.",
     "Pruebas de comportamiento y migraciones aplicadas."],
    ["B-04 — Tests que solo comprobaban la presencia de un control",
     "La prueba estática exige ahora el control concreto esperado por cada acción, ignora comentarios y falla si aparece una acción nueva sin declarar. Se añadieron pruebas de comportamiento por rol que reproducen los casos de abuso del modelo de amenazas, pruebas del inicio de sesión, de la revocación de sesiones y de los controles de página.",
     "Suite de 253 pruebas en 30 archivos."],
    ["B-05 — Notificaciones por consola y usuarios sin correo",
     "El correo electrónico es ahora un dato validado del usuario (formulario y listado) y los avisos salen por un módulo único de notificaciones que no escribe datos personales en los registros de producción. El envío real requiere las credenciales SMTP del cliente (riesgo residual R-021); la interfaz lo indica.",
     "Pruebas de esquema; módulo listo para conectar un proveedor."],
    ["B-06 — Edición de correspondencia sin esquema de validación",
     "La edición valida ahora cada campo con un esquema completo (longitudes, importancia, agencia) y limita el tamaño y el número de identificadores de anexo. Solo se edita una pieza pendiente y fuera de planilla, protegiendo la cadena de custodia. Se corrigió además un error funcional: al editar una saliente se perdía el destinatario.",
     "Pruebas de esquema y de comportamiento."],
    ["B-07 — README de plantilla y operación fuera del repositorio",
     "El repositorio incluye un README real y un runbook de operación versionado que describe instalación, actualización, variables, bitácora, respaldos e incidentes sin exponer secretos, direcciones ni dominios reales.",
     "Revisión documental."],
    ["B-08 — Dependencia sin uso y módulo mal nombrado",
     "Se eliminó la dependencia sin uso y se renombró el módulo de planillas; una prueba lo verifica.",
     "Prueba de dependencias y compilación."],
    ["B-09 — Usuario AGENCIA sin agencia asignada",
     "El formulario y el servidor exigen una agencia para el rol AGENCIA y comprueban que exista; si por algún motivo faltara, el alcance del usuario es vacío en toda la aplicación.",
     "Pruebas de esquema y de tenencia."],
]

const guardianRows = [
    ["R-027", "CRÍTICA", "Versión del framework (Next.js 16.0.8) con avisos de seguridad publicados y dependencias transitivas vulnerables.", "Actualizado a 16.3.8 con versión fijada; dependencias corregidas; auditoría de dependencias en cero.", "CERRADO"],
    ["R-028", "ALTA", "Las páginas de administración confiaban solo en el layout, que puede omitirse en peticiones RSC del cliente.", "Control propio en las 11 páginas, prueba estática y prueba de concepto ejecutada.", "CERRADO"],
    ["R-029", "ALTA", "Cuatro PDF cargados en pruebas del piloto quedaron versionados en el repositorio desde el inicio; dos tienen apariencia de facturas personales.", "Retirados del control de versiones y del índice; persisten en el historial. Requiere decisión conjunta (ver §8).", "DECISIÓN"],
    ["R-030", "MEDIA", "El soporte firmado de una planilla saliente era legible por cualquier agencia con una pieza en ella.", "Acceso solo con alcance global; vista previa oculta a las agencias.", "CERRADO"],
    ["R-031", "MEDIA", "Una agencia con permiso de gestión delegado podía cerrar o firmar una saliente compartida.", "La gestión de salientes exige alcance global.", "CERRADO"],
    ["R-032", "MEDIA", "Contraseñas con coste de cifrado heredado permitían deducir qué cuentas existen por el tiempo de respuesta.", "Re-cifrado automático al iniciar sesión; verificación pendiente en el servidor para cuentas que no hayan vuelto a entrar.", "ABIERTO"],
    ["R-033", "BAJA", "La edición consultaba la base de datos antes de autenticar.", "Autenticación primero.", "CERRADO"],
    ["R-034", "BAJA", "Edición posible en cualquier estado y sin valores previos en la bitácora.", "Solo piezas pendientes sin planilla; valores previos registrados.", "CERRADO"],
    ["R-035", "BAJA", "Conteos globales de planillas con solo sesión.", "Permiso y alcance aplicados.", "CERRADO"],
    ["R-036", "BAJA", "Falsa cobertura en algunas pruebas estáticas; faltaban pruebas de páginas, login y revocación.", "Pruebas añadidas y endurecidas.", "CERRADO"],
    ["R-037", "BAJA", "Inyección de fórmulas en la exportación CSV.", "Celdas neutralizadas.", "CERRADO"],
    ["R-038", "BAJA", "Un atacante puede mantener bloqueada una cuenta conocida provocando fallos de login.", "Riesgo residual documentado: límite por IP, renombrar la cuenta administrativa, alertas.", "RESIDUAL"],
    ["R-039", "BAJA", "El seed podía generar una contraseña no mostrada si la del entorno era inválida.", "El seed aborta con mensaje claro.", "CERRADO"],
    ["R-040", "BAJA", "Alta de correspondencia sin topes de longitud ni de anexos.", "Topes aplicados.", "CERRADO"],
    ["R-041", "BAJA", "Condiciones de carrera en aprobaciones y creación de recorridos.", "Actualizaciones atómicas, transacción e índice único.", "CERRADO"],
    ["R-042…R-046", "INFO", "Menores: validación de la URL del logotipo, ruta pública por igualdad exacta, usuario tecleado en la bitácora, versión exacta del framework, transiciones de planilla atómicas.", "Corregidos.", "CERRADO"],
    ["R-047", "INFO", "El espejo interno de AISerNet conserva el mismo historial que el repositorio del cliente.", "Se incluye en la decisión de R-029.", "DECISIÓN"],
]

const residuales = [
    ["R-020", "Contador de límite de intentos en memoria del proceso (instancia única).", "El bloqueo de cuenta persiste en base de datos. Migrar a Redis solo si se escala a varias instancias.", "Aceptación"],
    ["R-021", "El envío real de correo depende de credenciales SMTP del cliente.", "Módulo listo para conectar un proveedor.", "Entregar credenciales SMTP"],
    ["R-022", "La política de contenido conserva unsafe-inline para estilos.", "Requisito del framework; colores validados en entrada y salida; ningún estilo depende de entrada de usuario.", "Aceptación"],
    ["R-029", "Archivos de prueba en el historial de git (incluidas posibles facturas personales).", "Ya no se versionan. Purgar el historial exige coordinación y reescritura de ramas compartidas.", "Acordar purga o aceptación; evaluar Ley 1581"],
    ["R-032", "Cuentas con contraseña de coste heredado que no vuelvan a iniciar sesión.", "Verificar en el servidor y rotar las que aparezcan.", "Verificación en despliegue"],
    ["R-038", "Bloqueo de cuenta usable para impedir el acceso a un usuario conocido.", "Límite por IP, renombrar la cuenta administrativa en el despliegue, alertar ante bloqueos.", "Aceptación"],
]

// ── Documento ─────────────────────────────────────────────────────────────────
const fonts = []
if (fs.existsSync(FONT_FILE)) fonts.push({ name: BRAND, data: fs.readFileSync(FONT_FILE), characterSet: CharacterSet.ANSI })
else console.warn(`AVISO: no se encontró la fuente NEBULA en ${FONT_FILE}; el crédito queda declarado con la familia "${BRAND}".`)

const brandCredit = (align = AlignmentType.CENTER) => new Paragraph({ alignment: align, spacing: { after: 0 }, children: [new TextRun({ text: "By AISerNet Company", font: BRAND, size: 20, color: C.ink })] })

const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } }, spacing: { after: 120 },
    children: [t("AISerNet Company · Equipo ASIA", { size: 16, color: C.grey, bold: true }), t("   |   Informe de Remediación — Auditoría N.º 2 — SISMAR   |   Confidencial", { size: 16, color: C.grey })] })] })

const footer = new Footer({ children: [
    new Paragraph({ border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.line, space: 4 } }, spacing: { before: 60, after: 0 }, children: [] }),
    table([CONTENT_W / 3, CONTENT_W / 3, CONTENT_W / 3], [new TableRow({ children: [
        new TableCell({ width: { size: CONTENT_W / 3, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ spacing: { after: 0 }, children: [t("Metodología STRATA v3", { size: 16, color: C.grey })] })] }),
        new TableCell({ width: { size: CONTENT_W / 3, type: WidthType.DXA }, borders: noBorders, children: [brandCredit()] }),
        new TableCell({ width: { size: CONTENT_W / 3, type: WidthType.DXA }, borders: noBorders, children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [t("Página ", { size: 16, color: C.grey }), new TextRun({ children: [PageNumber.CURRENT], font: BODY, size: 16, color: C.grey }), t(" de ", { size: 16, color: C.grey }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: BODY, size: 16, color: C.grey })] })] }),
    ] })], { borders: noBorders }),
] })

// Portada
const cover = [
    spacer(1800),
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 80 }, children: [new TextRun({ text: "SISMAR", font: BRAND, size: 64, color: C.teal })] }),
    new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: "Informe de Remediación de Seguridad y Arquitectura", font: BODY, size: 44, bold: true, color: C.ink })] }),
    new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: "Respuesta a la Auditoría N.º 2 — Sistema de Gestión de Correspondencia Interna", font: BODY, size: 26, color: C.grey })] }),
    table([2520, 2520, 2520, 2520], [
        new TableRow({ children: ["PREPARADO POR", "DIRIGIDO A", "FECHA", "REFERENCIA"].map(l => cell(l, 2520, { fill: C.ink, color: C.white, bold: true, size: 16 })) }),
        new TableRow({ children: [
            cell([[bold("AISerNet Company — Equipo ASIA")], [t("Arquitectura de Soluciones de IA", { size: 18, color: C.grey })]], 2520, { vAlign: VerticalAlign.TOP }),
            cell([[bold("FOSCAL")], [t("Equipo de Ciberseguridad", { size: 18, color: C.grey })]], 2520, { vAlign: VerticalAlign.TOP }),
            cell([[bold(FECHA)], [t("Versión 1.0", { size: 18, color: C.grey })]], 2520, { vAlign: VerticalAlign.TOP }),
            cell([[bold("Auditoría de seguridad y arquitectura")], [t("31/08/2026 · 23 hallazgos (6 altos, 8 medios, 9 bajos)", { size: 18, color: C.grey })]], 2520, { vAlign: VerticalAlign.TOP }),
        ] }),
    ]),
    spacer(600),
    p([t("Flujo STRATA ", { color: C.grey, size: 19 }), code("H-003"), t("  ·  Rama ", { color: C.grey, size: 19 }), code("fix/remediacion-auditoria-2"), t("  ·  Commit ", { color: C.grey, size: 19 }), code("ecd4a6f")]),
    p([t("Este documento es la respuesta formal, punto por punto, a los hallazgos del informe «Auditoría de seguridad y arquitectura — SISMAR» del 31 de agosto de 2026. Cada remediación se entrega con código identificable, prueba automatizada y verificación ejecutada.", { size: 19, color: C.grey })]),
    pageBreak(),
]

// 1. Resumen ejecutivo
const resumen = [
    h1("1. Resumen ejecutivo"),
    p("El equipo ASIA de AISerNet recibió la auditoría de caja blanca practicada sobre SISMAR, que identificó 23 hallazgos (6 altos, 8 medios y 9 bajos) con un dictamen central: los controles de superficie existían, pero la autorización no estaba en el núcleo de la aplicación sino en la interfaz, y un usuario de menor privilegio podía leer y alterar correspondencia de otras dependencias."),
    p("Coincidimos con el dictamen y abordamos la remediación bajo la metodología STRATA v3: especificación y modelo de amenazas antes de codificar, prueba en rojo antes que código, verificación con evidencia ejecutada y seguridad transversal con poder de veto. La remediación lleva la autorización al servidor: alcance por agencia en toda lectura, pertenencia por objeto en toda mutación, sesión revocable leída de la base de datos en cada petición, archivos privados con control de acceso por objeto, política de contenido con nonce y bitácora de todas las operaciones."),
    p("A la fecha de este informe, los 23 hallazgos están remediados y verificados. Antes de cerrar, una revisión Guardian independiente sobre el cambio completo detectó 16 hallazgos adicionales, incluido uno crítico por la versión del framework; 13 quedaron también cerrados, uno permanece como riesgo residual documentado y dos requieren una decisión conjunta con FOSCAL sobre el historial del repositorio. El despliegue a pre-producción se mantuvo bloqueado durante toda la remediación y sigue condicionado a esa decisión."),
    spacer(80),
    kpiTable([
        { value: "23/23", label: "HALLAZGOS REMEDIADOS" },
        { value: "6/6", label: "ALTOS" },
        { value: "253", label: "TESTS EN VERDE" },
        { value: "0", label: "VULNERABILIDADES (npm audit)" },
        { value: "16", label: "HALLAZGOS ADICIONALES PROPIOS" },
        { value: "13", label: "DE ELLOS CERRADOS" },
    ]),
    spacer(120),
]

// 2. Alcance y método
const n1 = numList()
const metodo = [
    h1("2. Alcance y método de trabajo"),
    p("El alcance cubre los 23 hallazgos del informe (A-01 a A-06, M-01 a M-08 y B-01 a B-09). Quedan fuera, como declara el propio auditor, el cifrado en reposo, las copias de seguridad y la revisión de la infraestructura del servidor."),
    h3("Secuencia STRATA v3 aplicada"),
    n1([bold("Especificación (Gate SDD). "), t("Spec del Flujo H-003 con 14 criterios de aceptación binarios, modelo de amenazas con 22 casos de abuso (AC-001…AC-022), 16 contratos (C-001…C-016) y 30 escenarios BDD (S-001…S-030).")]),
    n1([bold("Construcción (Gate TDD). "), t("Cada contrato se implementó con pruebas que pasaron de rojo a verde; la suite creció de 55 a 253 pruebas en 30 archivos, con cobertura del 81 % en la capa de lógica y seguridad.")]),
    n1([bold("Verificación (Gate BDD). "), t("Compilación de producción, auditoría de dependencias, migración sobre una base con datos y smoke de extremo a extremo en navegador con un usuario de cada rol y dos agencias distintas.")]),
    n1([bold("Revisión Guardian independiente. "), t("Un revisor de seguridad independiente del equipo que implementó auditó el cambio completo con veto; sus hallazgos se verificaron uno a uno y se corrigieron con el mismo rigor (sección 6).")]),
    p([t("Trazabilidad: "), code("specs/H-003-remediacion-auditoria-2/"), t(" (especificación, modelo de amenazas, contratos y escenarios), "), code("artefacts/H-003/"), t(" (declaración de Pulso, acta de cierre, RADAR y cobertura) y "), code("docs/auditoria/RESPUESTA_AUDITORIA_2_SISMAR.md"), t(" (respuesta técnica detallada).")]),
]

// 3. Estado por hallazgo
const widthsEstado = [900, 1000, 6580, 1600]
const estado = [
    h1("3. Estado por hallazgo"),
    p("Convención: RESUELTO = remediado y verificado con evidencia ejecutada. Los riesgos residuales asociados se detallan en la sección 8.", { keepNext: true }),
    table(widthsEstado, [
        headerRow(["ID", "SEV.", "REMEDIACIÓN", "ESTADO"], widthsEstado),
        ...estadoHallazgos.map(([id, sev, rem, est]) => new TableRow({ cantSplit: true, children: [
            cell(id, widthsEstado[0], { bold: true, size: 18 }), sevCell(sev, widthsEstado[1]), cell(rem, widthsEstado[2], { size: 18 }), statusCell(est, widthsEstado[3]),
        ] })),
    ]),
]

// 4. Cambios estructurales
const widthsEstr = [3000, 7080]
const estructurales = [
    h1("4. Cambios estructurales"),
    p("Las remediaciones no se aplicaron como parches aislados: descansan sobre piezas comunes que gobiernan toda la aplicación."),
    table(widthsEstr, [
        headerRow(["PIEZA", "QUÉ GARANTIZA"], widthsEstr),
        ...[
            ["Contexto de autenticación fresco", "El rol y la agencia se leen de la base de datos en cada petición; la sesión vive en una tabla propia y es revocable (cierre de sesión, cambio de rol o contraseña, eliminación del usuario). Expiración absoluta de 24 horas."],
            ["Módulo de tenencia", "Un único lugar decide el alcance de cada rol y construye los filtros de todas las consultas; ninguna página ni acción arma filtros por su cuenta. Un rol sin alcance definido no ve nada."],
            ["Denegación explícita", "Las acciones devuelven un error 403 claro; las páginas muestran «Acceso denegado»; los objetos ajenos responden 404 para no revelar su existencia. Todo intento queda en la bitácora."],
            ["Bitácora de auditoría", "Tabla de solo inserción con usuario, acción, entidad, detalle y dirección IP para inicio y cierre de sesión, accesos denegados y toda operación de negocio y administración."],
            ["Archivos privados", "Almacenamiento fuera de la carpeta pública, entrega únicamente por API con sesión viva, control de acceso por el objeto que referencia el archivo y validación del contenido real."],
            ["Catálogo único de permisos", "Dos permisos nuevos (gestionar planillas y recibir correspondencia) y un script idempotente de sincronización para bases ya desplegadas."],
            ["Integridad en la base de datos", "Enumeraciones para roles, tipos y estados, índices en columnas de filtro, transacciones y un índice único que impide dos recorridos activos."],
        ].map(([a, b]) => new TableRow({ cantSplit: true, children: [cell(a, widthsEstr[0], { bold: true, size: 18, fill: C.bgSoft }), cell(b, widthsEstr[1], { size: 18 })] })),
    ]),
]

// 5. Detalle
const detalle = [
    h1("5. Detalle de las soluciones aplicadas"),
    p("Se describe, para cada hallazgo, la solución implementada en lenguaje no técnico y la evidencia con que se verificó."),
    ...detalles.flatMap(([titulo, texto, evidencia]) => [
        h3(titulo),
        p(texto),
        p([bold("Evidencia: "), t(evidencia, { color: C.grey })]),
    ]),
]

// 6. Revisión Guardian
const widthsG = [1150, 950, 3700, 3180, 1100]
const guardian = [
    h1("6. Revisión Guardian independiente"),
    p("Antes de declarar cerrado el trabajo, un revisor de seguridad independiente del equipo que implementó la remediación analizó el cambio completo con capacidad de veto. Devolvió 16 hallazgos adicionales. Los tratamos con el mismo método que los del auditor: verificación uno a uno, prueba en rojo, corrección y verificación. El veto se levantó tras una segunda revisión, con dos decisiones separadas: el cierre técnico queda autorizado; el despliegue y la publicación al repositorio del cliente quedan condicionados a la decisión conjunta sobre R-029."),
    table(widthsG, [
        headerRow(["ID", "SEV.", "HALLAZGO", "RESOLUCIÓN", "ESTADO"], widthsG),
        ...guardianRows.map(([id, sev, hal, res, est]) => new TableRow({ cantSplit: true, children: [
            cell(id, widthsG[0], { bold: true, size: 17 }), sevCell(sev, widthsG[1]), cell(hal, widthsG[2], { size: 17 }), cell(res, widthsG[3], { size: 17 }), statusCell(est, widthsG[4]),
        ] })),
    ]),
    spacer(80),
    p([bold("Lección incorporada al método de AISerNet: "), t("autenticar no es autorizar. El alcance de cada rol y la pertenencia de cada objeto deben decidirse en el servidor y probarse por comportamiento; los layouts del framework no son una frontera de seguridad; y la auditoría de dependencias forma parte de la compuerta de despliegue. Estos puntos se añadieron al checklist Guardian que AISerNet aplica a todos sus proyectos.", { color: C.grey })]),
]

// 7. Verificación
const n2 = numList()
const verificacion = [
    h1("7. Verificación (Gate BDD)"),
    bullet([bold("253 pruebas automatizadas en verde "), t("(30 archivos): tenencia, pertenencia por objeto, sesión revocable, control de acceso a archivos y validación de contenido, inicio de sesión endurecido, política de contenido, middleware, controles de página, revocación de sesiones, exportación CSV y seed seguro. Cobertura del 81 % en la capa de lógica y seguridad.")]),
    bullet([bold("Compilación de producción sin errores "), t("con TypeScript estricto y Next.js 16.3.8; auditoría de dependencias sin vulnerabilidades.")]),
    bullet([bold("Migraciones aplicadas sobre una base con datos "), t("sin pérdida: roles, permisos y registros conservados; las conversiones a enumeraciones abortan con un mensaje claro ante valores fuera de dominio.")]),
    bullet([bold("Smoke de extremo a extremo "), t("sobre la compilación de producción con PostgreSQL y un usuario de cada rol: la agencia 1 no ve ni alcanza datos de la agencia 2 (reportes, planillas, archivos); la agencia 2 aprueba su pieza y queda registrado quién la recibió; una sesión revocada deja de servir en la petición siguiente; el administrador ve la operación completa; cero violaciones de la política de contenido en el navegador.")]),
    bullet([bold("Prueba de concepto del control por página: "), t("una petición que omite los layouts recibe «Acceso denegado» para una agencia y la salida de sesión para una cookie revocada, mientras que el administrador sí recibe los datos.")]),
    bullet([bold("Cabeceras y códigos: "), t("CSP con nonce y HSTS presentes; sin sesión, las páginas redirigen al inicio de sesión, la API de archivos responde 401 y el directorio público antiguo responde 404.")]),
    h3("Hallazgos propios durante la verificación (resueltos antes del cierre)"),
    n2("Un bucle de redirecciones al revocar una sesión: el middleware aceptaba un token bien firmado mientras el servidor detectaba la sesión revocada. Se añadió una ruta que borra la cookie inválida y envía al inicio de sesión con aviso. Solo lo detectó la prueba en navegador, no las pruebas unitarias."),
    n2("El nonce de la política de contenido no se aplicaba en páginas prerenderizadas ni en el script de tema; toda la aplicación pasó a renderizarse dinámicamente y el script recibe el nonce."),
    n2("Un error funcional preexistente: al editar una pieza saliente se borraba el destinatario. Quedó corregido con el nuevo esquema de validación."),
]

// 8. Riesgos residuales y decisiones
const widthsR = [900, 3200, 3680, 2300]
const riesgos = [
    h1("8. Riesgos residuales y decisiones solicitadas a FOSCAL"),
    p("Los siguientes puntos no son vulnerabilidades abiertas sino riesgos documentados que requieren aceptación formal o una decisión conjunta."),
    table(widthsR, [
        headerRow(["CÓDIGO", "RIESGO", "MITIGACIÓN ACTUAL", "SE SOLICITA"], widthsR),
        ...residuales.map(([c, r, m, s]) => new TableRow({ cantSplit: true, children: [cell(c, widthsR[0], { bold: true, size: 17 }), cell(r, widthsR[1], { size: 17 }), cell(m, widthsR[2], { size: 17 }), cell(s, widthsR[3], { size: 17, bold: true, color: C.teal })] })),
    ]),
    spacer(80),
    h3("Sobre R-029 (archivos en el historial del repositorio)"),
    p("Durante la revisión interna se detectó que cuatro archivos PDF cargados durante las pruebas del piloto quedaron versionados en el repositorio desde su primer commit; dos de ellos tienen apariencia de facturas personales de un tercero. Ya no forman parte del control de versiones, el directorio queda excluido y una prueba automatizada impide que vuelvan a entrar. Sin embargo, permanecen en el historial de todas las copias del repositorio, incluida la del cliente. AISerNet recomienda acordar con FOSCAL la purga del historial de forma coordinada en todos los repositorios y evaluar, con su área de protección de datos, si procede alguna actuación conforme a la Ley 1581 de 2012. Hasta esa decisión, la publicación de esta versión al repositorio del cliente permanece en espera."),
]

// 9. Despliegue
const n3 = numList()
const despliegue = [
    h1("9. Pasos para el despliegue en pre-producción"),
    n3([t("Añadir al entorno del servidor las variables "), code("ALLOWED_HOSTS"), t(" (dominio público) y "), code("UPLOADS_DIR"), t(" (directorio privado de archivos, fuera de la carpeta pública).")]),
    n3([t("Aplicar las migraciones ("), code("prisma migrate deploy"), t(") y regenerar el cliente de datos.")]),
    n3([t("Sincronizar el catálogo de permisos ("), code("prisma/sync-permissions.ts"), t(") y trasladar los archivos existentes al directorio privado ("), code("prisma/migrate-uploads.ts"), t(").")]),
    n3("Compilar y reiniciar el proceso de la aplicación."),
    n3("Verificar cabeceras y códigos de respuesta (CSP con nonce, HSTS, 307 al inicio de sesión, 401 en la API de archivos, 404 en el directorio público antiguo) y ejecutar la auditoría de dependencias."),
    n3("Comprobar que ninguna cuenta conserva una contraseña con coste de cifrado heredado y rotar las que aparezcan."),
    n3("Avisar a los usuarios: todas las sesiones anteriores quedan invalidadas y deberán iniciar sesión de nuevo."),
    p([t("El detalle operativo, sin secretos, está en "), code("docs/OPERACION.md"), t(" y en el Manual de Implementación en Cliente.")]),
]

// 10. Recomendación
const recomendacion = [
    h1("10. Recomendación y cierre"),
    p("AISerNet considera cerrada técnicamente la remediación de la Auditoría N.º 2: los 23 hallazgos están resueltos y verificados, y los hallazgos adicionales de la revisión independiente se corrigieron o quedaron documentados como riesgos residuales. El despliegue a pre-producción queda recomendado una vez FOSCAL se pronuncie sobre los puntos de la sección 8, en particular la decisión conjunta sobre R-029, y se ejecuten los pasos de la sección 9."),
    p("Quedamos atentos a la revisión del equipo de Ciberseguridad de FOSCAL para el cierre formal. Un pentest autenticado con un usuario de rol AGENCIA, como el propio auditor sugiere, es la mejor forma de confirmar de manera independiente lo aquí expuesto; el equipo ASIA está disponible para acompañarlo."),
    spacer(400),
    p([bold("AISerNet Company — Equipo ASIA")]),
    p([t("Arquitectura de Soluciones de Inteligencia Artificial · Metodología STRATA v3", { color: C.grey })]),
    spacer(200),
    brandCredit(AlignmentType.LEFT),
    pageBreak(),
]

// Anexos
const anexos = [
    h1("Anexo A. Inventario de evidencia"),
    table([3400, 6680], [
        headerRow(["ARTEFACTO", "CONTENIDO"], [3400, 6680]),
        ...[
            ["specs/H-003-remediacion-auditoria-2/", "Spec STR-A09, threat model STR-A13 (AC-001…AC-022), contratos C-001…C-016, escenarios BDD S-001…S-030."],
            ["artefacts/H-003/", "Declaración de Pulso (STR-A01), Acta de Cierre (STR-A03), RADAR (R-020…R-054) y Reporte de Cobertura (STR-A12)."],
            ["tests/security/ (30 archivos)", "253 pruebas: tenencia, autorización por rol, sesión, archivos, login, CSP, middleware, páginas, revocación, CSV, seed, esquemas."],
            ["tests/e2e/rsc-admin-bypass.poc.ts", "Prueba de concepto manual del control propio por página frente a peticiones que omiten los layouts."],
            ["prisma/migrations/20261001120000_…, 20261001133000_…", "Migraciones de enumeraciones, sesiones, bitácora, bloqueo de cuenta, índices y recorrido único, escritas a mano para conservar los datos."],
            ["docs/auditoria/RESPUESTA_AUDITORIA_2_SISMAR.md", "Respuesta técnica punto por punto con referencias a archivos y pruebas."],
            ["docs/OPERACION.md · README.md", "Runbook de operación y guía del repositorio, sin secretos ni datos de infraestructura."],
            ["docs/manuales/", "Manual del Usuario, Manual Técnico y Manual de Implementación en Cliente (Word y fuente Markdown)."],
        ].map(([a, b]) => new TableRow({ cantSplit: true, children: [cell([code(a)], 3400, { size: 17 }), cell(b, 6680, { size: 17 })] })),
    ]),
    spacer(160),
    h1("Anexo B. Glosario"),
    ...[
        ["Tenencia (tenancy)", "Regla que determina qué datos puede ver y modificar cada rol según su agencia; aquí se aplica en el servidor a toda consulta."],
        ["IDOR", "Acceso a un objeto ajeno manipulando su identificador (por ejemplo, el número de una planilla); se neutraliza verificando la pertenencia en cada operación."],
        ["Sesión revocable", "Sesión registrada en la base de datos que puede invalidarse de inmediato desde el servidor, a diferencia de un token que vale hasta su caducidad."],
        ["Magic bytes", "Primeros bytes que identifican el tipo real de un archivo; permiten rechazar un archivo malicioso disfrazado con una extensión permitida."],
        ["CSP con nonce", "Política de seguridad de contenido que solo permite ejecutar los scripts marcados con un valor aleatorio generado en cada petición."],
        ["RSC", "Componentes de servidor de React; una petición de este tipo puede pedir solo parte de una página, por lo que cada página debe aplicar su propio control de acceso."],
        ["Bitácora (AuditLog)", "Registro inalterable de quién hizo qué, cuándo y desde dónde."],
    ].map(([a, b]) => new Paragraph({ spacing: { after: 100, line: 276 }, children: [bold(a + ". "), t(b)] })),
]

const doc = new Document({
    creator: "AISerNet Company — Equipo ASIA",
    title: "Informe de Remediación — Auditoría de Seguridad y Arquitectura N.º 2 — SISMAR",
    description: "Respuesta formal a la auditoría del 31/08/2026 (23 hallazgos). Metodología STRATA v3.",
    fonts,
    styles: {
        default: { document: { run: { font: BODY, size: 21, color: C.ink } } },
        paragraphStyles: [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: BODY, size: 32, bold: true, color: C.teal }, paragraph: { spacing: { before: 360, after: 160 }, outlineLevel: 0 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: BODY, size: 25, bold: true, color: C.ink }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
            { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: BODY, size: 22, bold: true, color: C.teal }, paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 2 } },
        ],
    },
    numbering: { config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        { reference: "numeros", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 300 } } } }] },
    ] },
    sections: [{
        properties: { page: { size: { width: PAGE_W, height: PAGE_H }, margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN, header: 500, footer: 500 } } },
        headers: { default: header },
        footers: { default: footer },
        children: [...cover, ...resumen, ...metodo, ...estado, ...estructurales, ...detalle, ...guardian, ...verificacion, ...riesgos, ...despliegue, ...recomendacion, ...anexos],
    }],
})

Packer.toBuffer(doc).then(buf => {
    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, buf)
    console.log(`✔ ${path.relative(process.cwd(), OUT)} (${buf.length} bytes, fuente NEBULA ${fonts.length ? "embebida" : "NO embebida"})`)
}).catch(e => { console.error("Error generando el informe:", e.message); process.exit(1) })
