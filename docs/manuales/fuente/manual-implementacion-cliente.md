---
titulo: Manual de Implementación en Cliente
producto: SISMAR
descripcion: Sistema de Gestión de Correspondencia Interna
version_manual: 1.0
version_producto: 0.1.0
fecha: 2026-10-01
lector: Equipo que instala, configura y pone en marcha SISMAR en una organización cliente (implementador de AISerNet, infraestructura del cliente y administrador funcional).
base: Código de la rama fix/ajustes-cliente-post-piloto-2 al 2026-10-01, con el Flujo STRATA H-003 aplicado. Procedimientos alineados con docs/OPERACION.md y deploy/setup-sismar.sh.
---

## Historial de cambios

| Versión | Fecha | Origen | Cambio |
|---|---|---|---|
| 1.0 | 2026-10-01 | Flujo H-003 (cierre) y revisión Guardian R-027…R-047 | Creación del manual: requisitos, variables, instalación, actualización con las migraciones H-003, configuración inicial, verificación, respaldo, incidentes y Gate Guardian. |

## 1. Alcance de este documento

Este manual guía la instalación de SISMAR en un servidor del cliente y su configuración hasta la puesta en marcha. No contiene secretos, contraseñas, direcciones IP, puertos ni dominios reales: todos los valores de ejemplo son **ficticios** y se marcan así. Los valores reales de cada entorno viven en el archivo `.env` del servidor, fuera del repositorio.

Cada instalación de SISMAR atiende a **una organización**: hay una sola configuración de empresa por base de datos.

## 2. Requisitos

### 2.1 Servidor y software

| Componente | Requisito | Fuente en el repositorio |
|---|---|---|
| Sistema operativo | Servidor con `bash` (el script de aprovisionamiento es un script de shell). | `deploy/setup-sismar.sh` |
| Node.js y npm | Node.js 20 o superior. | `README.md` |
| PostgreSQL | Versión 16. Puede correr en Docker (incluido) o ser un servicio propio. | `docker-compose.prod.yml` (`postgres:16-alpine`) |
| Docker y Docker Compose | Solo si PostgreSQL corre en el contenedor incluido. | `docker-compose.prod.yml` |
| PM2 | Gestor de procesos que mantiene viva la app. | `deploy/ecosystem.config.cjs` |
| Proxy inverso con TLS | Caddy (fragmento incluido) u otro equivalente. | `deploy/Caddyfile.sismar` |
| `git`, `curl`, `openssl` | Clonar, verificar y generar secretos. | `docs/OPERACION.md` |

**Almacenamiento.** Reserve espacio para la base de datos y para el directorio de archivos (`UPLOADS_DIR`). Cada guía o firma pesa como máximo 10 MB; dimensione según el volumen esperado del cliente.

### 2.2 Red y dominio

- Un **dominio público** con certificado TLS (por ejemplo, `sismar.ejemplo.test`, valor ficticio) y su registro DNS apuntando al servidor.
- Solo el proxy inverso queda expuesto a internet. Node y PostgreSQL escuchan **únicamente en loopback** (`127.0.0.1`).
- Abra en el firewall solo los puertos HTTP/HTTPS del proxy y el acceso administrativo que defina el cliente.

![Figura 1. Topología de despliegue: solo el proxy queda expuesto; Node y PostgreSQL escuchan en loopback.](../img/arquitectura.png)

### 2.3 Navegadores

Navegadores actualizados con soporte de CSP nivel 3 (`'strict-dynamic'`): Chrome, Edge o Firefox en versiones vigentes. SISMAR bloquea scripts sin nonce, por lo que navegadores muy antiguos pueden no funcionar.

## 3. Planificar la implementación

### 3.1 Roles del proyecto

| Rol | Responsabilidad |
|---|---|
| Implementador (AISerNet Company) | Instala, configura, verifica y capacita. |
| Infraestructura del cliente | Provee servidor, dominio, DNS, certificado, firewall y respaldos. |
| Administrador funcional del cliente | Entrega los datos maestros, valida la matriz de permisos y será el usuario ADMIN. |
| Guardian | Aprueba el Gate Guardian antes de exponer el entorno (sección 15). |

### 3.2 Datos que debe entregar el cliente

