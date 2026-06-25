-- CreateTable
CREATE TABLE "Sede" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,

    CONSTRAINT "Sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CentroCosto" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CentroCosto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agencia" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sedeId" INTEGER NOT NULL,
    "centroCostoId" INTEGER NOT NULL,
    "email" TEXT,

    CONSTRAINT "Agencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaMensajeria" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "nombreMensajero" TEXT,
    "rutasPersonalizadas" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EmpresaMensajeria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ciudad" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,

    CONSTRAINT "Ciudad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'AGENCIA',
    "agenciaId" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipoAnexo" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "TipoAnexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Correspondencia" (
    "id" SERIAL NOT NULL,
    "consecutive" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'ENTRANTE',
    "fechaRecepcion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaMensajeria" TEXT,
    "remitenteNombre" TEXT,
    "remitenteCiudad" TEXT,
    "destinatarioNombre" TEXT,
    "asunto" TEXT NOT NULL,
    "importancia" TEXT NOT NULL DEFAULT 'NORMAL',
    "necesitaRespuesta" BOOLEAN NOT NULL DEFAULT false,
    "estado" TEXT NOT NULL DEFAULT 'POR_ENTREGAR',
    "agenciaId" INTEGER NOT NULL,
    "documentoRecibidoUrl" TEXT,
    "numeroGuia" TEXT,
    "mensajero" TEXT,
    "guiaUrl" TEXT,
    "planillaId" INTEGER,
    "fechaEntrega" TIMESTAMP(3),
    "recibidoPor" TEXT,
    "observacionDevolucion" TEXT,
    "observacionAgencia" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Correspondencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Anexo" (
    "id" SERIAL NOT NULL,
    "correspondenciaId" INTEGER NOT NULL,
    "tipoAnexoId" INTEGER NOT NULL,
    "cantidad" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Anexo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnexoDetalle" (
    "id" SERIAL NOT NULL,
    "anexoId" INTEGER NOT NULL,
    "identificador" TEXT NOT NULL,

    CONSTRAINT "AnexoDetalle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planilla" (
    "id" SERIAL NOT NULL,
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "agenciaId" INTEGER,
    "empresaMensajeria" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'GENERADA',
    "tipo" TEXT NOT NULL DEFAULT 'ENTRANTE',
    "documentoFirmaUrl" TEXT,

    CONSTRAINT "Planilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recorrido" (
    "id" SERIAL NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL DEFAULT 'AM',
    "estado" TEXT NOT NULL DEFAULT 'INICIADO',
    "notas" TEXT,
    "creadoPor" TEXT,

    CONSTRAINT "Recorrido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecorridoPlanilla" (
    "id" SERIAL NOT NULL,
    "recorridoId" INTEGER NOT NULL,
    "planillaId" INTEGER NOT NULL,

    CONSTRAINT "RecorridoPlanilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmpresaConfig" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL DEFAULT 'SISMAR',
    "nit" TEXT,
    "logoUrl" TEXT,
    "uploadsDir" TEXT,
    "colorPrimary" TEXT,
    "colorSecondary" TEXT,
    "colorAccent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmpresaConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permiso" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "modulo" TEXT NOT NULL,

    CONSTRAINT "Permiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolPermiso" (
    "id" SERIAL NOT NULL,
    "rol" TEXT NOT NULL,
    "permisoId" INTEGER NOT NULL,
    "concedido" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RolPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioPermiso" (
    "id" SERIAL NOT NULL,
    "usuarioId" INTEGER NOT NULL,
    "permisoId" INTEGER NOT NULL,
    "concedido" BOOLEAN NOT NULL,

    CONSTRAINT "UsuarioPermiso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CentroCosto_code_key" ON "CentroCosto"("code");

-- CreateIndex
CREATE UNIQUE INDEX "EmpresaMensajeria_nombre_key" ON "EmpresaMensajeria"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Ciudad_codigo_key" ON "Ciudad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

-- CreateIndex
CREATE UNIQUE INDEX "TipoAnexo_name_key" ON "TipoAnexo"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RecorridoPlanilla_recorridoId_planillaId_key" ON "RecorridoPlanilla"("recorridoId", "planillaId");

-- CreateIndex
CREATE UNIQUE INDEX "Permiso_codigo_key" ON "Permiso"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "RolPermiso_rol_permisoId_key" ON "RolPermiso"("rol", "permisoId");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioPermiso_usuarioId_permisoId_key" ON "UsuarioPermiso"("usuarioId", "permisoId");

-- AddForeignKey
ALTER TABLE "Agencia" ADD CONSTRAINT "Agencia_sedeId_fkey" FOREIGN KEY ("sedeId") REFERENCES "Sede"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agencia" ADD CONSTRAINT "Agencia_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondencia" ADD CONSTRAINT "Correspondencia_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Correspondencia" ADD CONSTRAINT "Correspondencia_planillaId_fkey" FOREIGN KEY ("planillaId") REFERENCES "Planilla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_correspondenciaId_fkey" FOREIGN KEY ("correspondenciaId") REFERENCES "Correspondencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Anexo" ADD CONSTRAINT "Anexo_tipoAnexoId_fkey" FOREIGN KEY ("tipoAnexoId") REFERENCES "TipoAnexo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnexoDetalle" ADD CONSTRAINT "AnexoDetalle_anexoId_fkey" FOREIGN KEY ("anexoId") REFERENCES "Anexo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planilla" ADD CONSTRAINT "Planilla_agenciaId_fkey" FOREIGN KEY ("agenciaId") REFERENCES "Agencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecorridoPlanilla" ADD CONSTRAINT "RecorridoPlanilla_recorridoId_fkey" FOREIGN KEY ("recorridoId") REFERENCES "Recorrido"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecorridoPlanilla" ADD CONSTRAINT "RecorridoPlanilla_planillaId_fkey" FOREIGN KEY ("planillaId") REFERENCES "Planilla"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolPermiso" ADD CONSTRAINT "RolPermiso_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "Permiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPermiso" ADD CONSTRAINT "UsuarioPermiso_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioPermiso" ADD CONSTRAINT "UsuarioPermiso_permisoId_fkey" FOREIGN KEY ("permisoId") REFERENCES "Permiso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
