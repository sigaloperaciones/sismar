"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { createUserSchema, updateUserSchema } from "@/lib/schemas/admin"
import type { CreateUserFormData, UpdateUserFormData } from "@/lib/schemas/admin"
import { useRouter } from "next/navigation"

interface Agencia { id: number; name: string }

interface UserFormProps {
    agencias: Agencia[]
    mode: "create" | "edit"
    defaultValues?: Partial<UpdateUserFormData & { id: number }>
    onSubmit: (formData: FormData) => Promise<{ success?: boolean; error?: string } | undefined>
}

export default function UserForm({ agencias, mode, defaultValues, onSubmit }: UserFormProps) {
    const { toast } = useToast()
    const router = useRouter()

    const schema = mode === "create" ? createUserSchema : updateUserSchema
    const form = useForm<CreateUserFormData | UpdateUserFormData>({
        resolver: zodResolver(schema as never),
        defaultValues: {
            username: defaultValues?.username ?? "",
            email: defaultValues?.email ?? "",
            password: "",
            role: defaultValues?.role ?? "AGENCIA",
            agenciaId: defaultValues?.agenciaId ?? "",
        },
    })
    const { formState: { errors, isSubmitting } } = form
    const watchRole = form.watch("role")

    const handleSubmit = async (data: CreateUserFormData | UpdateUserFormData) => {
        const formData = new FormData()
        Object.entries(data).forEach(([k, v]) => formData.append(k, v ?? ""))
        const res = await onSubmit(formData)
        if (res?.error) {
            toast({ title: "Error", description: res.error, variant: "destructive" })
        } else {
            toast({ title: "Guardado", description: `Usuario ${mode === "create" ? "creado" : "actualizado"} correctamente` })
            router.push("/admin/usuarios")
            router.refresh()
        }
    }

    return (
        <Card className="max-w-xl">
            <CardHeader>
                <CardTitle>{mode === "create" ? "Crear Usuario" : "Editar Usuario"}</CardTitle>
            </CardHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)}>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="username">Nombre de usuario *</Label>
                        <Input id="username" {...form.register("username")} autoComplete="off" />
                        {errors.username && <p className="text-red-500 text-xs">{errors.username.message}</p>}
                    </div>

                    {/* H-003 / C-015 (B-05): correo para avisos de recorrido */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Correo electrónico <span className="text-muted-foreground text-xs">(opcional, para avisos)</span></Label>
                        <Input id="email" type="email" autoComplete="off" placeholder="usuario@institucion.test" {...form.register("email")} />
                        {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="password">
                            Contraseña {mode === "edit" && <span className="text-muted-foreground text-xs">(dejar vacío para no cambiar)</span>}
                            {mode === "create" && " *"}
                        </Label>
                        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
                        {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
                    </div>

                    <div className="space-y-2">
                        <Label>Rol *</Label>
                        <Controller
                            name="role"
                            control={form.control}
                            render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccione un rol..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ADMIN">Administrador</SelectItem>
                                        <SelectItem value="MENSAJERO">Mensajero</SelectItem>
                                        <SelectItem value="AGENCIA">Agencia</SelectItem>
                                    </SelectContent>
                                </Select>
                            )}
                        />
                        {errors.role && <p className="text-red-500 text-xs">{errors.role.message}</p>}
                    </div>

                    {watchRole === "AGENCIA" && (
                        <div className="space-y-2">
                            <Label>Agencia asociada</Label>
                            <Controller
                                name="agenciaId"
                                control={form.control}
                                render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccione agencia..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {agencias.map(a => (
                                                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            />
                            {errors.agenciaId && <p className="text-red-500 text-xs">{errors.agenciaId.message}</p>}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end gap-3">
                    <Button variant="outline" type="button" onClick={() => router.push("/admin/usuarios")}>
                        Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Guardando..." : mode === "create" ? "Crear Usuario" : "Guardar Cambios"}
                    </Button>
                </CardFooter>
            </form>
        </Card>
    )
}
