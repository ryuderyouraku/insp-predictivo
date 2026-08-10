# Bot de WhatsApp: invitación de usuarios + consultas de datos

**Fecha:** 2026-08-10
**Estado:** Aprobado para planificación

## Contexto

La app ya tiene AI asistida (`src/server/actions/ai.ts`, AI SDK v6 sobre `anthropic/claude-sonnet-5` vía Vercel AI Gateway) y un modelo de permisos por rol (`ADMIN`/`SUPERVISOR`/`INSPECTOR`/`CLIENTE`, scoped por `contratistaId`/`clienteId` en `src/lib/permissions.ts`). Se quiere agregar un bot de WhatsApp con dos capacidades independientes que comparten infraestructura:

1. **Invitación de usuarios**: al crear un usuario con teléfono, se le manda un WhatsApp con un link para que él mismo defina su contraseña (nunca se envían credenciales en texto plano).
2. **Consultas de datos**: usuarios ya registrados pueden preguntarle al bot en lenguaje natural por historiales, reportes y estado de sus fajas, respetando el mismo scoping de permisos que la app web.

Se implementan en ese orden: sin (1) no hay usuarios con teléfono registrado para probar (2).

## Prerequisito externo (bloqueante, fuera del código)

No existe todavía cuenta de WhatsApp Business API. Antes de poder probar en producción hace falta:
- Crear cuenta de Meta Business y verificar un número de WhatsApp Business.
- Registrar la app en Meta Cloud API.
- Someter y esperar aprobación del **message template** de invitación (obligatorio: es un mensaje que inicia la conversación, WhatsApp no permite texto libre como primer mensaje).

El código de este spec se puede escribir y probar en modo desarrollo (sandbox del adapter) mientras se gestiona esto en paralelo.

## Arquitectura

- **Mensajería:** Chat SDK (`chat` + `@chat-adapter/whatsapp`, ya disponibles en el entorno) sobre Meta Cloud API. Evita reimplementar verificación de firma del webhook, parseo de mensajes y envío de templates.
- **Comprensión de lenguaje natural:** un único paso de clasificación de intención con `generateObject` (AI SDK) — la IA solo decide *qué* se pregunta y extrae parámetros; nunca redacta la respuesta final con datos. Esto mantiene el costo en tokens mínimo y elimina el riesgo de alucinar temperaturas o condiciones.
- **Datos:** toda consulta pasa por Prisma reutilizando `fajaScopeWhere`/`ActorUser` de `src/lib/permissions.ts` — el mismo mecanismo de scoping que ya protege la app web, sin duplicar lógica de permisos.
- **Identidad:** el número de WhatsApp remitente se resuelve contra `User.phone` (confiando en el número registrado, sin PIN adicional — decisión del usuario del producto).
- **Sin memoria de conversación en v1:** cada mensaje entrante se resuelve de forma independiente (stateless). Se puede agregar contexto conversacional después si hace falta.

## Modelo de datos

Cambios en `prisma/schema.prisma`:

```prisma
model User {
  // ...campos existentes
  phone           String?   @unique   // E.164, ej: +51987654321
  mustSetPassword Boolean   @default(false)
}

model PasswordSetToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @unique   // se guarda el hash del token, nunca el token en claro
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())
}
```

- `phone` es opcional y único; usuarios sin teléfono siguen el flujo actual (admin define contraseña manualmente al crearlos).
- `PasswordSetToken` expira (48h) y es de un solo uso — más estricto que el HMAC sin expiración de `src/lib/printToken.ts` (ese es apto para links de impresión reutilizables, no para fijar credenciales).

## Feature 1: Invitación de usuarios

**Flujo:**