| Dato | Detalle | Se carga en |
|---|---|---|
| Datos de la empresa | Nombre, NIT, URL del logo (ruta de la app o `https://`), colores de marca (opcional). | Administración › Configuración |
| Sedes | Nombre y dirección. | Administración › Sedes |
| Centros de costo | Nombre (el código lo asigna SISMAR: 001, 002…). | Administración › Centros de Costo |
| Agencias | Nombre, sede, centro de costo y correo de notificación. | Administración › Agencias |
| Empresas de mensajería | Nombre y, si aplica, nombre del mensajero habitual. | Administración › Empresas Mensajería |
| Ciudades | Código (5 a 7 caracteres), nombre y departamento. | Administración › Ciudades |
| Usuarios | Nombre de usuario, correo, rol y, si es AGENCIA, su agencia. | Administración › Usuarios |
| Decisiones de permisos | Quién registra entrantes y salientes, quién arma planillas y quién organiza recorridos. | Administración › Permisos |

**Tipos de anexo.** El seed crea un catálogo fijo: Documento, Paquete, CD, USB, Contrato, Tutela, Factura y Otro. SISMAR **no tiene pantalla** para administrarlos; si el cliente necesita otros, requiere un cambio en la base de datos.

**Carga masiva.** SISMAR **no incluye** importación masiva de datos maestros ni de correspondencia histórica. Los catálogos se cargan desde las pantallas de Administración.

### 3.3 Decisiones de permisos por defecto

Revise con el cliente esta asignación antes de la puesta en marcha; el administrador puede cambiarla en la matriz.

| Tarea | Roles con permiso por defecto |
|---|---|
| Registrar y completar correspondencia entrante y saliente | ADMIN, AGENCIA |
| Generar planillas | ADMIN, MENSAJERO |
| Cerrar, reabrir, retirar piezas y subir firma | ADMIN, MENSAJERO |
| Iniciar y anular recorridos | ADMIN, MENSAJERO |
| Recibir (aprobar, devolver, procesar) | ADMIN, AGENCIA (en la práctica, usuarios AGENCIA: requiere agencia asignada) |
| Reportes | ADMIN, AGENCIA |
| Administración | Solo el rol ADMIN |

## 4. Configurar las variables de entorno

Copie `.env.example` a `.env` en la raíz del proyecto y complete los valores. Prisma CLI y Next.js leen `.env`. **Nunca versione `.env`** (está en `.gitignore`).

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL, en loopback. |
| `JWT_SECRET` | Sí | Secreto de firma de sesiones. Genérelo con `openssl rand -hex 64`. Si cambia, todas las sesiones se cierran. |
| `ALLOWED_HOSTS` | Sí en producción | Dominio público (o varios, separados por coma). Sin él, tras el proxy las redirecciones apuntarían a `localhost`. |
| `UPLOADS_DIR` | Recomendada | Ruta del directorio privado de archivos, **fuera de `public/`**. Por defecto: `<raíz>/storage/uploads`. |
| `NODE_ENV` | Sí | `production`. Activa la cookie `secure` y la CSP de producción. |
| `SEED_ADMIN_PASSWORD`, `SEED_MENSAJERO_PASSWORD`, `SEED_GERENCIA_PASSWORD`, `SEED_TALENTO_PASSWORD` | No | Solo para el seed de una base vacía. Si faltan, el seed genera contraseñas fuertes. |
| `SEED_ALLOW_PRODUCTION` | No | `1` permite correr el seed con `NODE_ENV=production` (solo en una base nueva). |

Ejemplo de `.env` (todos los valores son **ficticios**):

```bash
DATABASE_URL="postgresql://usuario_ejemplo:clave_ejemplo@localhost:<PUERTO_BD>/sismar?schema=public"
JWT_SECRET="<salida de: openssl rand -hex 64>"
ALLOWED_HOSTS="sismar.ejemplo.test"
UPLOADS_DIR="/ruta/ejemplo/sismar/storage/uploads"
NODE_ENV=production
```

> **Guardian.** Guarde `JWT_SECRET` y la contraseña de la base en el gestor de secretos del cliente. No los envíe por correo ni los escriba en tickets.

## 5. Instalar por primera vez

### 5.1 Opción A: script de aprovisionamiento

`deploy/setup-sismar.sh` automatiza la instalación con PostgreSQL en Docker. Exporte estas variables en la sesión de shell antes de ejecutarlo (valores ficticios):

