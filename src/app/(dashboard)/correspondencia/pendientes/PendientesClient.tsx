"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { updateMailAction } from "@/app/actions/correspondencia"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { 
    Search, 
    Edit2, 
    Inbox, 
    Send, 
    X, 
    AlertCircle, 
    FileText, 
    ExternalLink, 
    Save, 
    User, 
    MapPin, 
    Building2,
    Calendar,
    Truck,
    HelpCircle
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Mail {
    id: number
    consecutive: string | null
    tipo: string
    fechaRecepcion: Date
    empresaMensajeria: string | null
    remitenteNombre: string | null
    remitenteCiudad: string | null
    asunto: string
    importancia: string
    necesitaRespuesta: boolean
    estado: string
    agenciaId: number
    agencia: {
        id: number
        name: string
    }
    numeroGuia: string | null
    mensajero: string | null
    guiaUrl: string | null
}

interface Ciudad {
    nombre: string
    departamento: string
}

interface Empresa {
    nombre: string
}

interface Agencia {
    id: number
    name: string
}

interface PendientesClientProps {
    entrantes: any[]
    salientes: any[]
    ciudades: Ciudad[]
    empresas: Empresa[]
    agencias: Agencia[]
}

export default function PendientesClient({
    entrantes,
    salientes,
    ciudades,
    empresas,
    agencias,
}: PendientesClientProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [isPending, startTransition] = useTransition()

    const [activeTab, setActiveTab] = useState<"entrante" | "saliente">("entrante")
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedMail, setSelectedMail] = useState<Mail | null>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // Form inputs state
    const [formRemitente, setFormRemitente] = useState("")
    const [formCiudad, setFormCiudad] = useState("")
    const [formAsunto, setFormAsunto] = useState("")
    const [formImportancia, setFormImportancia] = useState("NORMAL")
    const [formNecesitaRespuesta, setFormNecesitaRespuesta] = useState(false)
    const [formEmpresaMensajeria, setFormEmpresaMensajeria] = useState("")
    const [formNumeroGuia, setFormNumeroGuia] = useState("")
    const [formMensajero, setFormMensajero] = useState("")

    const fileInputRef = useRef<HTMLInputElement>(null)

    const ciudadOptions = ciudades.map(c => ({
        value: `${c.nombre} - ${c.departamento}`,
        label: `${c.nombre} - ${c.departamento}`
    }))

    const empresaOptions = empresas.map(e => ({
        value: e.nombre,
        label: e.nombre
    }))

    const activeList = activeTab === "entrante" ? entrantes : salientes

    const filteredList = activeList.filter((mail) => {
        const query = searchQuery.toLowerCase()
        return (
            (mail.consecutive || "").toLowerCase().includes(query) ||
            (mail.remitenteNombre || "").toLowerCase().includes(query) ||
            (mail.asunto || "").toLowerCase().includes(query) ||
            (mail.agencia?.name || "").toLowerCase().includes(query)
        )
    })

    const handleOpenModal = (mail: Mail) => {
        setSelectedMail(mail)
        setFormRemitente(mail.remitenteNombre || "")
        setFormCiudad(mail.remitenteCiudad || "")
        setFormAsunto(mail.asunto || "")
        setFormImportancia(mail.importancia || "NORMAL")
        setFormNecesitaRespuesta(mail.necesitaRespuesta || false)
        setFormEmpresaMensajeria(mail.empresaMensajeria || "")
        setFormNumeroGuia(mail.numeroGuia || "")
        setFormMensajero(mail.mensajero || "")
        setIsModalOpen(true)
    }

    const handleCloseModal = () => {
        setSelectedMail(null)
        setIsModalOpen(false)
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (!selectedMail) return

        if (!formRemitente.trim()) {
            toast({
                title: "Campo requerido",
                description: selectedMail.tipo === "ENTRANTE" ? "El remitente es requerido." : "El destinatario es requerido.",
                variant: "destructive"
            })
            return
        }

        if (!formAsunto.trim()) {
            toast({
                title: "Campo requerido",
                description: "El asunto es requerido.",
                variant: "destructive"
            })
            return
        }

        const formData = new FormData()
        formData.append("id", String(selectedMail.id))
        formData.append("tipo", selectedMail.tipo)
        formData.append("remitenteNombre", formRemitente)
        formData.append("remitenteCiudad", formCiudad)
        formData.append("asunto", formAsunto)
        formData.append("importancia", formImportancia)
        formData.append("empresaMensajeria", formEmpresaMensajeria)

        if (selectedMail.tipo === "ENTRANTE") {
            formData.append("necesitaRespuesta", String(formNecesitaRespuesta))
        } else {
            formData.append("numeroGuia", formNumeroGuia)
            formData.append("mensajero", formMensajero)
            
            // Adjuntar archivo si existe
            if (fileInputRef.current?.files?.[0]) {
                formData.append("guiaFile", fileInputRef.current.files[0])
            }
            if (selectedMail.guiaUrl) {
                formData.append("guiaUrl", selectedMail.guiaUrl)
            }
        }

        startTransition(async () => {
            const res = await updateMailAction(null, formData)
            if (res.error) {
                toast({
                    title: "Error al actualizar",
                    description: res.error,
                    variant: "destructive"
                })
            } else {
                toast({
                    title: "Actualización exitosa",
                    description: res.message || "La correspondencia ha sido actualizada correctamente."
                })
                handleCloseModal()
                router.refresh()
            }
        })
    }

    return (
        <div className="space-y-6">
            {/* Tabs & Search */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex p-1 bg-gray-100 rounded-xl w-full md:w-auto">
                    <button
                        onClick={() => { setActiveTab("entrante"); setSearchQuery("") }}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === "entrante"
                                ? "bg-white text-blue-600 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        <Inbox className="w-4 h-4" />
                        Entrante Pendiente ({entrantes.length})
                    </button>
                    <button
                        onClick={() => { setActiveTab("saliente"); setSearchQuery("") }}
                        className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                            activeTab === "saliente"
                                ? "bg-white text-emerald-600 shadow-sm"
                                : "text-gray-600 hover:text-gray-900"
                        }`}
                    >
                        <Send className="w-4 h-4" />
                        Saliente Pendiente ({salientes.length})
                    </button>
                </div>

                <div className="relative w-full md:w-80">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por consecut., persona o asunto..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50/50 hover:bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                </div>
            </div>

            {/* List Table */}
            <Card className="border-gray-100 shadow-sm overflow-hidden rounded-2xl">
                <CardContent className="p-0">
                    {filteredList.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                            <AlertCircle className="w-12 h-12 mb-3 opacity-30" />
                            <p className="text-base font-medium">No se encontraron correspondencias pendientes</p>
                            <p className="text-xs mt-1 text-gray-500">Intente con otro filtro o registre nuevos documentos</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 border-b border-gray-100 text-gray-600 font-semibold uppercase tracking-wider text-xs">
                                    {activeTab === "entrante" ? (
                                        <tr>
                                            <th className="py-4 px-4 w-24">Consecutivo</th>
                                            <th className="py-4 px-4">Fecha</th>
                                            <th className="py-4 px-4">Remitente / Empresa</th>
                                            <th className="py-4 px-4">Asunto</th>
                                            <th className="py-4 px-4">Agencia Destino</th>
                                            <th className="py-4 px-4 w-28">Importancia</th>
                                            <th className="py-4 px-4 w-24 text-center">Acciones</th>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <th className="py-4 px-4 w-24">Consecutivo</th>
                                            <th className="py-4 px-4">Fecha</th>
                                            <th className="py-4 px-4">Destinatario / Ciudad</th>
                                            <th className="py-4 px-4">Asunto</th>
                                            <th className="py-4 px-4">Agencia Remitente</th>
                                            <th className="py-4 px-4">Datos Envío</th>
                                            <th className="py-4 px-4 w-24 text-center">Acciones</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredList.map((mail) => (
                                        <tr key={mail.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="py-4 px-4 font-mono text-xs font-semibold text-gray-700">
                                                {mail.consecutive || `ID: ${mail.id}`}
                                            </td>
                                            <td className="py-4 px-4 text-xs text-gray-500 whitespace-nowrap">
                                                {format(new Date(mail.fechaRecepcion), "dd 'de' MMM, HH:mm", { locale: es })}
                                            </td>
                                            <td className="py-4 px-4">
                                                <div className="font-semibold text-gray-900">{mail.remitenteNombre || "—"}</div>
                                                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                    {mail.remitenteCiudad && (
                                                        <>
                                                            <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                                                            <span>{mail.remitenteCiudad}</span>
                                                        </>
                                                    )}
                                                    {activeTab === "entrante" && mail.empresaMensajeria && (
                                                        <>
                                                            {mail.remitenteCiudad && <span className="text-gray-300">•</span>}
                                                            <Truck className="w-3 h-3 text-gray-400 shrink-0" />
                                                            <span>{mail.empresaMensajeria}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 max-w-[280px]">
                                                <p className="text-gray-700 line-clamp-2 text-xs">{mail.asunto}</p>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                    <Building2 className="w-3.5 h-3.5" />
                                                    {mail.agencia?.name || "—"}
                                                </span>
                                            </td>
                                            {activeTab === "entrante" ? (
                                                <td className="py-4 px-4 whitespace-nowrap space-y-1">
                                                    <div className="flex gap-1.5 flex-wrap">
                                                        {mail.importancia === "ALTA" ? (
                                                            <Badge variant="destructive" className="text-[10px] uppercase font-bold py-0.5 px-2">Alta</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-[10px] text-gray-600 bg-gray-100 uppercase font-semibold py-0.5 px-2">Normal</Badge>
                                                        )}
                                                        {mail.necesitaRespuesta && (
                                                            <Badge className="text-[10px] text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/50 font-semibold py-0.5 px-2">Requiere Rpta</Badge>
                                                        )}
                                                    </div>
                                                </td>
                                            ) : (
                                                <td className="py-4 px-4 text-xs space-y-1 max-w-[200px]">
                                                    {(!mail.numeroGuia && !mail.empresaMensajeria && !mail.mensajero) ? (
                                                        <span className="text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg font-medium inline-block text-[11px]">
                                                            Falta datos envío
                                                        </span>
                                                    ) : (
                                                        <div className="space-y-1 text-gray-700 bg-gray-50 border border-gray-100 rounded-lg p-2">
                                                            {mail.empresaMensajeria && (
                                                                <p className="flex items-center gap-1.5"><Truck className="w-3.5 h-3.5 text-gray-400" /> <span className="font-semibold">{mail.empresaMensajeria}</span></p>
                                                            )}
                                                            {mail.numeroGuia && (
                                                                <p className="flex items-center gap-1.5 font-mono text-[10px]"><FileText className="w-3.5 h-3.5 text-gray-400" /> Guía: <span className="font-bold">{mail.numeroGuia}</span></p>
                                                            )}
                                                            {mail.mensajero && (
                                                                <p className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-gray-400" /> Mensajero: <span className="font-semibold">{mail.mensajero}</span></p>
                                                            )}
                                                            {mail.guiaUrl && (
                                                                <a 
                                                                    href={mail.guiaUrl} 
                                                                    target="_blank" 
                                                                    rel="noreferrer"
                                                                    className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 hover:text-emerald-700 mt-1 cursor-pointer"
                                                                >
                                                                    <ExternalLink className="w-3 h-3" /> Ver Guía Adjunta
                                                                </a>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                            <td className="py-4 px-4 text-center">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenModal(mail)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border-gray-200 text-gray-700 hover:bg-slate-50 transition-all text-xs"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                    Completar
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Premium Modal Dialog */}
            {isModalOpen && selectedMail && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className={`px-6 py-5 flex items-center justify-between text-white ${
                            selectedMail.tipo === "ENTRANTE"
                                ? "bg-gradient-to-r from-blue-600 to-indigo-500"
                                : "bg-gradient-to-r from-emerald-600 to-teal-500"
                        }`}>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                                    {selectedMail.tipo === "ENTRANTE" ? <Inbox className="w-5 h-5 text-white" /> : <Send className="w-5 h-5 text-white" />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg">Completar Correspondencia</h3>
                                    <p className="text-white/80 text-xs font-mono mt-0.5">Consecutivo: {selectedMail.consecutive || `ID: ${selectedMail.id}`}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleCloseModal}
                                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6" noValidate>
                            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-gray-400" /> Agencia:</span>
                                    <span className="font-semibold text-gray-800">{selectedMail.agencia?.name || "—"}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-500 font-medium flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-gray-400" /> Fecha Registro:</span>
                                    <span className="text-gray-800">{format(new Date(selectedMail.fechaRecepcion), "dd/MM/yyyy HH:mm", { locale: es })}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Remitente / Destinatario */}
                                    <div>
                                        <Label htmlFor="formRemitente" className="text-sm font-semibold text-gray-700 mb-1 block">
                                            {selectedMail.tipo === "ENTRANTE" ? "Nombre Remitente" : "Nombre Destinatario"} <span className="text-red-500">*</span>
                                        </Label>
                                        <Input
                                            id="formRemitente"
                                            value={formRemitente}
                                            onChange={(e) => setFormRemitente(e.target.value)}
                                            placeholder={selectedMail.tipo === "ENTRANTE" ? "Nombre de quien envía" : "Nombre de quien recibe"}
                                            className="border-gray-200 focus:ring-blue-500"
                                            required
                                        />
                                    </div>

                                    {/* Ciudad */}
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                                            {selectedMail.tipo === "ENTRANTE" ? "Ciudad de Origen" : "Ciudad Destino"}
                                        </Label>
                                        <SearchableSelect
                                            options={ciudadOptions}
                                            value={formCiudad}
                                            onChange={setFormCiudad}
                                            placeholder="Seleccione ciudad..."
                                            searchPlaceholder="Buscar ciudad..."
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Empresa Mensajería */}
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                                            Empresa de Mensajería
                                        </Label>
                                        <SearchableSelect
                                            options={empresaOptions}
                                            value={formEmpresaMensajeria}
                                            onChange={setFormEmpresaMensajeria}
                                            placeholder="Seleccione empresa..."
                                            searchPlaceholder="Buscar empresa..."
                                        />
                                    </div>

                                    {/* Importancia */}
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700 mb-1 block">
                                            Nivel de Importancia
                                        </Label>
                                        <div className="flex rounded-lg overflow-hidden border border-gray-200 h-10 bg-white">
                                            <button
                                                type="button"
                                                onClick={() => setFormImportancia("NORMAL")}
                                                className={`flex-1 text-xs font-semibold transition-colors ${
                                                    formImportancia === "NORMAL"
                                                        ? "bg-blue-600 text-white"
                                                        : "text-gray-600 hover:bg-gray-50"
                                                }`}
                                            >
                                                Normal
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormImportancia("ALTA")}
                                                className={`flex-1 text-xs font-semibold transition-colors border-l border-gray-200 ${
                                                    formImportancia === "ALTA"
                                                        ? "bg-red-500 text-white"
                                                        : "text-gray-600 hover:bg-gray-50"
                                                }`}
                                            >
                                                Alta
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Asunto */}
                                <div>
                                    <Label htmlFor="formAsunto" className="text-sm font-semibold text-gray-700 mb-1 block">
                                        Asunto / Detalle <span className="text-red-500">*</span>
                                    </Label>
                                    <Textarea
                                        id="formAsunto"
                                        value={formAsunto}
                                        onChange={(e) => setFormAsunto(e.target.value)}
                                        placeholder="Descripción o asunto del correo..."
                                        className="min-h-[100px] border-gray-200 focus:ring-blue-500"
                                        required
                                    />
                                </div>

                                {/* Condicionales por Tipo */}
                                {selectedMail.tipo === "ENTRANTE" ? (
                                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                        <input
                                            type="checkbox"
                                            id="formNecesitaRespuesta"
                                            checked={formNecesitaRespuesta}
                                            onChange={(e) => setFormNecesitaRespuesta(e.target.checked)}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <Label htmlFor="formNecesitaRespuesta" className="text-sm text-gray-700 font-medium select-none cursor-pointer">
                                            ¿Esta correspondencia requiere respuesta de la agencia?
                                        </Label>
                                    </div>
                                ) : (
                                    <div className="pt-4 border-t border-gray-100 space-y-4">
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Datos de Envío y Despacho</h4>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {/* Guía */}
                                            <div>
                                                <Label htmlFor="formNumeroGuia" className="text-xs font-semibold text-gray-700 mb-1 block">
                                                    Número de GUIA
                                                </Label>
                                                <Input
                                                    id="formNumeroGuia"
                                                    value={formNumeroGuia}
                                                    onChange={(e) => setFormNumeroGuia(e.target.value)}
                                                    placeholder="Ej: GUIA123456789"
                                                    className="border-gray-200 focus:ring-emerald-500 text-xs h-9"
                                                />
                                            </div>

                                            {/* Mensajero */}
                                            <div>
                                                <Label htmlFor="formMensajero" className="text-xs font-semibold text-gray-700 mb-1 block">
                                                    Nombre del Mensajero
                                                </Label>
                                                <Input
                                                    id="formMensajero"
                                                    value={formMensajero}
                                                    onChange={(e) => setFormMensajero(e.target.value)}
                                                    placeholder="Nombre completo"
                                                    className="border-gray-200 focus:ring-emerald-500 text-xs h-9"
                                                />
                                            </div>
                                        </div>

                                        {/* Foto/PDF Guía */}
                                        <div className="space-y-1">
                                            <Label htmlFor="guiaFile" className="text-xs font-semibold text-gray-700 mb-1 block">
                                                Anexar Foto o PDF de la Guía
                                            </Label>
                                            <input
                                                type="file"
                                                id="guiaFile"
                                                ref={fileInputRef}
                                                accept=".pdf,image/*"
                                                className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-250 cursor-pointer border border-gray-150 rounded-xl p-1 bg-white"
                                            />
                                            {selectedMail.guiaUrl && (
                                                <p className="text-[11px] text-gray-500 mt-1">
                                                    Ya hay un documento adjunto.{" "}
                                                    <a 
                                                        href={selectedMail.guiaUrl} 
                                                        target="_blank" 
                                                        rel="noreferrer" 
                                                        className="text-blue-600 hover:underline inline-flex items-center gap-0.5 font-semibold"
                                                    >
                                                        Ver actual <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                </p>
                                            )}
                                        </div>

                                        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex gap-3 text-xs text-emerald-800">
                                            <HelpCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-semibold">Notificación por Correo</p>
                                                <p className="text-emerald-700 mt-0.5">Al completar la Guía, Transportadora, Mensajero y Foto/PDF, se enviará un correo automático a la agencia notificando el envío.</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-150 shrink-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 border-gray-200 text-gray-600 hover:bg-gray-50 text-xs"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isPending}
                                    className={`px-5 py-2 font-semibold text-white rounded-xl text-xs flex items-center gap-1.5 ${
                                        selectedMail.tipo === "ENTRANTE"
                                            ? "bg-blue-600 hover:bg-blue-700"
                                            : "bg-emerald-600 hover:bg-emerald-700"
                                    }`}
                                >
                                    {isPending ? (
                                        <>
                                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                            </svg>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-4 h-4" />
                                            Guardar Cambios
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
