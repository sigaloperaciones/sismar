import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import Link from "next/link"
import { Prisma } from "@prisma/client"
import { ArrowLeft, Building2, Calendar, Hash, Lock, Unlock, CheckCircle2 } from "lucide-react"
import PrintButton from "../PrintButton"
import PlanillaDetailStatusButton from "../PlanillaDetailStatusButton"
import RemoveItemButton from "./RemoveItemButton"
import UploadFirmaForm from "./UploadFirmaForm"
import FirmaPreview from "./FirmaPreview"

type PlanillaWithRelations = Prisma.PlanillaGetPayload<{
    include: {
        agencia: true,
        correspondencias: {
            include: { agencia: true, anexos: { include: { tipoAnexo: true, detalles: true } } }
        },
        recorridoPlanillas: { include: { recorrido: true } }
    }
}>

type CorrespondenciaWithDetails = Prisma.CorrespondenciaGetPayload<{
    include: { agencia: true, anexos: { include: { tipoAnexo: true, detalles: true } } }
}>

export default async function PlanillaDetailsPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    const id = parseInt(params.id)

    const planilla: PlanillaWithRelations | null = await prisma.planilla.findUnique({
        where: { id },
        include: {
            agencia: true,
            correspondencias: {
                include: { agencia: true, anexos: { include: { tipoAnexo: true, detalles: true } } }
            },
            recorridoPlanillas: { include: { recorrido: true } }
        }
    })

    if (!planilla) return notFound()

    const recorridoActivo = planilla.recorridoPlanillas.some(
        rp => rp.recorrido.estado === "INICIADO"
    )

    const estadoLabel = {
        GENERADA: "Generada",
        CERRADA: "Cerrada",
        PROCESADA: "Procesada",
    }[planilla.estado] ?? planilla.estado

    const estadoColor = {
        GENERADA: "bg-amber-100 text-amber-700",
        CERRADA: "bg-blue-100 text-blue-700",
        PROCESADA: "bg-green-100 text-green-700",
    }[planilla.estado] ?? "bg-gray-100 text-gray-700"

    const hasOutgoing = planilla.correspondencias.some(c => c.tipo === "SALIENTE")

    return (
        <div className="max-w-5xl mx-auto space-y-6 print:max-w-none print:mx-0 print:p-0 print:space-y-4">
            {hasOutgoing ? (
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        @page { size: landscape; margin: 5mm; }
                        body { 
                            -webkit-print-color-adjust: exact; 
                            print-color-adjust: exact;
                            background-color: white !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                    }
                `}} />
            ) : (
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        @page { size: portrait; margin: 10mm; }
                        body { 
                            -webkit-print-color-adjust: exact; 
                            print-color-adjust: exact;
                            background-color: white !important;
                            margin: 0 !important;
                            padding: 0 !important;
                        }
                    }
                `}} />
            )}

            {/* Barra de acciones */}
            <div className="flex items-center justify-between print:hidden flex-wrap gap-3">
                <Link
                    href="/planillas"
                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Planillas
                </Link>
                <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold px-3 py-1.5 rounded-xl ${estadoColor}`}>
                        {estadoLabel}
                    </span>
                    <PlanillaDetailStatusButton
                        planillaId={planilla.id}
                        estado={planilla.estado}
                        recorridoActivo={recorridoActivo}
                    />
                    <PrintButton />
                </div>
            </div>

            {/* Documento */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:rounded-none print:shadow-none print:border-none">
                {hasOutgoing ? (
                    <>
                        {Object.entries(
                            planilla.correspondencias.reduce((acc, c) => {
                                const key = c.empresaMensajeria || "Sin Empresa";
                                if (!acc[key]) acc[key] = [];
                                acc[key].push(c);
                                return acc;
                            }, {} as Record<string, CorrespondenciaWithDetails[]>)
                        ).map(([empresa, items], index) => (
                            <div key={empresa} className={index > 0 ? "mt-12 print:mt-0 print:break-before-page" : ""}>
                                {/* Encabezado para la empresa */}
                                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6 print:bg-none print:border-b-2 print:border-black print:px-0 print:py-2">
                                    <div className="text-center">
                                        <h1 className="text-white text-xl font-bold uppercase tracking-wide print:text-black print:text-base">
                                            Planilla de Envío de Correspondencia Saliente
                                        </h1>
                                    </div>
                                    <div className="flex items-center justify-between mt-4 print:mt-1 flex-wrap gap-3">
                                        <div className="flex items-center gap-2 text-slate-300 print:text-gray-600">
                                            <Building2 className="w-4 h-4" />
                                            <span className="font-semibold text-white print:text-black">Empresa: {empresa}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="flex items-center gap-1.5 text-slate-300 print:text-gray-600">
                                                <Calendar className="w-3.5 h-3.5" />
                                                <span>{format(planilla.fechaGeneracion, "dd 'de' MMMM yyyy, HH:mm", { locale: es })}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-slate-300 print:text-gray-600" title="Consecutivo interno único del sistema (identificador de la planilla)">
                                                <Hash className="w-3.5 h-3.5" />
                                                <span className="font-mono">Consecutivo interno No. {planilla.id}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 print:p-0 print:pt-2">
                                    <div className="overflow-x-auto print:overflow-visible">
                                        <table className="w-full text-sm print:text-[11px]">
                                            <thead>
                                                <tr className="border-b-2 border-gray-200">
                                                    <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600 w-8">#</th>
                                                    <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600">DEPENDENCIA</th>
                                                    <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600">LUGAR DE DESTINO</th>
                                                    <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600 w-64 print:w-auto">NOMBRE DESTINATARIO-ASUNTO</th>
                                                    <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600">No. SOBRES</th>
                                                    <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600 w-32 print:w-36">RECIBIDO POR</th>
                                                    <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600 w-32 print:w-36">ENTREGA RADICADOR</th>
                                                    {planilla.estado === "GENERADA" && (
                                                        <th className="text-center py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600 w-16 print:hidden">Acción</th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item, i) => (
                                                    <tr key={item.id} className="border-b border-gray-100 print:border-gray-300">
                                                        <td className="py-4 px-3 print:py-1.5 print:px-1 text-gray-400 text-xs">{i + 1}</td>
                                                        <td className="py-4 px-3 print:py-1.5 print:px-1 text-gray-800 text-xs font-medium">
                                                            {item.agencia?.name || planilla.agencia?.name || "—"}
                                                        </td>
                                                        <td className="py-4 px-3 print:py-1.5 print:px-1 text-gray-600 text-xs">
                                                            {item.remitenteCiudad || "—"}
                                                        </td>
                                                        <td className="py-4 px-3 print:py-1.5 print:px-1">
                                                            <p className="font-bold text-gray-800 text-xs">{item.remitenteNombre || "—"}</p>
                                                            <p className="text-gray-600 text-xs mt-1">{item.asunto}</p>
                                                        </td>
                                                        <td className="py-4 px-3 print:py-1.5 print:px-1 text-xs">
                                                            {item.anexos.length === 0 ? (
                                                                <span className="text-gray-400">—</span>
                                                            ) : (
                                                                <ul className="space-y-1">
                                                                    {item.anexos.map((a) => (
                                                                        <li key={a.id} className="text-gray-700">
                                                                            <span className="font-semibold">{a.cantidad}</span> {a.tipoAnexo.name}
                                                                            {a.detalles && a.detalles.length > 0 && (
                                                                                <div className="text-[10px] text-gray-500 ml-2 mt-0.5 border-l border-gray-200 pl-2">
                                                                                    {a.detalles.map(d => d.identificador).join(", ")}
                                                                                </div>
                                                                            )}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            )}
                                                        </td>
                                                        <td className="py-4 px-3 print:py-1.5 print:px-1">
                                                            <div className="h-10 border-b-2 border-gray-300 print:border-black" />
                                                        </td>
                                                        <td className="py-4 px-3 print:py-1.5 print:px-1">
                                                            <div className="h-10 border-b-2 border-gray-300 print:border-black" />
                                                        </td>
                                                        {planilla.estado === "GENERADA" && (
                                                            <td className="py-4 px-3 print:py-1.5 print:px-1 text-center print:hidden">
                                                                <RemoveItemButton itemId={item.id} />
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="mt-4 flex items-center justify-end">
                                            <div className="bg-slate-50 print:bg-white rounded-lg px-4 py-2 text-sm print:text-xs border border-slate-200 print:border-gray-400 print:px-2 print:py-1">
                                                Total de documentos (Empresa: {empresa}):{" "}
                                                <span className="font-bold text-gray-800">{items.length}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </>
                ) : (
                    <>
                        {/* Encabezado original para ENTRANTE */}
                        <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6 print:bg-none print:border-b-2 print:border-black print:px-0 print:py-2">
                            <div className="text-center">
                                <h1 className="text-white text-xl font-bold uppercase tracking-wide print:text-black print:text-base">
                                    Planilla de Entrega de Correspondencia
                                </h1>
                            </div>
                            <div className="flex items-center justify-between mt-4 print:mt-1 flex-wrap gap-3">
                                <div className="flex items-center gap-2 text-slate-300 print:text-gray-600">
                                    <Building2 className="w-4 h-4" />
                                    <span className="font-semibold text-white print:text-black">{planilla.agencia?.name}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                    <div className="flex items-center gap-1.5 text-slate-300 print:text-gray-600">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>{format(planilla.fechaGeneracion, "dd 'de' MMMM yyyy, HH:mm", { locale: es })}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-slate-300 print:text-gray-600" title="Consecutivo interno único del sistema (identificador de la planilla)">
                                        <Hash className="w-3.5 h-3.5" />
                                        <span className="font-mono">Consecutivo interno No. {planilla.id}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Tabla */}
                        <div className="p-6 print:p-0 print:pt-2">
                            <div className="overflow-x-auto print:overflow-visible">
                                <table className="w-full text-sm print:text-[11px]">
                                    <thead>
                                        <tr className="border-b-2 border-gray-200">
                                            <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600 w-8">#</th>
                                            <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600">Fecha</th>
                                            <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600">Remitente / Destinatario</th>
                                            <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600">Asunto</th>
                                            <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600">Anexos</th>
                                            <th className="text-left py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600 w-36 print:w-48">Estado / Firma</th>
                                            {planilla.estado === "GENERADA" && (
                                                <th className="text-center py-3 px-3 print:py-1.5 print:px-1 font-semibold text-gray-600 w-16 print:hidden">Acción</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {planilla.correspondencias.map((item: CorrespondenciaWithDetails, i: number) => (
                                            <tr key={item.id} className="border-b border-gray-100 print:border-gray-300">
                                                <td className="py-4 px-3 print:py-1.5 print:px-1 text-gray-400 text-xs">{i + 1}</td>
                                                <td className="py-4 px-3 print:py-1.5 print:px-1 text-gray-600 text-xs whitespace-nowrap">
                                                    {format(item.fechaRecepcion, "dd/MM/yy", { locale: es })}
                                                </td>
                                                <td className="py-4 px-3 print:py-1.5 print:px-1">
                                                    <p className="font-medium text-gray-800">{item.remitenteNombre || item.destinatarioNombre || "—"}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{item.empresaMensajeria}</p>
                                                </td>
                                                <td className="py-4 px-3 print:py-1.5 print:px-1 max-w-[200px]">
                                                    <p className="text-gray-700 line-clamp-3">{item.asunto}</p>
                                                </td>
                                                <td className="py-4 px-3 print:py-1.5 print:px-1">
                                                    {item.anexos.length === 0 ? (
                                                        <span className="text-gray-400 text-xs">—</span>
                                                    ) : (
                                                        <ul className="space-y-0.5">
                                                            {item.anexos.map((a: CorrespondenciaWithDetails['anexos'][number]) => (
                                                                <li key={a.id} className="text-xs text-gray-600">
                                                                    <span className="font-semibold">{a.cantidad}</span> {a.tipoAnexo.name}
                                                                    {a.detalles && a.detalles.length > 0 && (
                                                                        <div className="text-[10px] text-gray-500 ml-2 mt-0.5">
                                                                            ({a.detalles.map((d: any) => d.identificador).join(", ")})
                                                                        </div>
                                                                    )}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </td>
                                                <td className="py-4 px-3 print:py-1.5 print:px-1">
                                                    {planilla.estado === "PROCESADA" ? (
                                                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                                            item.estado === "ENTREGADA" ? "bg-green-100 text-green-700" :
                                                            item.estado === "DEVUELTA" ? "bg-red-100 text-red-700" :
                                                            "bg-gray-100 text-gray-600"
                                                        }`}>
                                                            {item.estado === "ENTREGADA" ? "Entregada" :
                                                             item.estado === "DEVUELTA" ? "Devuelta" : "Pendiente"}
                                                        </span>
                                                    ) : (
                                                        <div className="h-12 border-b-2 border-gray-300 print:border-black" />
                                                    )}
                                                </td>
                                                {planilla.estado === "GENERADA" && (
                                                    <td className="py-4 px-3 print:py-1.5 print:px-1 text-center print:hidden">
                                                        <RemoveItemButton itemId={item.id} />
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-4 flex items-center justify-end">
                                <div className="bg-slate-50 print:bg-white rounded-lg px-4 py-2 text-sm print:text-xs border border-slate-200 print:border-gray-400 print:px-2 print:py-1">
                                    Total de documentos:{" "}
                                    <span className="font-bold text-gray-800">{planilla.correspondencias.length}</span>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Firmas — solo en planillas no procesadas de tipo ENTRANTE */}
                {planilla.estado !== "PROCESADA" && !hasOutgoing && (
                    <div className="px-8 pb-8 pt-4 print:px-4">
                        <div className="grid grid-cols-2 gap-16 mt-6">
                            <div className="text-center">
                                <div className="border-t-2 border-gray-400 print:border-black pt-3">
                                    <p className="text-sm font-medium text-gray-700">Entregado Por</p>
                                    <p className="text-xs text-gray-500 mt-1">Mensajero / Transportador</p>
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="border-t-2 border-gray-400 print:border-black pt-3">
                                    <p className="text-sm font-medium text-gray-700">Recibido Por</p>
                                    <p className="text-xs text-gray-500 mt-1">Responsable de Agencia</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {hasOutgoing && planilla.estado !== "GENERADA" && (
                <UploadFirmaForm planillaId={planilla.id} currentUrl={planilla.documentoFirmaUrl} />
            )}

            {/* Req. cliente #4: previsualización del PDF/imagen de firma adjunto */}
            {hasOutgoing && planilla.documentoFirmaUrl && (
                <FirmaPreview url={planilla.documentoFirmaUrl} />
            )}
        </div>
    )
}

