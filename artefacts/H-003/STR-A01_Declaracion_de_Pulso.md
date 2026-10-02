# STR-A01 · Declaración de Pulso — Flujo H-003 (Remediación Auditoría N.º 2)

| Campo | Valor |
|---|---|
| Flujo | H-003 |
| Ciclo / Pulsos | A4 · P1 (altos), P2 (medios), P3 (bajos), P4 (verificación integral) — ejecutados en una sola sesión de trabajo el 01/10/2026 |
| Facilitador | Claude (Fable 5.1) |
| Guardian | Capa Guardian (revisión Claude + firma humana pendiente: Mauricio Tarazona) |
| Momento 0.A | Spec STR-A09 firmada, threat model STR-A13 (AC-001…AC-015), 16 Contratos (C-001…C-016), 26 Escenarios BDD (S-001…S-026). Sin VIOLETA activo. |

## Entregable verificable del Flujo
Aplicación SISMAR con autorización en el núcleo: tenencia por agencia, pertenencia por
objeto en toda mutación, sesión revocable leída de BD, archivos privados con ACL, CSP con
nonce, bitácora de auditoría; 23/23 hallazgos de la auditoría del 31/08/2026 cerrados con
evidencia ejecutada.

## Tareas por Pulso (una Tarea = un Contrato, una Capa, condición binaria)

| Tarea | Capa | Contrato | Condición de verificación |
|---|---|---|---|
| A4-P1-PER-01 | PER | C-001, C-011, C-013 | Migración aplicada sobre BD con datos sin pérdida; enums, Sesion, AuditLog, índices presentes |
| A4-P1-LOG-01 | LOG | C-001 | `requireSession` resuelve sesión en BD; revocada → fuera (tests S-001…S-003) |
| A4-P1-LOG-02 | LOG | C-002 | Filtros de tenencia en 8 páginas (tests S-004/S-005 + E2E) |
| A4-P1-LOG-03 | LOG | C-003 | updateMail/aprobar/devolver con pertenencia (S-006…S-008) |
| A4-P1-LOG-04 | LOG | C-004 | Ciclo de planillas con permiso + dueño (S-009/S-010) |
| A4-P1-LOG-05 | LOG | C-005 | Catálogos con requireAdmin (S-011) |
| A4-P1-GRD-01 | GRD | C-006 | Archivos privados, ACL, magic bytes (S-012…S-014) |
| A4-P2-VIS-01 | VIS | C-007 | Páginas con permiso y AccessDenied (S-015) |
| A4-P2-LOG-06 | LOG | C-008 | Login: IP+usuario, lockout, timing (S-016/S-017) |
| A4-P2-GRD-02 | GRD | C-009, C-010 | Allowlist de hosts; CSP nonce; HSL (S-018…S-020) |
| A4-P2-PER-02 | PER | C-011, C-012 | Bitácora en todas las operaciones; seed seguro (S-021/S-022) |
| A4-P3-LOG-07 | LOG | C-013, C-015, C-016 | Transacción generar planilla; usuarios; saneamiento (S-023, S-025, S-026) |
| A4-P3-GRD-03 | GRD | C-014 | Tests de autorización reales (S-024) |
| A4-P4-GRD-04 | GRD | todos | tsc, 209 tests, build, smoke E2E con 4 roles, informe, memoria Guardian, manuales |

## Responsables por Capa
VIS/LOG/PER: Claude (strata-builder integrado) · GRD: Claude (Guardian) + validación humana · Documentación: agente `strata-documentador`.
