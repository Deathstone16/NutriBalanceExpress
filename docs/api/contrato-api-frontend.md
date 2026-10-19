# Contrato de API - NutriTurnos

Versión 1.0 - 16/10/2026

Este documento define los endpoints y los datos intercambiados entre frontend y backend del MVP académico.

**URL base:** `/api/v1`  
**Formato:** JSON.  
**Identificadores:** strings UUID generados por el backend.  
**Fechas:** `YYYY-MM-DD` para nacimiento y consultas; ISO 8601 con zona para horarios y timestamps.  
**Acceso privado:** sesión de la nutricionista mediante cookie. Enviar `credentials: 'include'`.  
**Escrituras:** enviar `X-CSRF-Token`, también en login y solicitud pública de turno.

Los ejemplos contienen datos ficticios. Los campos opcionales omitidos al crear se devuelven como `null`. En edición parcial, un campo omitido conserva su valor; `null` borra únicamente campos que lo permiten.

Los textos opcionales `background`, `allergies`, `medication`, `objective` y `observations` también aceptan `""` y se normalizan a `null`. Los campos con formato, como email o documento, requieren un valor válido o `null`.

## 1. Sesión

### GET `/auth/csrf`

**Público.** Obtener el token necesario para enviar formularios. No recibe body.

**Respuesta 200:**

```json
{ "csrfToken": "token-generado-por-el-backend" }
```

El navegador recibe además la cookie de sesión.

### POST `/auth/login`

**Público.** Iniciar sesión.

**Body:**

```json
{
  "email": "nutri@example.test",
  "password": "contraseña"
}
```

Ambos campos son obligatorios.

**Respuesta 200:**

```json
{
  "user": {
    "id": "11111111-1111-4111-8111-111111111111",
    "email": "nutri@example.test",
    "displayName": "Profesional de prueba",
    "role": "professional"
  },
  "csrfToken": "nuevo-token-generado-por-el-backend",
  "expiresAt": "2026-10-17T00:00:00Z"
}
```

Usar el nuevo `csrfToken` para los siguientes formularios. Nunca se expone la contraseña ni su hash. Credenciales incorrectas: **401**.

### GET `/auth/me`

**Privado.** Consultar el usuario conectado. No recibe body.

**Respuesta 200:** mismo objeto que `/auth/login`: `user`, `csrfToken`, `expiresAt`. Sin sesión vigente: **401**.

### POST `/auth/logout`

**Privado.** Cerrar sesión. No recibe body.

**Respuesta 204:** sin contenido. No intentar leer JSON.

## 2. Pacientes

### Datos expuestos del paciente

| Campo | Tipo | Obligatorio al crear | Permite null |
|---|---|---|---|
| id | string UUID | Lo genera el backend | No |
| firstName | string, 1-80 caracteres | Sí | No |
| lastName | string, 1-80 caracteres | Sí | No |
| phone | string, 6-30 caracteres | Sí | No |
| documentNumber | string, 7-9 dígitos | No | Sí |
| birthDate | string fecha, no futura | No | Sí |
| email | string email, hasta 254 caracteres | No | Sí |
| background | string, hasta 4000 caracteres | No | Sí |
| allergies | string, hasta 2000 caracteres | No | Sí |
| medication | string, hasta 2000 caracteres | No | Sí |
| createdAt | string fecha/hora | Lo genera el backend | No |
| updatedAt | string fecha/hora | Lo genera el backend | No |

