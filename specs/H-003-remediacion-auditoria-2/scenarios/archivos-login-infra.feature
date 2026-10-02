# STR-A10 · Escenarios BDD — Flujo H-003 (archivos, login, infraestructura, integridad)
# language: es

Característica: Controles de archivos, login, cabeceras e integridad

  # ── C-006 Archivos ─────────────────────────────────────────────────────────
  Escenario: S-012 Los archivos ya no viven bajo public/
    Cuando un usuario sube una guía PDF válida
    Entonces el archivo se guarda bajo el directorio privado de uploads
    Y la URL almacenada empieza por "/api/uploads?filename="
    Y una petición GET a "/uploads/<nombre>" sin sesión responde redirección a /login o 404

  Escenario: S-013 El endpoint de archivos aplica ACL por objeto
    Dado que el archivo "g1.pdf" es la guía de una correspondencia de la agencia 2
    Cuando "gerencia" (agencia 1) pide /api/uploads?filename=g1.pdf
    Entonces recibe 403
    Cuando "talento" (agencia 2) pide el mismo archivo
    Entonces recibe 200 con Content-Type application/pdf, nosniff y Content-Security-Policy "default-src 'none'"
    Cuando alguien pide un archivo no referenciado por ningún objeto
    Entonces recibe 404

  Escenario: S-014 El contenido se valida por magic bytes
    Cuando se sube un archivo "foto.jpg" con MIME image/jpeg cuyo contenido empieza por "<html>"
    Entonces la subida se rechaza con "contenido del archivo no corresponde"
    Cuando se sube un PDF cuyo contenido empieza por "%PDF-"
    Entonces la subida se acepta

  # ── C-008 Login ────────────────────────────────────────────────────────────
  Escenario: S-016 El login no revela si el usuario existe
    Cuando se intenta ingresar con el usuario inexistente "nadie"
    Entonces se ejecuta una comparación bcrypt de relleno
    Y el mensaje es "Credenciales inválidas"

  Escenario: S-017 Bloqueo persistente de cuenta y límite por IP
    Dado el usuario "gerencia"
    Cuando falla la contraseña 10 veces
    Entonces la cuenta queda bloqueada hasta 15 minutos después, aunque se reinicie el proceso
    Y el undécimo intento responde con el mensaje genérico de bloqueo
    Cuando desde una misma IP se hacen 21 intentos con usuarios distintos en un minuto
    Entonces el intento 21 se rechaza por límite de IP

  # ── C-009 Redirecciones ────────────────────────────────────────────────────
  Escenario: S-018 Host fuera de la allowlist no gobierna la redirección
    Dado ALLOWED_HOSTS = "sismar.ejemplo.test"
    Cuando llega una petición sin sesión con Host "atacante.test"
    Entonces la redirección apunta a "https://sismar.ejemplo.test/login"

  # ── C-010 CSP y colores ────────────────────────────────────────────────────
  Escenario: S-019 La CSP de páginas usa nonce
    Cuando se solicita cualquier página
    Entonces la cabecera Content-Security-Policy contiene "script-src 'self' 'nonce-" y "'strict-dynamic'"
    Y no contiene "script-src 'self' 'unsafe-inline'"
    Y la página renderiza sin errores de CSP en consola

  Escenario: S-020 Un color de marca malicioso se descarta
    Cuando el administrador guarda colorPrimary = "}</style><script>alert(1)</script>"
    Entonces la validación rechaza el valor
    Y si el valor ya existiera en la base, ThemeInjector no lo inyecta

  # ── C-011 Bitácora ─────────────────────────────────────────────────────────
  Escenario: S-021 Toda operación deja rastro
    Cuando "gerencia" registra una correspondencia entrante
    Entonces Correspondencia.createdBy = "gerencia"
    Y existe una fila AuditLog con acción "CORRESPONDENCIA_CREAR", entidad "Correspondencia" y la IP de origen

  # ── C-012 Seed ─────────────────────────────────────────────────────────────
  Escenario: S-022 El seed es seguro
    Dado una base con datos
    Cuando se ejecuta el seed con NODE_ENV=production y sin SEED_ALLOW_PRODUCTION
    Entonces aborta sin tocar la base
    Cuando se ejecuta en desarrollo
    Entonces no borra ninguna fila existente y no crea usuarios con "123456"

  # ── C-013 Integridad ───────────────────────────────────────────────────────
  Escenario: S-023 La base rechaza valores fuera del dominio
    Cuando se intenta insertar una Correspondencia con estado "BASURA"
    Entonces PostgreSQL rechaza la fila (enum)
    Cuando dos usuarios generan la planilla de la misma agencia a la vez
    Entonces ningún ítem queda duplicado ni perdido

  # ── C-014 Tests ────────────────────────────────────────────────────────────
  Escenario: S-024 El test estático exige el guard correcto por acción
    Cuando createAgenciaAction usa requireSession en vez de requireAdmin
    Entonces la suite falla

  # ── C-015 Usuarios ─────────────────────────────────────────────────────────
  Escenario: S-025 AGENCIA requiere agencia y el email se valida
    Cuando el administrador crea un usuario AGENCIA sin agencia
    Entonces el esquema rechaza el formulario
    Cuando ingresa email "no-es-correo"
    Entonces el esquema rechaza el formulario

  # ── C-016 Saneamiento ──────────────────────────────────────────────────────
  Escenario: S-026 Dependencias y nombres saneados
    Entonces package.json no contiene la dependencia "cookie"
    Y existe src/app/actions/planillas.ts y no existe panillas.ts
    Y el README describe SISMAR y la operación sin exponer secretos ni direcciones IP
