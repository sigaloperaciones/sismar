/* eslint-disable */
/**
 * Generador de los manuales de SISMAR (.docx) a partir de la fuente Markdown.
 * Lo mantiene el agente strata-documentador (AISerNet Company).
 *
 * Uso (la dependencia `docx` NO forma parte del proyecto; instálela aparte):
 *   mkdir %TEMP%\docxgen && cd %TEMP%\docxgen && npm init -y && npm install docx@9
 *   NODE_PATH=%TEMP%\docxgen\node_modules node docs/manuales/fuente/herramientas/generar-docx.cjs
 *
 * Variables opcionales:
 *   NEBULA_FONT  Ruta del archivo de la fuente NEBULA para embeberla en el .docx.
 *                Por defecto: %LOCALAPPDATA%\Microsoft\Windows\Fonts\NEBULA-REGULAR.OTF
 *
 * Índice en dos pasadas: genere, ejecute calcular-paginas.ps1 (Word, solo lectura)
 * y vuelva a generar con TOC_PAGES_DIR apuntando a la carpeta de páginas.
 *
 * Subconjunto de Markdown admitido: front matter (clave: valor), ## / ### / ####,
 * párrafos de una línea, listas (-, 1., - [ ]), tablas con |, bloques ``` ,
 * citas > (recuadros), imágenes ![pie](ruta), **negrita**, *cursiva*, `código`.
 */
const fs = require("fs")
const os = require("os")
const path = require("path")
const JSZip = require("jszip")   // dependencia de docx
const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
    WidthType, BorderStyle, ShadingType, ImageRun, Header, Footer, PageNumber, TableOfContents,
    LevelFormat, PageBreak, TabStopType, CharacterSet, TableLayoutType, VerticalAlign, Tab, Bookmark,
} = require("docx")

const ROOT = path.resolve(__dirname, "..", "..")          // docs/manuales
const FUENTE = path.join(ROOT, "fuente")

const MANUALES = [
    { md: "manual-usuario.md", docx: "manual-usuario.docx" },
    { md: "manual-tecnico.md", docx: "manual-tecnico.docx" },
    { md: "manual-implementacion-cliente.md", docx: "manual-implementacion-cliente.docx" },
]

// ── Identidad visual ──────────────────────────────────────────────────────────
const C = {
    ink: "1B3D3D",      // teal oscuro AISerNet
    accent: "0E8A94",   // cian legible en impresión
    accentSoft: "EAF5F6",
    text: "1F2A2A",
    muted: "5B6B6B",
    border: "C9D6D6",
    zebra: "F4F8F8",
    codeBg: "F2F5F5",
    warnBg: "FFF6E5", warnBd: "B7791F",
    dangerBg: "FDF1EF", dangerBd: "B42318",
}
const BODY_FONT = "Calibri"
const CODE_FONT = "Consolas"
const BRAND_FONT = "Nebula"      // familia de NEBULA-REGULAR.OTF
const PAGE = { w: 12240, h: 15840, mx: 1260, my: 1300 }   // Carta, márgenes ~2.2 cm
const CONTENT_W = PAGE.w - 2 * PAGE.mx                    // 9720 DXA

// Páginas por título calculadas por calcular-paginas.ps1 (Word, solo lectura).
const TOC_PAGES_DIR = process.env.TOC_PAGES_DIR || path.join(os.tmpdir(), "sismar-manuales-toc")

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
function fechaLarga(iso) {
    const [y, m, d] = iso.split("-").map(Number)
    return `${d} de ${MESES[m - 1]} de ${y}`
}

