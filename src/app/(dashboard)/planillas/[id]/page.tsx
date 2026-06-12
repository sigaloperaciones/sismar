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

type PlanillaWithRelations = Prisma.PlanillaGetPayload<{
    include: {
        agencia: true,
        correspondencias: {
            include: { anexos: { include: { tipoAnexo: true } } }
        },
        recorridoPlanillas: { include: { recorrido: true } }
    }
}>

type CorrespondenciaWithDetails = Prisma.CorrespondenciaGetPayload<{
    include: { anexos: { include: { tipoAnexo: true } } }
}>

export default async function PlanillaDetailsPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    const id = parseInt(params.id)

    const planilla: PlanillaWithRelations | null = await prisma.planilla.findUnique({
        where: { id },
        include: {
            agencia: true,
            correspondencias: {
                include: { anexos: { include: { tipoAnexo: true } } }
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
        <div className="max-w-5xl mx-auto space-y-6">
            {hasOutgoing && (
                <style dangerouslySetInnerHTML={{ __html: `
                    @media print {
                        @page { size: landscape; margin: 10mm; }
                        body { -webkit-print-color-adjust: exact; }
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
                {/* Encabezado */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-8 py-6 print:bg-none print:border-b-2 print:border-black">
                    <div className="text-center">
                        <h1 className="text-white text-xl font-bold uppercase tracking-wide print:text-black">
                            {hasOutgoing 
                                ? "Planilla de Envío de Correspondencia Saliente" 
                                : "Planilla de Entrega de Correspondencia"}
                        </h1>
                    </div>
                    <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
                        <div className="flex items-center gap-2 text-slate-300 print:text-gray-600">
                            <Building2 className="w-4 h-4" />
                            <span className="font-semibold text-white print:text-black">{planilla.agencia.name}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1.5 text-slate-300 print:text-gray-600">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>{format(planilla.fechaGeneracion, "dd 'de' MMMM yyyy, HH:mm", { locale: es })}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-300 print:text-gray-600">
                                <Hash className="w-3.5 h-3.5" />
                                <span className="font-mono">Planilla #{planilla.id}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabla */}
                <div className="p-6 print:p-4">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                {hasOutgoing ? (
                                    <tr className="border-b-2 border-gray-200">
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600 w-8">#</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Fecha de Envío</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Agencia</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Nombre Destinatario</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Ciudad Destino</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Asunto</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Empresa de Mensajería</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600 w-36 print:w-48">Firma Mensajero</th>
                                        {planilla.estado === "GENERADA" && (
                                            <th className="text-center py-3 px-3 font-semibold text-gray-600 w-16 print:hidden">Acción</th>
                                        )}
                                    </tr>
                                ) : (
                                    <tr className="border-b-2 border-gray-200">
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600 w-8">#</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Fecha</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Remitente / Destinatario</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Asunto</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600">Anexos</th>
                                        <th className="text-left py-3 px-3 font-semibold text-gray-600 w-36 print:w-48">Estado / Firma</th>
                                        {planilla.estado === "GENERADA" && (
                                            <th className="text-center py-3 px-3 font-semibold text-gray-600 w-16 print:hidden">Acción</th>
                                        )}
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {planilla.correspondencias.map((item: CorrespondenciaWithDetails, i: number) => {
                                    if (hasOutgoing) {
                                        return (
                                            <tr key={item.id} className="border-b border-gray-100 print:border-gray-300">
                                                <td className="py-4 px-3 text-gray-400 text-xs">{i + 1}</td>
                                                <td className="py-4 px-3 text-gray-600 text-xs whitespace-nowrap">
                                                    {format(item.fechaRecepcion, "dd/MM/yy", { locale: es })}
                                                </td>
                                                <td className="py-4 px-3 text-gray-600 text-xs whitespace-nowrap">
                                                    {planilla.agencia.name}
                                                </td>
                                                <td className="py-4 px-3">
                                                    <p className="font-medium text-gray-800">{item.remitenteNombre || "—"}</p>
                                                </td>
                                                <td className="py-4 px-3 text-gray-600 text-xs">
                                                    {item.remitenteCiudad || "—"}
                                                </td>
                                                <td className="py-4 px-3 max-w-[200px]">
                                                    <p className="text-gray-700 line-clamp-3 text-xs">{item.asunto}</p>
                                                </td>
                                                <td className="py-4 px-3">
                                                    <p className="font-medium text-gray-800 text-xs">{item.empresaMensajeria || "—"}</p>
                                                    {(item.numeroGuia || item.mensajero) && (
                                                        <div className="text-[10px] text-gray-500 mt-0.5 space-y-0.5">
                                                            {item.numeroGuia && <p>Guía: <span className="font-semibold">{item.numeroGuia}</span></p>}
                                                            {item.mensajero && <p>Mensajero: <span className="font-semibold">{item.mensajero}</span></p>}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-4 px-3">
                                                    {planilla.estado === "PROCESADA" || planilla.estado === "CERRADA" ? (
                                                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                                                            Entregada
                                                        </span>
                                                    ) : (
                                                        <div className="h-10 border-b-2 border-gray-300 print:border-black" />
                                                    )}
                                                </td>
                                                {planilla.estado === "GENERADA" && (
                                                    <td className="py-4 px-3 text-center print:hidden">
                                                        <RemoveItemButton itemId={item.id} />
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    } else {
                                        return (
                                            <tr key={item.id} className="border-b border-gray-100 print:border-gray-300">
                                                <td className="py-4 px-3 text-gray-400 text-xs">{i + 1}</td>
                                                <td className="py-4 px-3 text-gray-600 text-xs whitespace-nowrap">
                                                    {format(item.fechaRecepcion, "dd/MM/yy", { locale: es })}
                                                </td>
                                                <td className="py-4 px-3">
                                                    <p className="font-medium text-gray-800">{item.remitenteNombre || item.destinatarioNombre || "—"}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">{item.empresaMensajeria}</p>
                                                </td>
                                                <td className="py-4 px-3 max-w-[200px]">
                                                    <p className="text-gray-700 line-clamp-3">{item.asunto}</p>
                                                </td>
                                                <td className="py-4 px-3">
                                                    {item.anexos.length === 0 ? (
                                                        <span className="text-gray-400 text-xs">—</span>
                                                    ) : (
                                                        <ul className="space-y-0.5">
                                                            {item.anexos.map((a: CorrespondenciaWithDetails['anexos'][number]) => (
                                                                <li key={a.id} className="text-xs text-gray-600">
                                                                    <span className="font-semibold">{a.cantidad}</span> {a.tipoAnexo.name}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </td>
                                                <td className="py-4 px-3">
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
                                                    <td className="py-4 px-3 text-center print:hidden">
                                                        <RemoveItemButton itemId={item.id} />
                                                    </td>
                                                )}
                                            </tr>
                                        )
                                    }
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-4 flex items-center justify-end">
                        <div className="bg-slate-50 print:bg-white rounded-lg px-4 py-2 text-sm border border-slate-200 print:border-gray-400">
                            Total de documentos:{" "}
                            <span className="font-bold text-gray-800">{planilla.correspondencias.length}</span>
                        </div>
                    </div>
                </div>

                {/* Firmas — solo en planillas no procesadas */}
                {planilla.estado !== "PROCESADA" && (
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
        </div>
    )
}