```bash
export POSTGRES_PASSWORD="<contraseña fuerte de la base>"
export JWT_SECRET="$(openssl rand -hex 64)"
export SITE_DOMAIN="sismar.ejemplo.test"
bash deploy/setup-sismar.sh
```

El script hace, en orden:

1. Valida que existan `POSTGRES_PASSWORD`, `JWT_SECRET` y `SITE_DOMAIN`; si falta alguna, se detiene.
2. Escribe `.env.docker` y levanta PostgreSQL con `docker-compose.prod.yml` (puerto publicado solo en `127.0.0.1`). Espera a que acepte conexiones.
3. Escribe `.env` con `DATABASE_URL`, `ALLOWED_HOSTS` (= `SITE_DOMAIN`), `UPLOADS_DIR` (= `<repo>/storage/uploads`), `JWT_SECRET` y `NODE_ENV=production`.
4. Ejecuta `npm install --no-audit --no-fund`, `npx prisma migrate deploy` y `npx prisma generate`.
5. Ejecuta `npx tsx prisma/sync-permissions.ts` y `npx tsx prisma/migrate-uploads.ts`.
6. Si la tabla de usuarios está vacía, ejecuta el seed (sección 7).
7. Compila con `npm run build` y arranca con PM2 (`pm2 start deploy/ecosystem.config.cjs && pm2 save`).
8. Hace una verificación local con `curl` contra la app en loopback.

> **Nota.** El script usa `npm install` y no `npm ci`, porque el `package-lock.json` se genera en Windows y le faltan dependencias opcionales de Linux.

> **Si el seed se detiene** con *Seed bloqueado: NODE_ENV=production*, exporte `SEED_ALLOW_PRODUCTION=1` solo para esa ejecución, corra `npx tsx prisma/seed.ts` sobre la base nueva y complete a mano los pasos 7 y 8.

Recomendación: restrinja los permisos de lectura de `.env` y `.env.docker` al usuario del servicio (por ejemplo, `chmod 600`), porque contienen secretos en texto plano.

### 5.2 Opción B: instalación manual

Use esta vía si PostgreSQL ya existe o no se usa Docker.

1. Clone el repositorio y cree `.env` (sección 4).
2. Instale dependencias: `npm install --no-audit --no-fund`.
3. Aplique el esquema: `npx prisma migrate deploy && npx prisma generate`.
4. Sincronice permisos: `npx tsx prisma/sync-permissions.ts`.
5. Si la base está vacía, ejecute el seed: `npx tsx prisma/seed.ts` (sección 7).
6. Compile: `npm run build`.
7. Arranque con PM2: `pm2 start deploy/ecosystem.config.cjs && pm2 save`.

### 5.3 Ejecutar la app con PM2

`deploy/ecosystem.config.cjs` define el proceso `sismar-app`:

- ejecuta `next start -H 127.0.0.1 -p <PUERTO_APP>`: la app escucha **solo en loopback**;
- fija `NODE_ENV=production`;
- reinicia hasta 10 veces con 3 segundos de espera.

Si cambia el puerto, cámbielo también en el proxy. No quite `-H 127.0.0.1`: expondría Node sin TLS y sin las protecciones del proxy.

### 5.4 Configurar el proxy inverso

El proxy debe:

- terminar TLS con un certificado válido para el dominio;
- reenviar al puerto de la app en `127.0.0.1`;
- fijar `X-Forwarded-For` (SISMAR toma el **último** valor como IP del cliente para el límite de intentos y la bitácora) y `X-Forwarded-Proto`;
- no confiar en esas cabeceras cuando vienen del cliente.

Fragmento de Caddy (basado en `deploy/Caddyfile.sismar`; dominio y puerto ficticios). Caddy fija `X-Forwarded-For` y `X-Forwarded-Proto` por defecto:

```
sismar.ejemplo.test {
    encode gzip
    reverse_proxy 127.0.0.1:<PUERTO_APP>
}
```

## 6. Configurar la organización (alta del cliente)

Siga este orden: cada paso depende del anterior.