// ── Inline: **negrita**, *cursiva*, `código` ─────────────────────────────────
function inlineRuns(text, base = {}) {
    const runs = []
    let bold = false, italic = false, buf = ""
    const flush = () => {
        if (!buf) return
        runs.push(new TextRun({ text: buf, bold: bold || base.bold, italics: italic || base.italics, color: base.color, size: base.size, font: base.font }))
        buf = ""
    }
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]
        if (ch === "`") {
            const end = text.indexOf("`", i + 1)
            if (end > i) {
                flush()
                runs.push(new TextRun({
                    text: text.slice(i + 1, end), font: CODE_FONT, size: base.codeSize || 18,
                    color: base.codeColor || C.ink, bold: bold || base.bold, italics: italic || base.italics,
                    shading: base.noCodeShade ? undefined : { type: ShadingType.CLEAR, color: "auto", fill: "EEF3F3" },
                }))
                i = end
                continue
            }
        }
        if (ch === "*" && text[i + 1] === "*") { flush(); bold = !bold; i++; continue }
        if (ch === "*" && text[i + 1] !== " " ) { flush(); italic = !italic; continue }
        if (ch === "*" && italic) { flush(); italic = !italic; continue }
        buf += ch
    }
    flush()
    return runs
}
const plain = s => s.replace(/\*\*/g, "").replace(/`/g, "").replace(/(^|[^*])\*(?!\s)/g, "$1")

// ── Parser del Markdown ───────────────────────────────────────────────────────
function parse(md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n")
    const meta = {}
    let i = 0
    if (lines[0] === "---") {
        i = 1
        while (i < lines.length && lines[i] !== "---") {
            const m = lines[i].match(/^(\w+):\s*(.*)$/)
            if (m) meta[m[1]] = m[2]
            i++
        }
        i++
    }
    const blocks = []
    while (i < lines.length) {
        const line = lines[i]
        if (!line.trim()) { i++; continue }
        let m
        if ((m = line.match(/^(#{2,4})\s+(.*)$/))) { blocks.push({ t: "h", level: m[1].length - 1, text: m[2] }); i++; continue }
        if (line.startsWith("```")) {
            const code = []; i++
            while (i < lines.length && !lines[i].startsWith("```")) { code.push(lines[i]); i++ }
            i++; blocks.push({ t: "code", lines: code }); continue
        }
        if (line.startsWith("|")) {
            const rows = []
            while (i < lines.length && lines[i].startsWith("|")) { rows.push(lines[i]); i++ }
            const cells = r => r.replace(/\\\|/g, "\u0000").trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.replace(/\u0000/g, "|").trim())
            const header = cells(rows[0])
            const body = rows.slice(2).map(cells)
            blocks.push({ t: "table", header, body }); continue
        }
        if (line.startsWith(">")) {
            const q = []
            while (i < lines.length && lines[i].startsWith(">")) { q.push(lines[i].replace(/^>\s?/, "")); i++ }
            blocks.push({ t: "quote", text: q.join(" ") }); continue
        }
        if ((m = line.match(/^!\[(.*)\]\((.*)\)\s*$/))) { blocks.push({ t: "img", caption: m[1], src: m[2] }); i++; continue }
        if (/^(\s*)(-|\d+\.)\s+/.test(line)) {
            const items = []
            while (i < lines.length && /^(\s*)(-|\d+\.)\s+/.test(lines[i])) {
                const mm = lines[i].match(/^(\s*)(-|\d+\.)\s+(.*)$/)
                const depth = mm[1].length >= 2 ? 1 : 0
                let kind = mm[2] === "-" ? "bullet" : "number"
                let text = mm[3]
                if (kind === "bullet" && /^\[ \]\s+/.test(text)) { kind = "check"; text = text.replace(/^\[ \]\s+/, "") }
                items.push({ depth, kind, text }); i++
            }
            blocks.push({ t: "list", items }); continue
        }
        blocks.push({ t: "p", text: line.trim() }); i++
    }
    return { meta, blocks }
}

// ── Constructores ─────────────────────────────────────────────────────────────
const cellBorders = { top: { style: BorderStyle.SINGLE, size: 4, color: C.border }, bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border }, left: { style: BorderStyle.SINGLE, size: 4, color: C.border }, right: { style: BorderStyle.SINGLE, size: 4, color: C.border } }

// Ancho mínimo de una columna = su palabra más larga (los identificadores de código
// no se cortan a mitad); el resto se reparte según la cantidad de texto.
function longestToken(cell) {
    let best = 0
    const re = /`([^`]*)`|([^\s`]+)/g
    let m
    while ((m = re.exec(cell)) !== null) {
        if (m[1] !== undefined) {
            for (const t of m[1].split(/\s+/)) best = Math.max(best, t.length * 100)   // Consolas 9 pt ≈ 100 DXA/carácter
        } else {
            best = Math.max(best, plain(m[2]).length * 88)                                // Calibri 9 pt ≈ 88 DXA/carácter
        }
    }
    return best
}

