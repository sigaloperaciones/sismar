# STR-A10 · Escenarios BDD — Flujo H-003 (autorización, tenencia, sesión)
# language: es

Característica: Autorización en el núcleo de SISMAR
  Como responsable de seguridad de la institución
  Quiero que cada lectura y mutación respete el alcance del usuario
  Para que ninguna dependencia vea ni altere correspondencia ajena

  Antecedentes:
    Dado que existen las agencias "Gerencia General" (id 1) y "Talento Humano" (id 2)
    Y el usuario "gerencia" es AGENCIA de la agencia 1
    Y el usuario "talento" es AGENCIA de la agencia 2
    Y el usuario "mensajero" es MENSAJERO sin agencia
    Y el usuario "admin" es ADMIN

  # ── C-001 Sesión fresca y revocable ────────────────────────────────────────
  Escenario: S-001 El rol se lee de la base de datos en cada petición
    Dado que "gerencia" inició sesión
    Cuando el administrador cambia el rol de "gerencia" a MENSAJERO
    Y "gerencia" realiza cualquier petición con su cookie anterior
    Entonces la sesión anterior queda revocada
    Y se le redirige a /login

  Escenario: S-002 El logout revoca la sesión en el servidor
    Dado que "gerencia" inició sesión y conserva una copia de su cookie
    Cuando "gerencia" cierra sesión
    Y reutiliza la copia de la cookie
    Entonces la petición se rechaza y se le redirige a /login

  Escenario: S-003 Un usuario eliminado no conserva acceso
    Dado que "talento" inició sesión
    Cuando el administrador elimina al usuario "talento"
    Y "talento" realiza una petición con su cookie
    Entonces la petición se rechaza

  # ── C-002 Tenencia en lecturas ─────────────────────────────────────────────
  Escenario: S-004 AGENCIA solo ve su correspondencia en reportes y dashboard
    Dado que hay correspondencia de la agencia 1 y de la agencia 2
    Cuando "gerencia" abre /reportes y la página de inicio
    Entonces solo aparecen registros con agenciaId 1
    Y los contadores suman únicamente registros de la agencia 1

  Escenario: S-005 AGENCIA sin agencia asignada no ve nada
    Dado un usuario AGENCIA "sinagencia" con agenciaId nulo
    Cuando abre /reportes
    Entonces la lista está vacía y los contadores son cero

  # ── C-003 Mutaciones de correspondencia ────────────────────────────────────
  Escenario: S-006 AGENCIA no puede editar correspondencia de otra agencia
    Dado que la correspondencia 77 pertenece a la agencia 2
    Cuando "gerencia" invoca updateMailAction con id 77
    Entonces la respuesta es un error con "(403)"
    Y la correspondencia 77 no cambia
    Y queda una fila en AuditLog con acción "ACCESO_DENEGADO"

  Escenario: S-007 El permiso se evalúa con el tipo real del registro, no el enviado
    Dado que la correspondencia 78 es SALIENTE de la agencia 1
    Y "gerencia" tiene denegado "correspondencia.saliente.crear"
    Cuando "gerencia" invoca updateMailAction con id 78 y tipo "ENTRANTE" en el formulario
    Entonces la respuesta es un error con "(403)"

  Escenario: S-008 MENSAJERO no puede aprobar ni devolver correspondencia
    Dado que la correspondencia 79 está POR_ENTREGAR en una planilla CERRADA de un recorrido INICIADO
    Cuando "mensajero" invoca aprobarCorrespondenciaAction con id 79
    Entonces la respuesta es un error con "(403)"
    Cuando "talento" (agencia 2) invoca aprobarCorrespondenciaAction con id 79 de la agencia 1
    Entonces la respuesta es un error con "(403)"
    Cuando "gerencia" (agencia 1) invoca aprobarCorrespondenciaAction con id 79
    Entonces la correspondencia 79 pasa a ENTREGADA

  # ── C-004 Ciclo de vida de planillas ───────────────────────────────────────
  Escenario: S-009 Cerrar, reabrir, retirar ítems y subir firma exigen planillas.gestionar
    Dado que la planilla 5 está GENERADA
    Cuando "gerencia" invoca closePlanillaAction con id 5
    Entonces la respuesta es un error con "(403)"
    Cuando "mensajero" invoca closePlanillaAction con id 5
    Entonces la planilla 5 pasa a CERRADA

  Escenario: S-010 Procesar planilla exige correspondencia.recibir y pertenencia
    Dado que la planilla 6 es ENTRANTE de la agencia 2 y está CERRADA
    Cuando "gerencia" invoca processPlanillaAction con id 6
    Entonces la respuesta es un error con "(403)"
    Cuando "talento" invoca processPlanillaAction con id 6
    Entonces la planilla 6 pasa a PROCESADA

  # ── C-005 Catálogos ────────────────────────────────────────────────────────
  Escenario: S-011 Solo ADMIN muta catálogos
    Cuando "gerencia" invoca createAgenciaAction, createCiudadAction y createEmpresaMensajeriaAction
    Entonces las tres respuestas son un error con "(403)"
    Y no se crea ningún registro

  # ── C-007 Páginas ──────────────────────────────────────────────────────────
  Escenario: S-015 Página de objeto ajeno responde 404 y módulo sin permiso muestra acceso denegado
    Dado que la planilla 6 pertenece a la agencia 2
    Cuando "gerencia" abre /planillas/6
    Entonces recibe 404
    Cuando un usuario sin "reportes.ver" abre /reportes
    Entonces ve "Acceso denegado" y queda una fila en AuditLog

  # ── Añadidos por la revisión Guardian independiente (01/10/2026) ───────────
  Escenario: S-027 (AC-016) Los layouts no son frontera: guard propio en cada página admin
    Dado un usuario AGENCIA con sesión válida
    Cuando pide /admin/usuarios con "RSC: 1" y un Next-Router-State-Tree que declara (dashboard) y admin ya renderizados
    Entonces el payload contiene "Acceso denegado" y ningún nombre de usuario ni correo ajeno
    Cuando repite la petición con una cookie de sesión REVOCADA pero bien firmada
    Entonces el payload contiene la redirección a /api/auth/expired y ningún dato

  Escenario: S-028 (AC-018/AC-019) Planilla saliente compartida: leer piezas propias sí, gestionar y ver la firma no
    Dado una planilla SALIENTE con piezas de las agencias 1 y 2 y su documento de firma cargado
    Cuando "gerencia" (agencia 1) abre /planillas/<id>
    Entonces ve solo sus piezas y no ve la previsualización de la firma
    Cuando pide /api/uploads?filename=<firma>
    Entonces recibe 403
    Cuando invoca closePlanillaAction aunque tenga planillas.gestionar
    Entonces recibe "(403)"

  Escenario: S-029 (AC-020) Hash heredado se re-hashea al iniciar sesión
    Dado el usuario "gerencia" con hash bcrypt de coste 10
    Cuando inicia sesión con su contraseña correcta
    Entonces su hash queda en coste 12 y la sesión se crea

  Escenario: S-030 (AC-022) Aprobar dos veces no gana dos veces
    Dado la pieza 79 POR_ENTREGAR en planilla CERRADA de un recorrido INICIADO
    Cuando se invoca aprobarCorrespondenciaAction(79) dos veces en paralelo
    Entonces exactamente una respuesta es exitosa y la bitácora tiene una sola fila CORRESPONDENCIA_APROBAR