1. **Ingrese como administrador.** Use el usuario `admin` que creó el seed y la contraseña que mostró una sola vez (o la de `SEED_ADMIN_PASSWORD`).
2. **Configure la empresa.** En *Administración › Configuración*, reemplace los datos de ejemplo del seed (*Mi Empresa S.A.S.* y su NIT ficticio) por los del cliente. Defina URL del logo y colores si aplica.
3. **Ajuste las sedes.** El seed crea *Sede Principal* con una dirección de ejemplo. Edítela y cree las demás.
4. **Ajuste los centros de costo.** El seed crea *001 Administración* y *002 Recursos Humanos*. Renómbrelos o cree los del cliente.
5. **Cree las agencias** con su sede, centro de costo y correo de notificación. El seed crea dos agencias de ejemplo: *Gerencia General* y *Talento Humano*.
6. **Cargue las empresas de mensajería** y el mensajero habitual de cada una.
7. **Cargue las ciudades** de origen y destino.
8. **Cree los usuarios reales**: correo para todos y agencia obligatoria para los AGENCIA. Contraseñas de 8 caracteres o más, con mayúscula, minúscula y número.
9. **Depure los usuarios de ejemplo.** El seed crea `admin`, `mensajero`, `gerencia` y `talento`. Elimine los que el cliente no use; para eliminar una agencia de ejemplo, primero elimine o reasigne sus usuarios (SISMAR no borra agencias con usuarios o correspondencia). **Renombre el usuario `admin`** (Editar › Nombre de usuario): un nombre conocido permite que un tercero lo bloquee a propósito con intentos fallidos (RADAR R-038).
10. **Revise la matriz de permisos** con el administrador funcional (sección 3.3) y guarde los cambios.

Las instrucciones de cada pantalla están en el **Manual del Usuario**, capítulo 10.

## 7. Usar el seed y rotar contraseñas

### 7.1 Seed no destructivo

`npx tsx prisma/seed.ts`:

- **nunca borra datos**; catálogos y permisos se crean o completan con `upsert`;
- crea la configuración de empresa, la sede, los centros de costo, las agencias y los tipos de anexo de ejemplo solo si no existen;
- crea los usuarios iniciales **solo si la tabla de usuarios está vacía**;
- toma cada contraseña de `SEED_*_PASSWORD` o genera una de 16 caracteres y la **muestra una sola vez** en la consola;
- guarda las contraseñas con bcrypt de coste 12;
- con `NODE_ENV=production` se niega a correr (código de salida 2) salvo `SEED_ALLOW_PRODUCTION=1`.

> **Importante.** Copie las contraseñas generadas al gestor de secretos en el momento: no se vuelven a mostrar. Si define una variable `SEED_*_PASSWORD`, debe cumplir la política (8 caracteres o más, con mayúscula, minúscula y número); si no la cumple, el seed **aborta con código 3 sin crear ningún usuario**. Corrija la variable y vuelva a ejecutarlo.

### 7.2 Rotar contraseñas

```bash
npx tsx prisma/rotate-passwords.ts                  # admin, mensajero, gerencia, talento
npx tsx prisma/rotate-passwords.ts admin            # solo los indicados (ejemplo)
```

Si renombró los usuarios del seed (sección 6, paso 9), indique los nombres nuevos: la lista por defecto solo busca los nombres originales.

Para cada usuario existente, el script asigna una contraseña aleatoria de 16 caracteres, reinicia el bloqueo por intentos fallidos, **revoca todas sus sesiones** y deja constancia en la bitácora. Muestra las contraseñas nuevas una sola vez. No crea usuarios.

Úselo antes de exponer el entorno si las contraseñas iniciales se vieron en una consola compartida, y siempre que el administrador pierda su acceso.

## 8. Canales e integraciones

| Canal | Estado | Qué debe preparar el cliente |
|---|---|---|
| Interfaz web | Activa | Dominio, certificado y navegadores actualizados. |
| Correo de avisos (recorridos y salientes completas) | **Planificado** (RADAR R-021) | Servidor SMTP y cuenta remitente. Activarlo requiere desarrollo: registrar un proveedor de correo en la app. Mientras tanto, SISMAR no envía correos. |
| Integraciones con otros sistemas | No disponibles | SISMAR no expone API para terceros. |

Aunque el correo aún no esté activo, cargue el **correo de los usuarios** y el **email de notificación de las agencias**: son los destinatarios que usarán los avisos.