function columnWidths(header, body, total) {
    const n = header.length
    const score = header.map((h, c) => {
        const lens = [plain(h).length, ...body.map(r => plain(r[c] || "").length)]
        const max = Math.max(...lens)
        const avg = lens.reduce((a, b) => a + b, 0) / lens.length
        return Math.max(6, Math.min(70, 0.6 * max + 0.4 * avg))
    })
    const minW = header.map((h, c) => {
        const tok = Math.max(Math.round(longestToken(h) * 1.15), ...body.map(r => longestToken(r[c] || "")))   // encabezado en negrita
        return Math.min(Math.round(total * 0.45), Math.max(900, tok + 260))
    })
    const sumMin = minW.reduce((a, b) => a + b, 0)
    const sumScore = score.reduce((a, b) => a + b, 0)
    let w
    if (sumMin > total) {
        // No caben todas las palabras largas: mezcla mitad "palabra más larga" y mitad
        // "volumen de texto" para no dejar sin espacio la columna de prosa.
        w = minW.map((x, c) => Math.floor(total * (0.5 * (x / sumMin) + 0.5 * (score[c] / sumScore))))
    } else {
        const extra = total - sumMin
        w = minW.map((x, c) => x + Math.floor((score[c] / sumScore) * extra))
    }
    w[w.indexOf(Math.max(...w))] += total - w.reduce((a, b) => a + b, 0)
    return w
}

function buildTable(header, body, opts = {}) {
    const total = opts.width || CONTENT_W
    const widths = opts.widths || columnWidths(header, body, total)
    const size = opts.size || 18
    const mkCell = (txt, ci, ri, isHeader) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        borders: cellBorders,
        verticalAlign: VerticalAlign.TOP,
        shading: isHeader ? { type: ShadingType.CLEAR, color: "auto", fill: C.ink } : (ri % 2 === 1 ? { type: ShadingType.CLEAR, color: "auto", fill: C.zebra } : undefined),
        margins: { top: 70, bottom: 70, left: 110, right: 110 },
        children: [new Paragraph({
            spacing: { before: 0, after: 0, line: 252 },
            children: inlineRuns(txt, isHeader ? { bold: true, color: "FFFFFF", size, codeColor: "FFFFFF", noCodeShade: true } : { size, color: C.text, codeSize: size - 1 }),
        })],
    })
    const rows = [new TableRow({ tableHeader: true, cantSplit: true, children: header.map((h, ci) => mkCell(h, ci, 0, true)) })]
    body.forEach((r, ri) => rows.push(new TableRow({ cantSplit: true, children: header.map((_, ci) => mkCell(r[ci] || "", ci, ri, false)) })))
    return new Table({ width: { size: total, type: WidthType.DXA }, columnWidths: widths, layout: TableLayoutType.FIXED, rows })
}

function calloutStyle(text) {
    if (/^\*\*Planificado/.test(text)) return { fill: C.warnBg, bd: C.warnBd }
    if (/^\*\*Guardian/.test(text)) return { fill: C.dangerBg, bd: C.dangerBd }
    return { fill: C.accentSoft, bd: C.accent }
}

function pngSize(file) {
    const b = fs.readFileSync(file)
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), data: b }
}

