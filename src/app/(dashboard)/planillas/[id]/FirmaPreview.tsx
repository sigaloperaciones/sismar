import { FileCheck, ExternalLink } from "lucide-react"

/**
 * Previsualización embebida del documento de firma (soporte) de una planilla
 * saliente. (Req. cliente #4: tras cargar la firma, el usuario debe poder
 * VISUALIZAR el PDF/imagen adjunto para verificar que quedó correctamente
 * asociado — antes solo existía un enlace pequeño.)
 *
 * El endpoint /api/uploads sirve PDF/PNG/JPG inline con la sesión del usuario,
 * por lo que el <iframe>/<img> del mismo origen puede renderizarlos.
 */
function extractName(url: string): string {
    try {
        // Soporta tanto "/uploads/archivo.pdf" como "/api/uploads?filename=archivo.pdf"
        const qsIndex = url.indexOf("filename=")
        if (qsIndex !== -1) {
            return decodeURIComponent(url.slice(qsIndex + "filename=".length).split("&")[0])
        }
        return url.split("/").pop() || url
    } catch {
        return url
    }
}

export default function FirmaPreview({ url }: { url: string }) {
    const name = extractName(url)
    const ext = (name.split(".").pop() || "").toLowerCase()
    const isPdf = ext === "pdf"
    const isImage = ["png", "jpg", "jpeg", "gif"].includes(ext)

    return (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 print:hidden mt-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-emerald-600" />
                    Documento de Firma Adjunto
                </h3>
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition-colors"
                >
                    <ExternalLink className="w-4 h-4" /> Abrir en nueva pestaña
                </a>
            </div>

            {isPdf ? (
                <iframe
                    src={url}
                    title="Documento de firma (PDF)"
                    className="w-full h-[600px] rounded-xl border border-gray-200 bg-gray-50"
                />
            ) : isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={url}
                    alt="Documento de firma"
                    className="max-w-full max-h-[600px] rounded-xl border border-gray-200 mx-auto"
                />
            ) : (
                <p className="text-sm text-gray-500">
                    No se puede previsualizar este tipo de archivo. Use “Abrir en nueva pestaña” para descargarlo.
                </p>
            )}
        </div>
    )
}