## 9. Migrar datos

### 9.1 Desde una versión de SISMAR anterior a H-003

La actualización a la versión de octubre de 2026 incluye dos migraciones. La primera, `20261001120000_h003_seguridad_autorizacion`:

- Convierte roles, tipos y estados de texto a **enums** conservando los datos.
- Si existiera un valor fuera del dominio, **aborta sin cambiar nada** y lista los valores exactos a corregir (por ejemplo, un rol mal escrito). Corrija esos registros y repita.
- Crea las tablas de sesiones y bitácora, las columnas de autoría y de bloqueo de cuenta, y los índices.

La segunda, `20261001133000_h003_recorrido_unico_activo`, garantiza que solo exista **un recorrido en curso**. Si la base tuviera más de un recorrido `INICIADO`, aborta con un mensaje claro: termine o anule los sobrantes y repita.

Tras desplegarla:

- **Todas las sesiones anteriores dejan de valer**: avise a los usuarios que deberán ingresar de nuevo.
- Ejecute `npx tsx prisma/sync-permissions.ts` para crear los permisos nuevos `planillas.gestionar` y `correspondencia.recibir`. Sin este paso, nadie podrá cerrar planillas ni recibir correspondencia.
- Ejecute primero `npx tsx prisma/migrate-uploads.ts --dry-run` para ver qué archivos se moverán, y luego sin la bandera. El script mueve los archivos de `public/uploads` al directorio privado y reescribe sus enlaces. Es idempotente.
- Añada `ALLOWED_HOSTS` y `UPLOADS_DIR` al `.env`.
- Revise las cuentas con contraseñas guardadas con el coste anterior (10). SISMAR las re-hashea a coste 12 cuando el usuario vuelve a ingresar, pero las que no ingresan quedan igual. Consulte `SELECT username FROM "Usuario" WHERE password LIKE '$2_$10$%';` y rote las que aparezcan con `rotate-passwords.ts` (RADAR R-032).

### 9.2 Datos muy antiguos

`npx tsx prisma/backfill_tipo.ts` corrige registros de versiones anteriores al campo `tipo` (salientes marcadas con la empresa `SALIENTE`). Úselo solo si el cliente tiene datos de esa época.

### 9.3 Datos desde otros sistemas

No hay herramienta de importación. Los datos maestros se cargan por pantalla (sección 6). La correspondencia histórica de otro sistema no se puede importar con la versión actual.

## 10. Actualizar a una nueva versión

Antes de actualizar, haga un respaldo de la base y del directorio de archivos (sección 13). Luego, en el servidor, desde la raíz del proyecto:

```bash
git pull
npm install --no-audit --no-fund
npx prisma migrate deploy
npx prisma generate
npx tsx prisma/sync-permissions.ts     # permisos nuevos (idempotente)
npx tsx prisma/migrate-uploads.ts      # obligatorio la primera vez tras H-003 (idempotente)
npm run build
pm2 restart sismar-app
```

Después de actualizar: ejecute `npm audit --omit=dev` (debe reportar 0 vulnerabilidades altas o críticas) y repita la verificación de la sección 11. La versión de Next.js está fijada de forma exacta en `package.json` para que el servidor instale la misma versión probada.

## 11. Verificar la instalación

### 11.1 Verificación técnica

Ejecute desde un equipo externo (sustituya el dominio ficticio por el real):

| Prueba | Comando | Resultado esperado |
|---|---|---|
| Página de acceso | `curl -s -o /dev/null -D - https://sismar.ejemplo.test/login` | `200`; cabecera `Content-Security-Policy` con `'nonce-…'` y `'strict-dynamic'`; cabecera `Strict-Transport-Security`. |
| Página protegida sin sesión | `curl -s -o /dev/null -D - https://sismar.ejemplo.test/reportes` | `307` con `Location` hacia `https://sismar.ejemplo.test/login` y una cookie `session` vacía y expirada. |
| Directorio legado de archivos | `curl -s -o /dev/null -w "%{http_code}\n" https://sismar.ejemplo.test/uploads/prueba.pdf` | `404` |
| Archivos sin sesión | `curl -s -o /dev/null -w "%{http_code}\n" "https://sismar.ejemplo.test/api/uploads?filename=prueba.pdf"` | `401` |
| App no expuesta | Intente conectar al puerto de la app desde fuera del servidor. | Conexión rechazada: solo escucha en loopback. |
| Base no expuesta | Intente conectar al puerto de PostgreSQL desde fuera. | Conexión rechazada. |