**Objeto de respuesta:**

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "firstName": "Ana",
  "lastName": "Ejemplo",
  "phone": "+5493624000000",
  "documentNumber": "99000001",
  "birthDate": "1995-05-20",
  "email": "ana@example.test",
  "background": "Antecedentes ficticios",
  "allergies": null,
  "medication": null,
  "createdAt": "2026-10-16T12:00:00Z",
  "updatedAt": "2026-10-16T12:00:00Z"
}
```

### GET `/patients`

**Privado.** Listar pacientes.

**Query opcional:** `q` (búsqueda por nombre, apellido o documento), `page` (por defecto 1), `pageSize` (por defecto 20; máximo 100).

Ejemplo: `/patients?q=Ana&page=1&pageSize=20`.

**Respuesta 200:** `data` contiene objetos de paciente y `meta` contiene la paginación definida al final del documento. Orden por apellido y nombre ascendentes.

### GET `/patients/{patientId}`

**Privado.** Obtener ficha. `patientId` es obligatorio en la URL. No recibe body.

**Respuesta 200:** objeto de paciente completo. Inexistente: **404**.

### POST `/patients`

**Privado.** Crear paciente.

**Body mínimo:**

```json
{
  "firstName": "Ana",
  "lastName": "Ejemplo",
  "phone": "+5493624000000"
}
```

Se pueden agregar los campos opcionales de la tabla. No enviar `id`, `createdAt` ni `updatedAt`.

**Respuesta 201:** objeto de paciente completo. Documento repetido: **409 PATIENT_DOCUMENT_EXISTS**.

### PATCH `/patients/{patientId}`

**Privado.** Editar paciente. Acepta uno o más campos editables de la tabla.

**Ejemplo de body:**

```json
{
  "phone": "+5493624000001",
  "allergies": null
}
```

**Respuesta 200:** objeto actualizado completo. Inexistente: **404**. Documento repetido: **409**. No acepta un objeto vacío.

## 3. Turnos

### GET `/availability`

**Público.** Consultar horarios disponibles.

**Query obligatoria:** `date`, fecha local de Argentina. Ejemplo: `/availability?date=2026-10-19`.

**Respuesta 200:**

```json
{
  "date": "2026-10-19",
  "timeZone": "America/Argentina/Buenos_Aires",
  "slots": [
    {
      "startsAt": "2026-10-19T12:00:00Z",
      "endsAt": "2026-10-19T12:30:00Z"
    }
  ]
}
```

Sin horarios: `slots: []`. Se ofrecen bloques de 30 minutos de lunes a viernes entre 09:00 y 17:00 Argentina, desde hoy hasta 60 días. No se exponen datos de pacientes.

### POST `/appointment-requests`

**Público.** Solicitar un turno, sin crear una cuenta ni una ficha clínica.

**Body:**

```json
{
  "contactName": "Ana Ejemplo",
  "contactPhone": "+5493624000000",
  "contactEmail": "ana@example.test",
  "startsAt": "2026-10-19T12:00:00Z"
}
```

| Campo | Tipo / límite | Obligatorio |
|---|---|---|
| contactName | string, 1-160 caracteres | Sí |
| contactPhone | string, 6-30 caracteres | Sí |
| contactEmail | string email hasta 254, o null | No |
| startsAt | string fecha/hora de un slot disponible | Sí |

**Respuesta 201:**

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "startsAt": "2026-10-19T12:00:00Z",
  "endsAt": "2026-10-19T12:30:00Z",
  "status": "pending"
}
```

Horario ocupado: **409 SLOT_UNAVAILABLE**; refrescar disponibilidad. El turno queda pendiente de confirmación de la profesional.

### Datos expuestos del turno en el panel privado

```json
{
  "id": "33333333-3333-4333-8333-333333333333",
  "patientId": null,
  "contactName": "Ana Ejemplo",
  "contactPhone": "+5493624000000",
  "contactEmail": "ana@example.test",
  "startsAt": "2026-10-19T12:00:00Z",
  "endsAt": "2026-10-19T12:30:00Z",
  "status": "pending",
  "createdAt": "2026-10-16T12:00:00Z",
  "updatedAt": "2026-10-16T12:00:00Z"
}
```

`patientId` es null hasta vincular una ficha. `contactEmail` puede ser null. Los demás campos siempre tienen valor. Estados: `pending`, `confirmed`, `attended`, `cancelled`.

### GET `/appointments`

**Privado.** Consultar agenda.

**Query obligatoria:** `from` y `to`, fechas locales inclusivas, rango máximo 31 días.

**Query opcional:** `status`, `patientId`, `page`, `pageSize`.

Ejemplo: `/appointments?from=2026-10-19&to=2026-10-25&status=pending`.

**Respuesta 200:** listado paginado con objetos de turno completos. Orden por horario ascendente.

### GET `/appointments/{appointmentId}`

**Privado.** Obtener un turno.

**Respuesta 200:** objeto de turno completo. Inexistente: **404**.

### PATCH `/appointments/{appointmentId}`

**Privado.** Cambiar estado y vincular paciente al confirmar.

**Body para confirmar:**

```json
{
  "status": "confirmed",
  "patientId": "22222222-2222-4222-8222-222222222222"
}
```

Para cancelar o marcar atendido: enviar únicamente `status`, con `cancelled` o `attended`.

**Respuesta 200:** objeto de turno actualizado completo.

| Estado actual | Estado siguiente permitido |
|---|---|
| pending | confirmed, cancelled |
| confirmed | attended, cancelled |
| attended / cancelled | Sin cambios |

Confirmar exige una ficha existente. No se permite cambiar el paciente ya vinculado. Repetir el mismo estado sin cambiar el vínculo es válido. Transición inválida: **409 INVALID_STATUS_TRANSITION**. Esta versión no acepta reprogramación directa.

## 4. Consultas e historia clínica

La historia clínica se compone de la ficha del paciente y su listado de consultas.

### Campos de consulta