let listInstance = 0
function blocksToChildren(blocks, mdDir, toc, pages) {
    const out = []
    let figura = 0
    let hc = 0
    for (const b of blocks) {
        if (b.t === "h") {
            if (b.text === "Historial de cambios") continue       // va en la portada
            const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][b.level - 1]
            const id = `h_${String(++hc).padStart(3, "0")}`
            toc.push({ title: plain(b.text), level: b.level, href: id, page: pages[id] || 0 })
            out.push(new Paragraph({ heading: level, children: [new Bookmark({ id, children: inlineRuns(b.text) })] }))
        } else if (b.t === "p") {
            const isQuestion = /^\*\*[^*].*\*\*$/.test(b.text) && !b.text.slice(2, -2).includes("**")
            out.push(new Paragraph({ keepNext: isQuestion, spacing: isQuestion ? { before: 160, after: 40 } : undefined, children: inlineRuns(b.text) }))
        } else if (b.t === "list") {
            listInstance++
            for (const it of b.items) {
                const ref = it.kind === "number" && it.depth === 0 ? "numeros" : it.kind === "check" ? "checks" : "vinetas"
                const level = it.kind === "number" ? 0 : it.depth
                out.push(new Paragraph({ numbering: { reference: ref, level: it.kind === "number" ? 0 : level, instance: listInstance }, spacing: { after: 60 }, children: inlineRuns(it.text) }))
            }
        } else if (b.t === "table") {
            out.push(buildTable(b.header, b.body))
            out.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [] }))
        } else if (b.t === "code") {
            b.lines.forEach((ln, k) => out.push(new Paragraph({
                shading: { type: ShadingType.CLEAR, color: "auto", fill: C.codeBg },
                border: { left: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 8 } },
                indent: { left: 160, right: 80 },
                keepLines: true, keepNext: k < b.lines.length - 1,
                spacing: { before: k === 0 ? 80 : 0, after: k === b.lines.length - 1 ? 160 : 0, line: 240 },
                children: [new TextRun({ text: ln.length ? ln : " ", font: CODE_FONT, size: 17, color: C.ink })],
            })))
        } else if (b.t === "quote") {
            const st = calloutStyle(b.text)
            out.push(new Paragraph({
                shading: { type: ShadingType.CLEAR, color: "auto", fill: st.fill },
                border: { left: { style: BorderStyle.SINGLE, size: 24, color: st.bd, space: 10 } },
                indent: { left: 200, right: 120 },
                spacing: { before: 120, after: 160, line: 276 },
                children: inlineRuns(b.text),
            }))
        } else if (b.t === "img") {
            const file = path.resolve(mdDir, b.src)
            const { w, h, data } = pngSize(file)
            // Ancho de contenido ~620 px; las figuras verticales se limitan a ~520 px de alto.
            const width = Math.min(620, Math.round((520 * w) / h))
            const height = Math.round((h / w) * width)
            figura++
            out.push(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 160, after: 60 }, children: [new ImageRun({ type: "png", data, transformation: { width, height }, altText: { title: plain(b.caption), description: plain(b.caption), name: path.basename(file) } })] }))
            out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 200 }, children: [new TextRun({ text: plain(b.caption), italics: true, size: 18, color: C.muted })] }))
        }
    }
    return out
}