Verifique también que la redirección de `/reportes` apunte al **dominio público** y no a `localhost`: si apunta a `localhost`, falta `ALLOWED_HOSTS`.

### 11.2 Aceptación funcional

Use dos usuarios AGENCIA de agencias distintas (A y B), un MENSAJERO y el ADMIN.

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | AGENCIA A registra una entrante y una saliente. | Ambas aparecen en sus listas, con consecutivo; la saliente empieza por `SAL-`. |
| 2 | AGENCIA B abre Inicio, Reportes y Planillas. | No ve nada de la agencia A. |
| 3 | AGENCIA B abre el enlace de una planilla de A. | Página no encontrada (404). |
| 4 | AGENCIA B abre la guía adjunta de una saliente de A (enlace copiado). | Acceso rechazado (403). |
| 5 | AGENCIA A entra a `/admin`. | Pantalla *Acceso denegado* (403). |
| 6 | MENSAJERO asigna la entrante a planilla, la cierra e inicia un recorrido. | Planilla Generada → Cerrada; recorrido En Curso. |
| 7 | AGENCIA A, en Mis Planillas, aprueba la pieza y procesa la planilla. | Pieza Entregada; planilla Procesada; recorrido Terminado. |
| 8 | MENSAJERO asigna la saliente, imprime, cierra y sube la firma en PDF. | Pieza Entregada; el soporte queda adjunto y se abre desde la planilla. |
| 8b | AGENCIA A abre esa planilla saliente. | Ve solo sus piezas; no ve ni descarga el documento de firma; no tiene botones de gestión. |
| 9 | Se intenta subir un archivo con extensión `.pdf` que no es un PDF. | Rechazo: *El contenido del archivo no corresponde a su tipo declarado*. |
| 10 | ADMIN cambia el rol de un usuario con sesión abierta. | En su siguiente acción, el usuario vuelve al login con el aviso de sesión cerrada. |
| 11 | Un usuario cierra sesión y abre de nuevo `/reportes`. | Vuelve al login. |
| 12 | Revisión de la bitácora (consulta de la sección 14.4). | Filas de login, accesos denegados y operaciones con usuario e IP. Los intentos con usuarios inexistentes aparecen anonimizados (`usuario#…`). |

Registre el resultado de cada prueba en el acta de aceptación con fecha y responsable.

## 12. Capacitar a los usuarios

| Audiencia | Contenido | Capítulos del Manual del Usuario |
|---|---|---|
| Todos | Ingreso, sesión de 24 h, bloqueo por intentos, cierre de sesión, mensajes de *Acceso denegado*. | 2, 11, 12 |
| Agencias | Registrar y completar entrantes y salientes, anexos, guía; recibir en Mis Planillas; reportes y CSV. | 3, 4, 5, 8, 9 |
| Mensajería | Planillas (asignar, imprimir, cerrar, reabrir, retirar, firma) y recorridos. | 6, 7 |
| Administrador funcional | Configuración, usuarios, matriz de permisos y catálogos; desbloqueo de cuentas. | 10 |

Haga la capacitación en un entorno con datos de prueba, nunca con credenciales reales compartidas.

## 13. Respaldar y restaurar

| Qué | Política (de `docs/OPERACION.md`) |
|---|---|
| Base de datos | `pg_dump` diario, cifrado en el destino. Pruebe una restauración cada trimestre. |
| Archivos | Respalde `UPLOADS_DIR` con la misma política. |
| Secretos | Nunca respalde `.env` en claro; los secretos van al gestor del cliente. |
| Bitácora | Conserve `AuditLog` al menos 12 meses y expórtela periódicamente. |

Ejemplo con el contenedor incluido (usuario y base ficticios; ajuste a su entorno):

```bash
docker exec sismar_postgres pg_dump -U usuario_ejemplo -d sismar -Fc > sismar-AAAAMMDD.dump
tar -czf sismar-archivos-AAAAMMDD.tar.gz -C /ruta/ejemplo/sismar/storage uploads
```