| Campo | Tipo / límite | Obligatorio al crear | Permite null |
|---|---|---|---|
| date | string fecha, no futura | Sí | No |
| reason | string, 1-500 caracteres | Sí | No |
| instructions | string, 1-4000 caracteres | Sí | No |
| objective | string, hasta 1000 caracteres | No | Sí |
| observations | string, hasta 4000 caracteres | No | Sí |
| weightKg | number, mayor que 0 y hasta 500 | No | Sí |
| heightCm | number, mayor que 0 y hasta 250 | No | Sí |
| waistCm | number, mayor que 0 y hasta 300 | No | Sí |
| appointmentId | string UUID | No | Sí |

Mediciones con hasta dos decimales, enviadas como números, no strings. No se calculan indicadores automáticamente.

### POST `/patients/{patientId}/consultations`

**Privado.** Registrar una consulta del paciente de la URL.

**Body de ejemplo:**

```json
{
  "date": "2026-10-19",
  "reason": "Primera consulta ficticia",
  "objective": "Organizar hábitos",
  "observations": null,
  "weightKg": 72.5,
  "heightCm": 168,
  "waistCm": null,
  "instructions": "Indicaciones de ejemplo",
  "appointmentId": "33333333-3333-4333-8333-333333333333"
}
```

**Respuesta 201:**

```json
{
  "id": "44444444-4444-4444-8444-444444444444",
  "patientId": "22222222-2222-4222-8222-222222222222",
  "appointmentId": "33333333-3333-4333-8333-333333333333",
  "date": "2026-10-19",
  "reason": "Primera consulta ficticia",
  "objective": "Organizar hábitos",
  "observations": null,
  "weightKg": 72.5,
  "heightCm": 168,
  "waistCm": null,
  "instructions": "Indicaciones de ejemplo",
  "createdAt": "2026-10-19T12:20:00Z",
  "updatedAt": "2026-10-19T12:20:00Z"
}
```

Si se envía `appointmentId`, el turno debe estar confirmado, pertenecer al paciente, haber comenzado y coincidir con el día de la consulta. Guardar la consulta cambia ese turno a `attended`. Una segunda consulta para ese mismo turno devuelve **409 APPOINTMENT_ALREADY_LINKED**. Sin vínculo, no se modifica ningún turno.

### GET `/patients/{patientId}/consultations`

**Privado.** Obtener el historial.

**Query opcional:** `page`, `pageSize`.

**Respuesta 200:** listado paginado con objetos de consulta completos. Orden por `date` descendente; para una misma fecha, por creación descendente. Paciente existente sin consultas: lista vacía. Paciente inexistente: **404**.

No se incluyen edición ni eliminación de consultas en esta versión.

## 5. Formato de los listados

Pacientes, agenda e historial comparten esta estructura. Los objetos de `data` tienen los campos completos definidos en su sección.

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

## 6. Formato de errores

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Revisá los campos indicados.",
    "details": [
      { "field": "firstName", "message": "El nombre es obligatorio." }
    ]
  },
  "requestId": "req-ejemplo-001"
}
```

`details` siempre es una lista; puede estar vacía. El frontend identifica el caso por `code` y usa `field` para mostrar errores junto al formulario.

| HTTP | Códigos posibles | Significado |
|---|---|---|
| 400 | VALIDATION_ERROR | Campos, fechas, parámetros o JSON inválidos. |
| 401 | INVALID_CREDENTIALS, UNAUTHENTICATED | Login incorrecto o sesión ausente/vencida. |
| 403 | CSRF_INVALID | Obtener token CSRF actualizado y permitir reenviar el formulario. |
| 404 | NOT_FOUND | Paciente o turno inexistente. |
| 409 | PATIENT_DOCUMENT_EXISTS | Documento ya registrado. |
| 409 | SLOT_UNAVAILABLE | Horario ocupado. |
| 409 | INVALID_STATUS_TRANSITION | Cambio de estado no permitido. |
| 409 | PATIENT_REQUIRED | Falta vincular paciente para confirmar. |
| 409 | APPOINTMENT_PATIENT_MISMATCH | El vínculo de paciente no corresponde a la operación. |
| 409 | APPOINTMENT_ALREADY_LINKED | El turno ya tiene una consulta registrada. |
| 429 | RATE_LIMITED | Demasiadas solicitudes; header Retry-After indica segundos de espera. |
| 500 | INTERNAL_ERROR | Error del servidor. |

## 7. Recorrido que debe poder construir el frontend

1. Visitante elige fecha, consulta disponibilidad y solicita turno.
2. Profesional inicia sesión y ve la solicitud pendiente en agenda.
3. Busca o crea una ficha y confirma el turno vinculando ese paciente.
4. Abre la ficha y registra una consulta vinculada: el turno pasa a atendido.
5. Consulta el historial y ve el registro guardado.