function cover(meta, historial, toc) {
    const kids = []
    kids.push(new Paragraph({
        shading: { type: ShadingType.CLEAR, color: "auto", fill: C.ink },
        spacing: { before: 0, after: 0 }, indent: { left: 0 },
        children: [new TextRun({ text: "  AISerNet Company  ·  Documentación del producto  ·  Metodología STRATA", color: "FFFFFF", size: 18, bold: true })],
    }))
    kids.push(new Paragraph({ spacing: { before: 1300, after: 0 }, children: [new TextRun({ text: meta.producto || "SISMAR", font: BRAND_FONT, size: 88, color: C.ink })] }))
    kids.push(new Paragraph({ spacing: { before: 60, after: 600 }, children: [new TextRun({ text: meta.descripcion || "", size: 28, color: C.muted })] }))
    kids.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 18, color: C.accent, space: 8 } },
        spacing: { before: 0, after: 240 },
        children: [new TextRun({ text: meta.titulo, bold: true, size: 60, color: C.ink })],
    }))
    kids.push(new Paragraph({ spacing: { after: 360 }, children: [new TextRun({ text: meta.lector || "", italics: true, size: 21, color: C.muted })] }))
    const metaRows = [
        ["Producto", `${meta.producto} — ${meta.descripcion}`],
        ["Versión del producto", meta.version_producto],
        ["Versión del manual", meta.version_manual],
        ["Fecha", fechaLarga(meta.fecha)],
        ["Base verificada", meta.base],
    ]
    const w1 = 2600, w2 = CONTENT_W - w1
    kids.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [w1, w2], layout: TableLayoutType.FIXED,
        rows: metaRows.map(([k, v]) => new TableRow({ children: [
            new TableCell({ width: { size: w1, type: WidthType.DXA }, borders: cellBorders, shading: { type: ShadingType.CLEAR, color: "auto", fill: C.accentSoft }, margins: { top: 70, bottom: 70, left: 110, right: 110 }, children: [new Paragraph({ children: [new TextRun({ text: k, bold: true, size: 18, color: C.ink })] })] }),
            new TableCell({ width: { size: w2, type: WidthType.DXA }, borders: cellBorders, margins: { top: 70, bottom: 70, left: 110, right: 110 }, children: [new Paragraph({ children: inlineRuns(v || "", { size: 18, color: C.text }) })] }),
        ] })),
    }))
    kids.push(new Paragraph({ spacing: { before: 360, after: 120 }, children: [new TextRun({ text: "Historial de cambios", bold: true, size: 24, color: C.ink })] }))
    if (historial) kids.push(buildTable(historial.header, historial.body, { size: 17 }))
    kids.push(new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "Este documento no contiene secretos, contraseñas, direcciones IP, puertos ni dominios de producción. Los ejemplos usan valores ficticios.", size: 16, italics: true, color: C.muted })] }))
    kids.push(new Paragraph({ children: [new PageBreak()] }))
    // Índice
    kids.push(new Paragraph({ spacing: { before: 0, after: 240 }, children: [new TextRun({ text: "Contenido", bold: true, size: 36, color: C.ink })] }))
    kids.push(new TableOfContents("Contenido", { hyperlink: true, headingStyleRange: "1-3", cachedEntries: toc, beginDirty: false }))
    kids.push(new Paragraph({ children: [new PageBreak()] }))
    return kids
}

function brandRun() {
    return new TextRun({ text: "By AISerNet Company", font: BRAND_FONT, size: 20, color: C.ink })
}

