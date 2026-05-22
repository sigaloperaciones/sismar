"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { registerOutgoingMail } from "@/app/actions/correspondencia"
import { useToast } from "@/components/ui/use-toast"
import { outgoingMailSchema, type OutgoingMailFormData } from "@/lib/schemas/correspondencia"
import { Building2, User, MapPin, AlertCircle, RotateCcw, ArrowUpRight } from "lucide-react"
import { SearchableSelect } from "@/components/ui/searchable-select"

interface Agencia { id: number; name: string }
interface Ciudad { nombre: string; departamento: string }
interface Empresa { nombre: string }

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

export default function OutgoingMailForm({ agencias, ciudades, empresas }: { agencias: Agencia[], ciudades: Ciudad[], empresas: Empresa[] }) {
    const { toast } = useToast()

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
        defaultValues: { importancia: "NORMAL" },
    })
    const { formState: { errors, isSubmitting }, watch, setValue } = form
    const importancia = watch("importancia")

    const onSubmit = async (data: OutgoingMailFormData) => {
        const formData = new FormData()
        formData.append("agenciaId", data.agenciaId)
        formData.append("empresaMensajeria", data.empresaMensajeria)
        formData.append("destinatarioNombre", data.destinatarioNombre)
        formData.append("destinatarioCiudad", data.destinatarioCiudad ?? "")
        formData.append("asunto", data.asunto)
        formData.append("importancia", data.importancia)

        const res = await registerOutgoingMail(null, formData)

        if (res?.error) {
            toast({ title: "Error al registrar", description: res.error, variant: "destructive" })
        } else {
            toast({ title: "Correspondencia registrada", description: "La salida fue registrada exitosamente." })
            form.reset()
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
                        <h2 className="text-white font-bold text-lg">Registrar Correspondencia Saliente</h2>
                        <p className="text-emerald-100 text-sm">Registre la correspondencia que sale hacia el exterior</p>
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
                                            onChange={field.onChange}
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
                                        className={`flex-1 text-sm font-medium transition-colors ${
                                            importancia === "NORMAL"
                                                ? "bg-emerald-600 text-white"
                                                : "bg-white text-gray-600 hover:bg-gray-50"
                                        }`}
                                    >
                                        Normal
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setValue("importancia", "ALTA")}
                                        className={`flex-1 text-sm font-medium transition-colors border-l border-gray-200 ${
                                            importancia === "ALTA"
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
