"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { saveEmpresaConfigAction } from "@/app/actions/admin"
import { empresaConfigSchema, type EmpresaConfigFormData } from "@/lib/schemas/admin"
import { Building2, Palette, Image as ImageIcon } from "lucide-react"

interface EmpresaConfig {
    id: number
    nombre: string
    nit?: string | null
    logoUrl?: string | null
    colorPrimary?: string | null
    colorSecondary?: string | null
    colorAccent?: string | null
}

// Colores predefinidos de Tailwind (en formato HSL string para CSS vars)
const colorPresets = [
    { label: "Azul (default)", primary: "221.2 83.2% 53.3%", secondary: "210 40% 96.1%", accent: "210 40% 96.1%" },
    { label: "Verde", primary: "142.1 76.2% 36.3%", secondary: "138 76% 96%", accent: "138 76% 96%" },
    { label: "Morado", primary: "262.1 83.3% 57.8%", secondary: "270 40% 96.1%", accent: "270 40% 96.1%" },
    { label: "Rojo", primary: "0 72.2% 50.6%", secondary: "0 40% 96.1%", accent: "0 40% 96.1%" },
    { label: "Naranja", primary: "24.6 95% 53.1%", secondary: "25 40% 96.1%", accent: "25 40% 96.1%" },
    { label: "Cian", primary: "186 80% 40%", secondary: "186 40% 96.1%", accent: "186 40% 96.1%" },
]

export default function ConfigForm({ config }: { config: EmpresaConfig | null }) {
    const { toast } = useToast()
    const [logoPreview, setLogoPreview] = useState(config?.logoUrl ?? "")
    const [previewColors, setPreviewColors] = useState({
        primary: config?.colorPrimary ?? "221.2 83.2% 53.3%",
    })

    const form = useForm<EmpresaConfigFormData>({
        resolver: zodResolver(empresaConfigSchema),
        defaultValues: {
            nombre: config?.nombre ?? "",
            nit: config?.nit ?? "",
            logoUrl: config?.logoUrl ?? "",
            colorPrimary: config?.colorPrimary ?? "",
            colorSecondary: config?.colorSecondary ?? "",
            colorAccent: config?.colorAccent ?? "",
        },
    })
    const { formState: { errors, isSubmitting } } = form

    const onSubmit = async (data: EmpresaConfigFormData) => {
        const formData = new FormData()
        Object.entries(data).forEach(([k, v]) => formData.append(k, v ?? ""))

        const res = await saveEmpresaConfigAction(null, formData)
        if (res?.error) {
            toast({ title: "Error", description: res.error, variant: "destructive" })
        } else {
            toast({ title: "Guardado", description: "Configuración actualizada correctamente" })
        }
    }

    const applyPreset = (preset: typeof colorPresets[0]) => {
        form.setValue("colorPrimary", preset.primary)
        form.setValue("colorSecondary", preset.secondary)
        form.setValue("colorAccent", preset.accent)
        setPreviewColors({ primary: preset.primary })
    }

    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Datos Generales */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Building2 className="w-5 h-5" /> Datos de la Empresa
                    </CardTitle>
                    <CardDescription>Información general que aparece en reportes y encabezados.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="nombre">Nombre de la Empresa *</Label>
                        <Input id="nombre" {...form.register("nombre")} />
                        {errors.nombre && <p className="text-red-500 text-xs">{errors.nombre.message}</p>}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="nit">NIT</Label>
                        <Input id="nit" placeholder="900.123.456-7" {...form.register("nit")} />
                    </div>
                </CardContent>
            </Card>

            {/* Logo */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <ImageIcon className="w-5 h-5" /> Logo
                    </CardTitle>
                    <CardDescription>URL pública del logo (PNG, SVG o JPG recomendado).</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4 items-start">
                        <div className="flex-1 space-y-2">
                            <Label htmlFor="logoUrl">URL del Logo</Label>
                            <Input
                                id="logoUrl"
                                placeholder="https://ejemplo.com/logo.png"
                                {...form.register("logoUrl")}
                                onChange={(e) => {
                                    form.setValue("logoUrl", e.target.value)
                                    setLogoPreview(e.target.value)
                                }}
                            />
                        </div>
                        {logoPreview && (
                            <div className="mt-6 w-20 h-20 border rounded-lg overflow-hidden flex items-center justify-center bg-muted/30">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={logoPreview}
                                    alt="Preview logo"
                                    className="max-w-full max-h-full object-contain"
                                    onError={() => setLogoPreview("")}
                                />
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Paleta de Colores */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Palette className="w-5 h-5" /> Paleta de Colores
                    </CardTitle>
                    <CardDescription>
                        Los colores se aplican en tiempo real a toda la interfaz.
                        Los valores son en formato HSL (ej: &quot;221.2 83.2% 53.3%&quot;).
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Presets */}
                    <div>
                        <Label className="text-sm font-medium mb-3 block">Colores predefinidos</Label>
                        <div className="flex flex-wrap gap-2">
                            {colorPresets.map((preset) => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => applyPreset(preset)}
                                    className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:border-primary transition-colors text-sm"
                                >
                                    <span
                                        className="w-4 h-4 rounded-full border"
                                        style={{ background: `hsl(${preset.primary})` }}
                                    />
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Valores HSL manuales */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="colorPrimary">Color Primario (HSL)</Label>
                            <div className="flex gap-2 items-center">
                                <span
                                    className="w-8 h-8 rounded-full border flex-shrink-0"
                                    style={{ background: `hsl(${form.watch("colorPrimary") || "221.2 83.2% 53.3%"})` }}
                                />
                                <Input
                                    id="colorPrimary"
                                    placeholder="221.2 83.2% 53.3%"
                                    {...form.register("colorPrimary")}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="colorSecondary">Color Secundario (HSL)</Label>
                            <div className="flex gap-2 items-center">
                                <span
                                    className="w-8 h-8 rounded-full border flex-shrink-0"
                                    style={{ background: `hsl(${form.watch("colorSecondary") || "210 40% 96.1%"})` }}
                                />
                                <Input
                                    id="colorSecondary"
                                    placeholder="210 40% 96.1%"
                                    {...form.register("colorSecondary")}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="colorAccent">Color de Acento (HSL)</Label>
                            <div className="flex gap-2 items-center">
                                <span
                                    className="w-8 h-8 rounded-full border flex-shrink-0"
                                    style={{ background: `hsl(${form.watch("colorAccent") || "210 40% 96.1%"})` }}
                                />
                                <Input
                                    id="colorAccent"
                                    placeholder="210 40% 96.1%"
                                    {...form.register("colorAccent")}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">Vista previa del color primario:</p>
                        <div className="flex gap-2">
                            <div
                                className="px-4 py-2 rounded-md text-white text-sm font-medium"
                                style={{ background: `hsl(${form.watch("colorPrimary") || "221.2 83.2% 53.3%"})` }}
                            >
                                Botón Principal
                            </div>
                            <div
                                className="px-4 py-2 rounded-md text-sm font-medium border"
                                style={{ color: `hsl(${form.watch("colorPrimary") || "221.2 83.2% 53.3%"})`, borderColor: `hsl(${form.watch("colorPrimary") || "221.2 83.2% 53.3%"})` }}
                            >
                                Botón Outline
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button type="submit" size="lg" disabled={isSubmitting}>
                    {isSubmitting ? "Guardando..." : "Guardar Configuración"}
                </Button>
            </div>
        </form>
    )
}