Para restaurar, detenga la app (`pm2 stop sismar-app`), restaure la base con `pg_restore` y el directorio de archivos, y arranque de nuevo. Restaure siempre la base y los archivos **del mismo momento**: los enlaces de la base apuntan a nombres de archivo concretos.

## 14. Dar soporte y atender incidentes

### 14.1 Niveles de escalamiento

| Nivel | Quién | Atiende |
|---|---|---|
| 1 | Administrador funcional del cliente | Usuarios, contraseñas, desbloqueos, permisos, catálogos. |
| 2 | Infraestructura del cliente | Servidor, proxy, certificado, base de datos, respaldos, PM2. |
| 3 | AISerNet Company · Equipo ASIA | Errores de la aplicación, actualizaciones, incidentes de seguridad. |

Los contactos y tiempos de respuesta de cada nivel se definen en el acta de implementación del cliente.

### 14.2 Casos frecuentes

| Caso | Acción |
|---|---|
| Usuario bloqueado (*Credenciales inválidas* con la clave correcta) | Espere 15 minutos o asigne una contraseña nueva en *Administración › Usuarios* (desbloquea y cierra sus sesiones). |
| El administrador perdió su contraseña | En el servidor: `npx tsx prisma/rotate-passwords.ts <usuario_admin>`. |
| Un módulo desapareció para todos tras actualizar | Ejecute `npx tsx prisma/sync-permissions.ts`. |
| Archivos antiguos devuelven 404 | Ejecute `npx tsx prisma/migrate-uploads.ts --dry-run` y luego sin la bandera. |
| Redirecciones hacia `localhost` | Defina `ALLOWED_HOSTS` y reinicie la app. |

### 14.3 Incidentes de seguridad

**Cuenta comprometida**

1. Cambie la contraseña del usuario en *Administración › Usuarios*: SISMAR revoca todas sus sesiones.
2. Revise su actividad en la bitácora (consulta 14.4, filtrando por `username`).
3. Si tenía rol ADMIN, revise los cambios de usuarios, permisos y configuración en el periodo.

**Secreto `JWT_SECRET` comprometido**

1. Genere uno nuevo: `openssl rand -hex 64`.
2. Reemplácelo en `.env` y reinicie: `pm2 restart sismar-app`. Todos los tokens dejan de valer.
3. Revoque además las sesiones en la base con la consulta siguiente.
4. Avise a los usuarios que deben ingresar de nuevo.

```sql
UPDATE "Sesion" SET "revokedAt" = now() WHERE "revokedAt" IS NULL;
```

**Limpieza periódica de sesiones** (vencidas o revocadas hace más de 7 días):

```sql
DELETE FROM "Sesion"
WHERE "expiresAt" < now() - interval '7 days' OR "revokedAt" < now() - interval '7 days';
```

### 14.4 Consultar la bitácora

```sql
SELECT fecha, username, accion, entidad, "entidadId", ip
FROM "AuditLog"
WHERE accion IN ('ACCESO_DENEGADO','ARCHIVO_DENEGADO','LOGIN_BLOQUEADO')
ORDER BY fecha DESC LIMIT 100;
```

La bitácora registra login (correcto, fallido, bloqueado, limitado), logout, accesos y archivos denegados, operaciones de correspondencia, planillas y recorridos, catálogos, usuarios, permisos y configuración. La aplicación nunca modifica ni borra sus filas.

Para que esa garantía sea exigible en la base, conecte la aplicación con un rol de PostgreSQL distinto del propietario y retírele esos privilegios sobre la tabla (nombre de rol ficticio):

```sql
REVOKE UPDATE, DELETE ON "AuditLog" FROM rol_app_ejemplo;
```

Recomendación operativa (SISMAR no trae alertas): vigile o alerte desde su herramienta de monitoreo las filas `LOGIN_BLOQUEADO` del usuario administrador (RADAR R-038).

## 15. Pasar el Gate Guardian antes de exponer el entorno

Ningún entorno se expone a internet, ni siquiera pre-producción, sin este chequeo. Un incumplimiento de los puntos 1 a 5 es un **ROJO** de RADAR y bloquea el despliegue.

