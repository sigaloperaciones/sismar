import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import Link from "next/link"
import { Plus, Pencil } from "lucide-react"
import DeleteUserButton from "./DeleteUserButton"

const rolColors: Record<string, "default" | "secondary" | "outline"> = {
    ADMIN: "default",
    MENSAJERO: "secondary",
    AGENCIA: "outline",
}

export default async function UsuariosPage() {
    const usuarios = await prisma.usuario.findMany({
        include: { agencia: true },
        orderBy: { id: "asc" },
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Gestión de Usuarios</h1>
                    <p className="text-muted-foreground mt-1">{usuarios.length} usuario(s) registrado(s)</p>
                </div>
                <Button asChild>
                    <Link href="/admin/usuarios/nuevo">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Usuario
                    </Link>
                </Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Rol</TableHead>
                                <TableHead>Agencia</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {usuarios.map(usuario => (
                                <TableRow key={usuario.id}>
                                    <TableCell className="font-medium">{usuario.username}</TableCell>
                                    <TableCell>
                                        <Badge variant={rolColors[usuario.role] ?? "outline"}>
                                            {usuario.role}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {usuario.agencia?.name ?? <span className="italic">Sin agencia</span>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" size="sm" asChild>
                                                <Link href={`/admin/usuarios/${usuario.id}`}>
                                                    <Pencil className="w-4 h-4 mr-1" />
                                                    Editar
                                                </Link>
                                            </Button>
                                            <DeleteUserButton id={usuario.id} username={usuario.username} />
                                        </div>
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
