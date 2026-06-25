"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { registerOutgoingMail, updateMailAction } from "@/app/actions/correspondencia"
import { useToast } from "@/components/ui/use-toast"
import { outgoingMailSchema, type OutgoingMailFormData } from "@/lib/schemas/correspondencia"
import { Building2, User, MapPin, AlertCircle, RotateCcw, ArrowUpRight } from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"

interface Agencia { id: number; name: string }
interface Ciudad { nombre: string; departamento: string }
interface Empresa { nombre: string; nombreMensajero?: string | null }
interface TipoAnexo { id: number; name: string }

function FieldError({ message }: { message?: string }) {
    if (!message) return null
    return (
        <p className="flex items-center gap-1 text-red-500 text-xs mt-1">
            <AlertCircle className="w-3 h-3" /> {message}
        </p>
    )
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
    return (
        <div className="flex items-start gap-3 pb-3 border-b border-gray-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                {icon}
            </div>
            <div>
                <p className="font-semibold text-gray-800 text-sm">{title}</p>
                {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
        </div>
    )
}

export default function OutgoingMailForm({ agencias, ciudades, empresas, tiposAnexo, onSuccess, initialData }: { agencias: Agencia[], ciudades: Ciudad[], empresas: Empresa[], tiposAnexo: TipoAnexo[], onSuccess?: () => void, initialData?: any }) {
    const { toast } = useToast()

    const initialAttachments = initialData?.anexos && initialData.anexos.length > 0
        ? initialData.anexos.map((a: any) => ({
            typeId: String(a.tipoAnexoId),
            quantity: a.cantidad,
            identifiers: a.detalles && a.detalles.length > 0 
                ? a.detalles.map((d: any) => d.identificador) 
                : Array(a.cantidad).fill("")
        }))
        : [{ typeId: "", quantity: 1, identifiers: [""] }]

    const [attachments, setAttachments] = useState<{ typeId: string, quantity: number, identifiers: string[] }[]>(initialAttachments)
    const [nombreMensajero, setNombreMensajero] = useState(initialData?.mensajero || "")
    const [numeroGuia, setNumeroGuia] = useState(initialData?.numeroGuia || "")
    const [guiaFile, setGuiaFile] = useState<File | null>(null)

    const ciudadOptions = ciudades.map(c => ({
        value: `${c.nombre} - ${c.departamento}`,
        label: `${c.nombre} - ${c.departamento}`
    }))
    const empresaOptions = empresas.map(e => ({
        value: e.nombre,
        label: e.nombre
    }))

    const form = useForm<OutgoingMailFormData>({
        resolver: zodResolver(outgoingMailSchema),
        defaultValues: { 
            importancia: initialData?.importancia || "NORMAL",
            agenciaId: initialData?.agenciaId ? String(initialData.agenciaId) : "",
            empresaMensajeria: initialData?.empresaMensajeria || "",
            destinatarioNombre: initialData?.remitenteNombre || "",
            destinatarioCiudad: initialData?.remitenteCiudad || "",
            asunto: initialData?.asunto || "",
        },
    })
    const { formState: { errors, isSubmitting }, watch, setValue } = form
    const importancia = watch("importancia")
    const selectedEmpresa = watch("empresaMensajeria")

    const addAttachment = () => setAttachments([...attachments, { typeId: "", quantity: 1, identifiers: [""] }])
    const removeAttachment = (index: number) => setAttachments(attachments.filter((_, i) => i !== index))
    const updateAttachment = (index: number, field: "typeId", value: string) => {
        setAttachments(attachments.map((a, i) => i === index ? { ...a, [field]: value } : a))
    }
    const updateAttachmentQuantity = (index: number, quantity: number) => {
        setAttachments(attachments.map((a, i) => {
            if (i === index) {
                const newIdentifiers = [...a.identifiers]
                if (quantity > newIdentifiers.length) {
                    newIdentifiers.push(...Array(quantity - newIdentifiers.length).fill(""))
                } else {
                    newIdentifiers.length = quantity
                }
                return { ...a, quantity, identifiers: newIdentifiers }
            }
            return a
        }))
    }
    const updateAttachmentIdentifier = (index: number, idIndex: number, value: string) => {
        setAttachments(attachments.map((a, i) => {
            if (i === index) {
                const newIdentifiers = [...a.identifiers]
                newIdentifiers[idIndex] = value
                return { ...a, identifiers: newIdentifiers }
            }
            return a
        }))
    }

    const onSubmit = async (data: OutgoingMailFormData) => {
        const formData = new FormData()
        if (initialData) {
            formData.append("id", String(initialData.id))
            formData.append("tipo", "SALIENTE")
        }
        formData.append("agenciaId", data.agenciaId)
        formData.append("empresaMensajeria", data.empresaMensajeria)
        formData.append("destinatarioNombre", data.destinatarioNombre)
        formData.append("destinatarioCiudad", data.destinatarioCiudad ?? "")
        formData.append("asunto", data.asunto)
        formData.append("importancia", data.importancia)
        formData.append("mensajero", nombreMensajero)
        formData.append("numeroGuia", numeroGuia)
        if (guiaFile) {
            formData.append("guiaFile", guiaFile)
        }

        for (const att of attachments) {
            if (att.typeId) {
                formData.append("anexoType", att.typeId)
                formData.append("anexoQuantity", String(att.quantity))
                formData.append("anexoIdentifiers", JSON.stringify(att.identifiers))
            }
        }

        const res = initialData
            ? await updateMailAction(null, formData)
            : await registerOutgoingMail(null, formData)

        if (res?.error) {
            toast({ title: "Error al registrar", description: res.error, variant: "destructive" })
        } else {
            toast({ title: initialData ? "Correspondencia actualizada" : "Correspondencia registrada", description: initialData ? "Los cambios fueron guardados exitosamente." : "La salida fue registrada exitosamente." })
            form.reset()
            setAttachments([{ typeId: "", quantity: 1, identifiers: [""] }])
            setNombreMensajero("")
            setNumeroGuia("")
            setGuiaFile(null)
            onSuccess?.()
        }
    }

    const inputClass = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white transition"
    const labelClass = "block text-sm font-medium text-gray-700 mb-1"

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <ArrowUpRight className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-white font-bold text-lg">{initialData ? "Editar Correspondencia Saliente" : "Registrar Correspondencia Saliente"}</h2>
                        <p className="text-emerald-100 text-sm">{initialData ? "Modifique los datos de la correspondencia" : "Registre la correspondencia que sale hacia el exterior"}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                <div className="p-6 space-y-7">

                    {/* Sección 1: Origen */}
                    <div className="space-y-4">
                        <SectionHeader
                            icon={<Building2 className="w-4 h-4" />}
                            title="Agencia de Origen"
                            subtitle="Agencia desde la cual sale la correspondencia"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>
                                    Agencia / Área <span className="text-red-500">*</span>
                                </label>
                                <Controller
                                    name="agenciaId"
                                    control={form.control}
                                    render={({ field }) => (
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <SelectTrigger className="border-gray-200 focus:ring-emerald-500">
                                                <SelectValue placeholder="Seleccione la agencia origen..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {agencias.map(a => (
                                                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                />
                                <FieldError message={errors.agenciaId?.message} />
                            </div>

                            <div>
                                <label className={labelClass}>
                                    Empresa Mensajería <span className="text-red-500">*</span>
                                </label>
                                <Controller
                                    name="empresaMensajeria"
                                    control={form.control}
                                    render={({ field }) => (
                                        <SearchableSelect
                                            options={empresaOptions}
                                            value={field.value}
                                            onChange={(val) => {
                                                field.onChange(val)
                                                const emp = empresas.find(e => e.nombre === val)
                                                if (emp && emp.nombreMensajero) {
                                                    setNombreMensajero(emp.nombreMensajero)
                                                } else {
                                                    setNombreMensajero("")
                                                }
                                            }}
                                            placeholder="Seleccione empresa..."
                                            searchPlaceholder="Buscar empresa..."
                                        />
                                    )}
                                />
                                <FieldError message={errors.empresaMensajeria?.message} />
                            </div>

                            <div>
                                <label className={labelClass}>Importancia</label>
                                <div className="flex rounded-lg overflow-hidden border border-gray-200 h-10">
                                    <button
                                        type="button"
                                        onClick={() => setValue("importancia", "NORMAL")}
                                        className={`flex-1 text-sm font-medium transition-colors ${importancia === "NORMAL"
                                                ? "bg-emerald-600 text-white"
                                                : "bg-white text-gray-600 hover:bg-gray-50"
                                            }`}
                                    >
                                        Normal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setValue("importancia", "ALTA")}
                                        className={`flex-1 text-sm font-medium transition-colors border-l border-gray-200 ${importancia === "ALTA"
                                                ? "bg-red-500 text-white"
                                                : "bg-white text-gray-600 hover:bg-gray-50"
                                            }`}
                                    >
                                        Alta
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección 2: Destinatario */}
                    <div className="space-y-4">
                        <SectionHeader
                            icon={<User className="w-4 h-4" />}
                            title="Datos del Destinatario"
                            subtitle="Persona u organización que recibirá la correspondencia"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="destinatarioNombre" className={labelClass}>
                                    Nombre Destinatario <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="destinatarioNombre"
                                    placeholder="Nombre completo o razón social"
                                    className={inputClass}
                                    {...form.register("destinatarioNombre")}
                                />
                                <FieldError message={errors.destinatarioNombre?.message} />
                            </div>
                            <div>
                                <label className={labelClass}>
                                    Ciudad Destino
                                </label>
                                <div className="relative mt-1">
                                    <Controller
                                        name="destinatarioCiudad"
                                        control={form.control}
                                        render={({ field }) => (
                                            <SearchableSelect
                                                options={ciudadOptions}
                                                value={field.value ?? ""}
                                                onChange={field.onChange}
                                                placeholder="Seleccione ciudad..."
                                                searchPlaceholder="Buscar ciudad..."
                                            />
                                        )}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección 3: Asunto */}
                    <div className="space-y-3">
                        <SectionHeader
                            icon={<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>}
                            title="Asunto"
                            subtitle="Descripción detallada del contenido de la correspondencia"
                        />
                        <div>
                            <Textarea
                                id="asunto"
                                placeholder="Describa el asunto o contenido de la correspondencia que se envía..."
                                className="min-h-[200px] resize-y border-gray-200 focus:ring-emerald-500 text-sm text-gray-900"
                                {...form.register("asunto")}
                            />
                            <FieldError message={errors.asunto?.message} />
                        </div>
                    </div>

                    {/* Datos del Envío */}
                    <div className="space-y-4">
                        <SectionHeader
                            icon={<MapPin className="w-4 h-4" />}
                            title="Datos del Envío"
                            subtitle="Información de la guía y el mensajero"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="nombreMensajero" className={labelClass}>
                                    Nombre del Mensajero
                                </label>
                                <input
                                    id="nombreMensajero"
                                    value={nombreMensajero}
                                    onChange={(e) => setNombreMensajero(e.target.value)}
                                    placeholder="Nombre completo"
                                    className={inputClass}
                                />
                            </div>
                            <div>
                                <label htmlFor="numeroGuia" className={labelClass}>
                                    Número de Guía
                                </label>
                                <input
                                    id="numeroGuia"
                                    value={numeroGuia}
                                    onChange={(e) => setNumeroGuia(e.target.value)}
                                    placeholder="Ej: GUIA123456"
                                    className={inputClass}
                                />
                            </div>
                            <div className="sm:col-span-2">
                                <label htmlFor="guiaFile" className={labelClass}>
                                    Anexar foto o PDF de la Guía
                                </label>
                                <input
                                    type="file"
                                    id="guiaFile"
                                    accept=".pdf,image/*"
                                    onChange={(e) => setGuiaFile(e.target.files?.[0] || null)}
                                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer border border-gray-200 rounded-xl bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Anexos */}
                    <div className="space-y-4">
                        <div className="flex items-start justify-between pb-3 border-b border-gray-100">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 mt-0.5">
                                    <AlertCircle className="w-4 h-4" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800 text-sm">Anexos</p>
                                    <p className="text-xs text-gray-500 mt-0.5">Documentos o piezas incluidas en el envío</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={addAttachment}
                                className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors"
                            >
                                Agregar
                            </button>
                        </div>
                        <div className="space-y-3">
                            {attachments.map((att, index) => (
                                <div key={index} className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-3">
                                    <div className="flex gap-3 items-end">
                                        <div className="flex-1">
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Anexo</label>
                                            <Select
                                                value={att.typeId}
                                                onValueChange={(v) => updateAttachment(index, "typeId", v)}
                                            >
                                                <SelectTrigger className="bg-white border-gray-200 text-sm h-9">
                                                    <SelectValue placeholder="Seleccione tipo..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {tiposAnexo.map(t => (
                                                        <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="w-28">
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Cantidad</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={att.quantity}
                                                onChange={(e) => updateAttachmentQuantity(index, parseInt(e.target.value) || 1)}
                                                className="w-full h-9 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:emerald-500"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(index)}
                                            disabled={attachments.length === 1}
                                            className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            x
                                        </button>
                                    </div>
                                    {att.quantity > 0 && att.typeId && (
                                        <div className="bg-white border border-gray-200 rounded-lg p-2 space-y-2 max-h-[200px] overflow-y-auto">
                                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Identificadores (opcional)</p>
                                            {att.identifiers.map((ident, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <span className="text-xs font-medium text-gray-400 w-5 text-right">{idx + 1}.</span>
                                                    <input
                                                        type="text"
                                                        placeholder={`Identificador ${idx + 1}...`}
                                                        value={ident}
                                                        onChange={(e) => updateAttachmentIdentifier(index, idx, e.target.value)}
                                                        className="flex-1 h-8 px-2 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={() => form.reset()}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <RotateCcw className="w-4 h-4" /> Limpiar
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-semibold rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                </svg>
                                Registrando...
                            </>
                        ) : (
                            <>
                                <ArrowUpRight className="w-4 h-4" />
                                Registrar Salida
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