| # | Control | Cómo se verifica en SISMAR |
|---|---|---|
| 1 | Ningún secreto en el repositorio ni en la UI. | `git ls-files \| grep -i env` devuelve solo `.env.example`; `git ls-files public/uploads` no devuelve nada; la pantalla de acceso no muestra credenciales. |
| 2 | Toda server action, página y ruta API verifica sesión y permisos. | `npm test` en verde (incluye `actions-guarded.test.ts` y `page-guards.test.ts`); `/api/uploads` sin sesión → 401; prueba manual `tests/e2e/rsc-admin-bypass.poc.ts` contra el entorno sin fuga de datos de administración. |
| 3 | Subidas con whitelist, tamaño máximo y sin SVG inline. | PDF/PNG/JPG, 10 MB, magic bytes; prueba 9 de la sección 11.2. |
| 4 | Cookie de sesión `httpOnly + secure + sameSite` en set, refresh y clear. | Mismos atributos al crear y al borrar; ya no hay renovación. `NODE_ENV=production` en `.env`; la cookie vacía de la prueba de `/reportes` trae `Secure`, `HttpOnly` y `SameSite=lax`. |
| 5 | Rate limit en login. | 5 por minuto por usuario, 20 por IP; bloqueo de 10 intentos durante 15 min. |
| 6 | CSP y HSTS. | Prueba de `/login` de la sección 11.1. |
| 7 | Validación Zod conectada en las acciones. | `zod-integration.test.ts` en verde. |
| 8 | Dependencias de runtime en `dependencies`. | `package-deps.test.ts` en verde; `npm run build` sin errores; `npm audit --omit=dev` sin altas ni críticas. |
| 9 | Sin stack traces en logs; sin catches vacíos. | `handleActionError` registra solo el mensaje. |
| 10 | Contraseñas fuertes; usuarios de ejemplo rotados o eliminados. | Política de 8 caracteres con mayúscula, minúscula y número; sección 6, paso 9, y sección 7.2. |

Complementos del runbook: `ALLOWED_HOSTS` configurado; `UPLOADS_DIR` fuera de `public/`; `/uploads/...` → 404; prueba con un usuario AGENCIA que no ve ni edita otra agencia.

> **Guardian.** Condición vigente al 2026-10-01 según el acta de cierre del Flujo H-003: el despliegue a pre-producción está autorizado técnicamente, **condicionado** a la decisión humana sobre la purga del historial de git que contiene archivos de usuarios (RADAR R-029 y R-047) y a la firma del Guardian.

## 16. Lista de chequeo de implementación

**Preparación**

- [ ] Servidor con Node.js 20+, PM2, PostgreSQL 16 (o Docker) y proxy con TLS.
- [ ] Dominio y DNS apuntando al servidor; certificado válido.
- [ ] Firewall: solo HTTP/HTTPS del proxy y acceso administrativo.
- [ ] Datos maestros del cliente recibidos (sección 3.2).
- [ ] Decisiones de permisos acordadas (sección 3.3).

**Instalación**

- [ ] `.env` completo: `DATABASE_URL`, `JWT_SECRET` (64 bytes aleatorios), `ALLOWED_HOSTS`, `UPLOADS_DIR`, `NODE_ENV=production`.
- [ ] Secretos guardados en el gestor del cliente; permisos de `.env` restringidos.
- [ ] Migraciones aplicadas y permisos sincronizados.
- [ ] Seed ejecutado una sola vez y contraseñas guardadas.
- [ ] App en PM2 escuchando solo en `127.0.0.1`; proxy configurado.

**Configuración**

- [ ] Datos de la empresa del cliente (sin los valores de ejemplo del seed).
- [ ] Sedes, centros de costo, agencias, empresas de mensajería y ciudades cargados.
- [ ] Usuarios reales creados, con correo; AGENCIA con agencia.
- [ ] Usuarios y agencias de ejemplo eliminados o depurados.
- [ ] Matriz de permisos revisada y guardada.

**Verificación y cierre**

- [ ] Verificación técnica completa (sección 11.1).
- [ ] Aceptación funcional firmada (sección 11.2).
- [ ] Gate Guardian aprobado (sección 15).
- [ ] Respaldo inicial de base y archivos realizado y restauración probada.
- [ ] Capacitación por audiencia realizada (sección 12).
- [ ] Niveles de soporte y contactos registrados en el acta (sección 14.1).
- [ ] Usuarios informados de la fecha de puesta en marcha y de cómo recibirán sus credenciales.