function build(manual) {
    const mdPath = path.join(FUENTE, manual.md)
    const { meta, blocks } = parse(fs.readFileSync(mdPath, "utf8"))
    const hIdx = blocks.findIndex(b => b.t === "h" && b.text === "Historial de cambios")
    let historial = null
    if (hIdx >= 0 && blocks[hIdx + 1] && blocks[hIdx + 1].t === "table") {
        historial = blocks[hIdx + 1]
        blocks.splice(hIdx + 1, 1)
    }
    const pagesFile = path.join(TOC_PAGES_DIR, manual.docx.replace(/\.docx$/, ".json"))
    const pages = fs.existsSync(pagesFile) ? JSON.parse(fs.readFileSync(pagesFile, "utf8").replace(/^﻿/, "")) : {}
    if (!Object.keys(pages).length) console.warn(`AVISO: sin páginas calculadas para ${manual.docx}; el índice saldrá con 0. Ejecute calcular-paginas.ps1 y regenere.`)
    const toc = []
    const body = blocksToChildren(blocks, path.dirname(mdPath), toc, pages)

    const fontFile = process.env.NEBULA_FONT || path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Windows", "Fonts", "NEBULA-REGULAR.OTF")
    const fonts = []
    if (fs.existsSync(fontFile)) fonts.push({ name: BRAND_FONT, data: fs.readFileSync(fontFile), characterSet: CharacterSet.ANSI })
    else console.warn(`AVISO: no se encontró la fuente NEBULA en ${fontFile}; el crédito queda declarado con la familia "${BRAND_FONT}" y Word usará una fuente de respaldo. Registre el pendiente.`)

    const headerPara = new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
            new TextRun({ text: `${meta.producto} · ${meta.titulo}`, size: 16, color: C.muted, bold: true }),
            new TextRun({ children: [new Tab(), `Versión ${meta.version_manual} · ${fechaLarga(meta.fecha)}`], size: 16, color: C.muted }),
        ],
    })
    const footerPara = new Paragraph({
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: C.border, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
            brandRun(),
            new TextRun({ children: [new Tab(), "Página ", PageNumber.CURRENT, " de ", PageNumber.TOTAL_PAGES], size: 16, color: C.muted }),
        ],
    })
    const firstFooter = new Paragraph({ alignment: AlignmentType.LEFT, children: [brandRun()] })

    const doc = new Document({
        creator: "AISerNet Company — strata-documentador",
        title: `${meta.producto} — ${meta.titulo}`,
        description: `${meta.titulo} de ${meta.producto} ${meta.version_producto}. Versión ${meta.version_manual} (${meta.fecha}).`,
        keywords: "SISMAR, AISerNet, STRATA, manual",
        fonts,
        styles: {
            default: { document: { run: { font: BODY_FONT, size: 21, color: C.text }, paragraph: { spacing: { after: 120, line: 276 } } } },
            characterStyles: [
                { id: "IndexLink", name: "Index Link", run: { color: C.text } },
            ],
            paragraphStyles: [
                { id: "TOC1", name: "toc 1", basedOn: "Normal", next: "Normal", run: { bold: true, color: C.ink, size: 21 }, paragraph: { spacing: { before: 120, after: 40 } } },
                { id: "TOC2", name: "toc 2", basedOn: "Normal", next: "Normal", run: { color: C.text, size: 20 }, paragraph: { indent: { left: 320 }, spacing: { before: 0, after: 30 } } },
                { id: "TOC3", name: "toc 3", basedOn: "Normal", next: "Normal", run: { color: C.muted, size: 19 }, paragraph: { indent: { left: 640 }, spacing: { before: 0, after: 20 } } },
                { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, color: C.ink, font: BODY_FONT }, paragraph: { spacing: { before: 420, after: 160 }, keepNext: true, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 4 } } } },
                { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, color: C.ink, font: BODY_FONT }, paragraph: { spacing: { before: 280, after: 100 }, keepNext: true, outlineLevel: 1 } },
                { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, color: "0E6F78", font: BODY_FONT }, paragraph: { spacing: { before: 200, after: 80 }, keepNext: true, outlineLevel: 2 } },
            ],
        },
        numbering: {
            config: [
                { reference: "vinetas", levels: [
                    { level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } }, run: { color: C.accent } } },
                    { level: 1, format: LevelFormat.BULLET, text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 800, hanging: 260 } }, run: { color: C.accent } } },
                ] },
                { reference: "numeros", levels: [
                    { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 320 } }, run: { bold: true, color: C.ink } } },
                ] },
                { reference: "checks", levels: [
                    { level: 0, format: LevelFormat.BULLET, text: "☐", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 320 } }, run: { font: "Segoe UI Symbol", color: C.ink } } },
                ] },
            ],
        },
        sections: [{
            properties: { titlePage: true, page: { size: { width: PAGE.w, height: PAGE.h }, margin: { top: PAGE.my, bottom: PAGE.my, left: PAGE.mx, right: PAGE.mx, header: 600, footer: 600 } } },
            headers: { default: new Header({ children: [headerPara] }), first: new Header({ children: [new Paragraph({ children: [] })] }) },
            footers: { default: new Footer({ children: [footerPara] }), first: new Footer({ children: [firstFooter] }) },
            children: [...cover(meta, historial, toc), ...body],
        }],
    })
    return Packer.toBuffer(doc).then(async raw => {
        // docx-js fija la tabulación del índice para A4 (9025): se ajusta al ancho real.
        const zip = await JSZip.loadAsync(raw)
        let xml = await zip.file("word/document.xml").async("string")
        xml = xml.replace(/<w:tab w:val="clear" w:pos="\d+"\/>/g, "").replace(/w:val="right" w:pos="9025"/g, `w:val="right" w:pos="${CONTENT_W}"`)
        zip.file("word/document.xml", xml)
        const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
        const out = path.join(ROOT, manual.docx)
        fs.writeFileSync(out, buf)
        console.log(`✔ ${path.relative(process.cwd(), out)} (${buf.length} bytes, fuente NEBULA ${fonts.length ? "embebida" : "NO embebida"})`)
    })
}

;(async () => {
    const only = process.argv[2]
    for (const m of MANUALES) {
        if (only && !m.md.includes(only)) continue
        listInstance = 0
        await build(m)
    }
})().catch(e => { console.error(e); process.exit(1) })
