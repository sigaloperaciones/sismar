import { prisma } from "@/lib/prisma"
import { requireSession } from "@/lib/auth-guard"
import { correspondenciaWhere } from "@/lib/tenancy"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Inbox, Send, FileText, Clock, CheckCircle2, Package } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export default async function DashboardHome() {
    const ctx = await requireSession()
    // H-003 / C-002 (A-01): todas las métricas y la actividad reciente se
    // restringen al alcance del usuario (AGENCIA → solo su agencia).
    const scope = correspondenciaWhere(ctx)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [pendientes, entregadasHoy, salientsHoy, totalHoy, recientes] = await Promise.all([
        prisma.correspondencia.count({ where: { AND: [scope, { estado: "POR_ENTREGAR" }] } }),
        prisma.correspondencia.count({
            where: { AND: [scope, { estado: "ENTREGADA", fechaEntrega: { gte: today } }] },
        }),
        prisma.correspondencia.count({
            where: { AND: [scope, { tipo: "SALIENTE", createdAt: { gte: today } }] },
        }),
        prisma.correspondencia.count({
            where: { AND: [scope, { createdAt: { gte: today } }] },
        }),
        prisma.correspondencia.findMany({
            where: scope,
            orderBy: { createdAt: "desc" },
            take: 8,
            include: { agencia: true },
        }),
    ])

    const stats = [
        {
            title: "Recibidas Hoy",
            value: totalHoy,
            icon: Inbox,
            color: "text-blue-600",
            bg: "bg-blue-50 dark:bg-blue-950/30",
        },
        {
            title: "Pendientes de Entrega",
            value: pendientes,
            icon: Clock,
            color: "text-orange-600",
            bg: "bg-orange-50 dark:bg-orange-950/30",
        },
        {
            title: "Entregadas Hoy",
            value: entregadasHoy,
            icon: CheckCircle2,
            color: "text-green-600",
            bg: "bg-green-50 dark:bg-green-950/30",
        },
        {
            title: "Salientes Hoy",
            value: salientsHoy,
            icon: Send,
            color: "text-purple-600",
            bg: "bg-purple-50 dark:bg-purple-950/30",
        },
    ]

    return (
        <div className="space-y-8">
            {/* Encabezado */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">
                    Bienvenido, {ctx.username}
                </h1>
                <p className="text-muted-foreground mt-1">
                    {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => {
                    const Icon = stat.icon
                    return (
                        <Card key={stat.title}>
                            <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                                        <p className={`text-3xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                                    </div>
                                    <div className={`p-3 rounded-full ${stat.bg}`}>
                                        <Icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* Acciones rápidas */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-3">
                        <Button asChild>
                            <Link href="/correspondencia/entrante">
                                <Inbox className="w-4 h-4 mr-2" />
                                Registrar Entrante
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/correspondencia/saliente">
                                <Send className="w-4 h-4 mr-2" />
                                Registrar Saliente
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/planillas">
                                <FileText className="w-4 h-4 mr-2" />
                                Ver Planillas
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/recorridos">
                                <Package className="w-4 h-4 mr-2" />
                                Recorridos
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Actividad reciente */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-semibold">Actividad Reciente</CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/reportes">Ver todo</Link>
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Agencia</TableHead>
                                <TableHead>Asunto</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {recientes.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No hay correspondencia registrada aún.
                                    </TableCell>
                                </TableRow>
                            )}
                            {recientes.map(item => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Badge variant={item.tipo === "ENTRANTE" ? "secondary" : "outline"} className="text-xs">
                                            {item.tipo === "ENTRANTE" ? "Entrante" : "Saliente"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-medium text-sm">{item.agencia?.name}</TableCell>
                                    <TableCell className="max-w-[200px] truncate text-sm">{item.asunto}</TableCell>
                                    <TableCell>
                                        <Badge variant={
                                            item.estado === "POR_ENTREGAR" ? "warning" :
                                                item.estado === "ENTREGADA" ? "success" : "destructive"
                                        } className="text-xs">
                                            {item.estado === "POR_ENTREGAR" ? "Pendiente" :
                                                item.estado === "ENTREGADA" ? "Entregada" : "Devuelta"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {format(item.createdAt, "dd/MM HH:mm")}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}