1. Admin/Supervisor crea o edita un usuario en `/admin` y le agrega `phone`.
2. Si el usuario es nuevo y tiene `phone`: se crea con `mustSetPassword: true` y un `passwordHash` placeholder no utilizable para login.
3. Se genera un `PasswordSetToken` (token aleatorio, se persiste su hash, expira en 48h) y se llama `sendInviteWhatsApp(user, token)`, que envía el template aprobado: *"Fuiste invitado a [app]. Usuario: {email}. Crea tu contraseña aquí: {link}"*.
4. El link (`/set-password?token=...`) abre una página nueva que:
   - valida el token (existe, no expirado, no usado),
   - pide la contraseña nueva (mínimo 8 caracteres, misma regla que `createUser` hoy),
   - al confirmar: hashea la contraseña, pone `mustSetPassword: false`, marca el token con `usedAt`.
5. Si el token expiró o ya se usó, se muestra un mensaje claro. El admin puede reenviar la invitación desde `/admin` (nueva acción "Reenviar invitación", repite el paso 3 con un token nuevo).
6. `next-auth` (`src/lib/auth.ts`) rechaza el login si `mustSetPassword` es `true` y redirige a un aviso de "revisa tu WhatsApp para activar tu cuenta".

## Feature 2: Bot de consultas

**Entrada:** webhook del Chat SDK (`bot.webhooks.whatsapp`) montado en `src/app/api/whatsapp/route.ts`, disparando `bot.onDirectMessage`.

**Paso 1 — Identificar usuario:** buscar `User` por el `phone` remitente.
- No encontrado → responder *"Este número no está registrado. Contacta a tu administrador."* y terminar. No se llama a la IA para números desconocidos (evita gasto de tokens con mensajes no solicitados).

**Paso 2 — Clasificar intención** (`generateObject`, unión discriminada):

```ts
type Intent =
  | { tipo: 'historial_polea'; fajaTag: string; numeroPolea: number; desde?: string; hasta?: string }
  | { tipo: 'ultimo_reporte'; fajaTag: string }
  | { tipo: 'listado_fajas' }
  | { tipo: 'estado_faja'; fajaTag: string }
  | { tipo: 'lectura_en_fecha'; fajaTag: string; numeroPolea?: number; fecha: string }
  | { tipo: 'no_reconocido' }
```

**Paso 3 — Ejecutar contra Prisma** en `src/server/actions/whatsapp.ts`, cada intent mapea a una función que aplica `fajaScopeWhere(user)` antes de consultar — un `CLIENTE` o una `contratista` nunca ven datos fuera de su scope, igual que en la app web.

**Paso 4 — Formatear con plantilla fija** (no LLM). Ejemplo para `historial_polea`:

```
📊 Historial polea 7 — FAJA-01
12/07/2026 — Izq 68°C / Der 71°C — ACEPTABLE
30/06/2026 — Izq 60°C / Der 61°C — BUENO
```

**Manejo de errores:**
- Faja inexistente o fuera de scope → mismo mensaje genérico para ambos casos (*"No encontré la faja {tag} o no tienes acceso a ella."*) para no revelar existencia de fajas ajenas.
- Polea o fecha sin datos → mensaje específico, nunca un error crudo.
- `tipo: 'no_reconocido'` → responde listando las 5 consultas que sí entiende, con ejemplos.
- Fallo del proveedor de IA → mensaje genérico al usuario + log del error; sin reintentos automáticos en v1.

## Testing

- Unit tests (vitest) para cada función de `src/server/actions/whatsapp.ts` contra Prisma de test, mismo patrón que los tests existentes de `fajas.ts`/`permissions.ts`.
- Unit tests de la clasificación de intención con mensajes de ejemplo en español (variantes de fecha y formato) verificando que el schema se llena correctamente.
- Test del flujo de invitación: token válido/expirado/usado, y que `mustSetPassword` bloquea el login hasta que se define contraseña.

## Fuera de alcance (v1)

- Memoria conversacional / hilos de WhatsApp.
- Verificación adicional (PIN) más allá de confiar en el número registrado.
- Consultas más allá de las 5 definidas.
- Reintentos automáticos ante fallos del proveedor de IA.
