"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { savePermissionMatrixAction } from "@/app/actions/admin"
import { ChevronDown, ChevronRight, Save, RotateCcw, CheckCircle2, XCircle, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Permiso { id: number; codigo: string; nombre: string; modulo: string }
interface RolPermiso { id: number; rol: string; permisoId: number; concedido: boolean }
interface Usuario { id: number; username: string; role: string }
interface UsuarioPermiso { id: number; usuarioId: number; permisoId: number; concedido: boolean }

interface Props {
    permisos: Permiso[]
    rolPermisos: RolPermiso[]
    usuarios: Usuario[]
    usuarioPermisos: UsuarioPermiso[]
}

const ROLES = ["ADMIN", "MENSAJERO", "AGENCIA"]
const rolBadgeVariant: Record<string, "default" | "secondary" | "outline"> = {
    ADMIN: "default",
    MENSAJERO: "secondary",
    AGENCIA: "outline",
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function PermissionMatrix({ permisos, rolPermisos, usuarios, usuarioPermisos }: Props) {
    const { toast } = useToast()

    // Mapas de estado original (para detectar cambios)
    const origRoleMap = useMemo(() => {
        const m = new Map<string, Map<number, boolean>>()
        for (const rp of rolPermisos) {
            if (!m.has(rp.rol)) m.set(rp.rol, new Map())
            m.get(rp.rol)!.set(rp.permisoId, rp.concedido)
        }
        return m
    }, [rolPermisos])

    const origUserMap = useMemo(() => {
        const m = new Map<number, Map<number, boolean>>()
        for (const up of usuarioPermisos) {
            if (!m.has(up.usuarioId)) m.set(up.usuarioId, new Map())
            m.get(up.usuarioId)!.set(up.permisoId, up.concedido)
        }
        return m
    }, [usuarioPermisos])

    // Estado mutable (copias profundas)
    const [roleMap, setRoleMap] = useState<Map<string, Map<number, boolean>>>(() => {
        const m = new Map<string, Map<number, boolean>>()
        for (const [k, v] of origRoleMap) m.set(k, new Map(v))
        return m
    })

    // null = hereda del rol (no existe UsuarioPermiso row)
    const [userMap, setUserMap] = useState<Map<number, Map<number, boolean | null>>>(() => {
        const m = new Map<number, Map<number, boolean | null>>()
        for (const u of usuarios) {
            const userPerms = new Map<number, boolean | null>()
            for (const p of permisos) {
                const override = origUserMap.get(u.id)?.get(p.id)
                userPerms.set(p.id, override !== undefined ? override : null)
            }
            m.set(u.id, userPerms)
        }
        return m
    })

    // Módulos colapsables
    const modulos = useMemo(() => [...new Set(permisos.map(p => p.modulo))].sort(), [permisos])
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

    const toggleModule = (modulo: string) => {
        setCollapsed(prev => {
            const next = new Set(prev)
            next.has(modulo) ? next.delete(modulo) : next.add(modulo)
            return next
        })
    }

    // Calcular cambios pendientes
    const pendingChanges = useMemo(() => {
        let count = 0
        // Cambios en roles
        for (const rol of ROLES) {
            for (const p of permisos) {
                const orig = origRoleMap.get(rol)?.get(p.id) ?? false
                const curr = roleMap.get(rol)?.get(p.id) ?? false
                if (orig !== curr) count++
            }
        }
        // Cambios en usuarios
        for (const u of usuarios) {
            for (const p of permisos) {
                const orig = origUserMap.get(u.id)?.get(p.id) !== undefined
                    ? origUserMap.get(u.id)!.get(p.id)!
                    : null
                const curr = userMap.get(u.id)?.get(p.id) ?? null
                if (orig !== curr) count++
            }
        }
        return count
    }, [roleMap, userMap, origRoleMap, origUserMap, permisos, usuarios])

    // Toggle rol
    const toggleRole = (rol: string, permisoId: number) => {
        setRoleMap(prev => {
            const next = new Map(prev)
            const rolPerms = new Map(next.get(rol) ?? new Map<number, boolean>())
            rolPerms.set(permisoId, !(rolPerms.get(permisoId) ?? false))
            next.set(rol, rolPerms)
            return next
        })
    }

    // Ciclo usuario: null → true → false → null
    const cycleUser = (userId: number, permisoId: number) => {
        setUserMap(prev => {
            const next = new Map(prev)
            const userPerms = new Map(next.get(userId) ?? new Map<number, boolean | null>())
            const curr = userPerms.get(permisoId) ?? null
            const nextVal = curr === null ? true : curr === true ? false : null
            userPerms.set(permisoId, nextVal)
            next.set(userId, userPerms)
            return next
        })
    }

    // Guardar
    const [saving, setSaving] = useState(false)
    const handleSave = async () => {
        setSaving(true)
        const roleChanges: Array<{ rol: string; permisoId: number; concedido: boolean }> = []
        const userChanges: Array<{ usuarioId: number; permisoId: number; concedido: boolean | null }> = []

        for (const rol of ROLES) {
            for (const p of permisos) {
                const orig = origRoleMap.get(rol)?.get(p.id) ?? false
                const curr = roleMap.get(rol)?.get(p.id) ?? false
                if (orig !== curr) roleChanges.push({ rol, permisoId: p.id, concedido: curr })
            }
        }
        for (const u of usuarios) {
            for (const p of permisos) {
                const orig = origUserMap.get(u.id)?.get(p.id) !== undefined
                    ? origUserMap.get(u.id)!.get(p.id)!
                    : null
                const curr = userMap.get(u.id)?.get(p.id) ?? null
                if (orig !== curr) userChanges.push({ usuarioId: u.id, permisoId: p.id, concedido: curr })
            }
        }

        const res = await savePermissionMatrixAction({ roleChanges, userChanges })
        if (res?.error) {
            toast({ title: "Error", description: res.error, variant: "destructive" })
        } else {
            toast({ title: "Permisos guardados", description: `${roleChanges.length + userChanges.length} cambio(s) aplicado(s)` })
        }
        setSaving(false)
    }

    // Resetear
    const handleReset = () => {
        setRoleMap(() => {
            const m = new Map<string, Map<number, boolean>>()
            for (const [k, v] of origRoleMap) m.set(k, new Map(v))
            return m
        })
        setUserMap(() => {
            const m = new Map<number, Map<number, boolean | null>>()
            for (const u of usuarios) {
                const userPerms = new Map<number, boolean | null>()
                for (const p of permisos) {
                    const override = origUserMap.get(u.id)?.get(p.id)
                    userPerms.set(p.id, override !== undefined ? override : null)
                }
                m.set(u.id, userPerms)
            }
            return m
        })
    }

    // Celda de rol
    const RoleCell = ({ rol, permisoId }: { rol: string; permisoId: number }) => {
        const granted = roleMap.get(rol)?.get(permisoId) ?? false
        return (
            <button
                type="button"
                onClick={() => toggleRole(rol, permisoId)}
                className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center mx-auto transition-all",
                    granted
                        ? "bg-primary border-primary text-primary-foreground hover:bg-primary/80"
                        : "border-muted-foreground/30 hover:border-muted-foreground"
                )}
                title={granted ? "Concedido (click para denegar)" : "Denegado (click para conceder)"}
            >
                {granted ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4 text-muted-foreground/40" />}
            </button>
        )
    }

    // Celda de usuario (3 estados)
    const UserCell = ({ userId, permisoId, userRole }: { userId: number; permisoId: number; userRole: string }) => {
        const override = userMap.get(userId)?.get(permisoId) ?? null
        const roleDefault = roleMap.get(userRole)?.get(permisoId) ?? false

        return (
            <button
                type="button"
                onClick={() => cycleUser(userId, permisoId)}
                className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center mx-auto transition-all",
                    override === true && "bg-blue-500 border-blue-500 text-white hover:bg-blue-600",
                    override === false && "bg-red-500 border-red-500 text-white hover:bg-red-600",
                    override === null && (
                        roleDefault
                            ? "border-primary/30 bg-primary/10 hover:border-primary/60"
                            : "border-muted-foreground/20 hover:border-muted-foreground/40"
                    )
                )}
                title={
                    override === true ? "Override: Concedido ✓ (click → Denegar)"
                        : override === false ? "Override: Denegado ✗ (click → Heredar)"
                            : `Hereda del rol (${roleDefault ? "Concedido" : "Denegado"}) — click para override`
                }
            >
                {override === true && <CheckCircle2 className="w-4 h-4" />}
                {override === false && <XCircle className="w-4 h-4" />}
                {override === null && <Minus className={cn("w-3 h-3", roleDefault ? "text-primary" : "text-muted-foreground/40")} />}
            </button>
        )
    }

    return (
        <div className="space-y-4">
            {/* Leyenda y acciones */}
            <Card>
                <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex flex-wrap gap-4 text-sm">
                            <span className="font-medium text-muted-foreground">Leyenda:</span>
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-primary-foreground" /></div>
                                <span>Concedido (rol)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center"><XCircle className="w-3 h-3 text-muted-foreground/40" /></div>
                                <span>Denegado (rol)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-white" /></div>
                                <span>Override: Concedido</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"><XCircle className="w-3 h-3 text-white" /></div>
                                <span>Override: Denegado</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/20 flex items-center justify-center"><Minus className="w-3 h-3 text-muted-foreground/40" /></div>
                                <span>Hereda del rol</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {pendingChanges > 0 && (
                                <Badge variant="warning" className="text-xs">
                                    {pendingChanges} cambio(s) pendiente(s)
                                </Badge>
                            )}
                            <Button variant="outline" size="sm" onClick={handleReset} disabled={pendingChanges === 0 || saving}>
                                <RotateCcw className="w-4 h-4 mr-1" />
                                Deshacer
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={pendingChanges === 0 || saving}>
                                <Save className="w-4 h-4 mr-1" />
                                {saving ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tabla */}
            <div className="border rounded-lg overflow-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0 z-10">
                        <tr>
                            <th className="text-left p-3 font-semibold min-w-[240px] border-b">Permiso</th>
                            {ROLES.map(rol => (
                                <th key={rol} className="p-3 text-center font-semibold border-b border-l min-w-[80px]">
                                    <Badge variant={rolBadgeVariant[rol]}>{rol}</Badge>
                                </th>
                            ))}
                            {usuarios.map(u => (
                                <th key={u.id} className="p-3 text-center font-semibold border-b border-l min-w-[90px]">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-xs font-medium truncate max-w-[80px]">{u.username}</span>
                                        <Badge variant={rolBadgeVariant[u.role]} className="text-[10px] px-1 py-0">{u.role}</Badge>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {modulos.map(modulo => (
                            <>
                                {/* Fila de módulo (colapsable) */}
                                <tr
                                    key={`mod-${modulo}`}
                                    className="bg-muted/30 cursor-pointer hover:bg-muted/50"
                                    onClick={() => toggleModule(modulo)}
                                >
                                    <td className="p-2 pl-3 font-semibold uppercase tracking-wider text-xs text-muted-foreground" colSpan={ROLES.length + usuarios.length + 1}>
                                        <div className="flex items-center gap-2">
                                            {collapsed.has(modulo) ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            {modulo}
                                        </div>
                                    </td>
                                </tr>

                                {/* Filas de permisos del módulo */}
                                {!collapsed.has(modulo) && permisos
                                    .filter(p => p.modulo === modulo)
                                    .map((permiso, idx) => (
                                        <tr
                                            key={permiso.id}
                                            className={cn(
                                                "border-b hover:bg-muted/20 transition-colors",
                                                idx % 2 === 0 ? "bg-background" : "bg-muted/10"
                                            )}
                                        >
                                            <td className="p-3 pl-6">
                                                <div className="font-medium">{permiso.nombre}</div>
                                                <div className="text-xs text-muted-foreground font-mono">{permiso.codigo}</div>
                                            </td>
                                            {ROLES.map(rol => (
                                                <td key={rol} className="p-2 text-center border-l">
                                                    <RoleCell rol={rol} permisoId={permiso.id} />
                                                </td>
                                            ))}
                                            {usuarios.map(u => (
                                                <td key={u.id} className="p-2 text-center border-l">
                                                    <UserCell userId={u.id} permisoId={permiso.id} userRole={u.role} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                }
                            </>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
