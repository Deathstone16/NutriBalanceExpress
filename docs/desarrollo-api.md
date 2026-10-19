# Desarrollo de la API - NutriTurnos

Decisiones vigentes para el MVP académico. Actualizado: 19/10/2026.

## 1. Qué estamos construyendo

Un backend Express con TypeScript organizado como **monolito modular**: una sola aplicación, un solo despliegue y una base de datos; el código se divide por funcionalidades. El frontend lo desarrolla otra persona y consume los endpoints de [este contrato](api/contrato-api-frontend.md).

Módulos: autenticación, pacientes, turnos y consultas. El historial clínico es la ficha del paciente más sus consultas; no requiere una tabla adicional de “historia clínica” para este alcance.

El alcance corresponde al TP, con una profesional y datos ficticios. Cobros, archivos, fotos, portal de pacientes y funciones comerciales quedan fuera.

## 2. Qué es OpenAPI

OpenAPI es un formato estándar para describir endpoints, parámetros, cuerpos, respuestas y autenticación en un archivo JSON o YAML. Ese archivo puede alimentar documentación como Swagger UI, generación de tipos o herramientas de pruebas.

El contrato en Markdown cumple la misma función de acuerdo entre desarrolladores, con lectura humana. Express no exige OpenAPI. Por ahora se conserva únicamente el documento de endpoints; agregar OpenAPI después sería una automatización, no una condición para comenzar.

## 3. Stack implementado

| Pieza | Elección | Para qué |
|---|---|---|
| Runtime | Node.js 24 | Ejecutar la API en desarrollo y producción (`engines`: `>=24 <25`). |
| HTTP | Express 5 | Rutas y middleware. |
| Lenguaje | TypeScript, strict, ESM | Tipos y módulos; compilar a JavaScript para producción. |
| BD | PostgreSQL 17 | Persistir relaciones, transacciones y restricciones. |
| Acceso a BD | Prisma ORM 7 y adaptador PostgreSQL | Cliente tipado y migraciones. |
| Validación | Zod | Validar body, params, query y variables de entorno. |
| Login | express-session + connect-pg-simple | Cookie con sesión almacenada en PostgreSQL. |
| Contraseñas | argon2, variante Argon2id | Hash y verificación; no guardar contraseñas en texto. |
| Seguridad HTTP | helmet, cors, express-rate-limit | Headers, origen permitido y límites a rutas públicas/login. |
| Desarrollo | npm + tsx | Un gestor, un lockfile; recarga de TypeScript. |
| Pruebas | Vitest + Supertest | Suite unitaria y de integración contra `nutri_test`. |
| Base local portable | embedded-postgres 17.10.0-beta.17 | Alternativa a Docker para desarrollo; datos persistentes bajo `.local/postgres`. |

Prisma y PostgreSQL son elecciones propuestas, no obligaciones del TP. No hace falta Redis, colas, microservicios ni contenedores para cada módulo. Prisma reemplaza la necesidad de crear otra capa ORM: no se agrega Sequelize o TypeORM junto con él.

Fijar versiones exactas instaladas en package-lock.json y mantener prisma/@prisma/client/@prisma/adapter-pg compatibles. Node 24 figura como LTS y está dentro del rango admitido por Prisma 7. No basar la instalación en tutoriales de Prisma 6: la configuración actual usa prisma.config.ts y adaptador de driver.

## 4. Estructura actual

La carpeta backend separa el código de la API de los presupuestos y PDF del workspace. Esta estructura está implementada; los módulos evolucionan a medida que se completa el flujo del contrato.

```text
Nutri_express/
  docs/
    api/contrato-api-frontend.md
    desarrollo-api.md
  backend/
    src/
      app.ts
      server.ts
      config/
        entorno.ts
        sesion.ts
      database/
        cliente.ts
      shared/
        fechas.ts
        validacion.ts
        errors/
          error-aplicacion.ts
        middlewares/
          errores.ts
          limites.ts
        types/
          express-session.d.ts
      modules/
        autenticacion/
          autenticacion.rutas.ts
          autenticacion.controlador.ts
          autenticacion.servicio.ts
          autenticacion.repositorio.ts
          autenticacion.middleware.ts
          autenticacion.csrf.ts
        pacientes/
          pacientes.rutas.ts
          pacientes.controlador.ts
          pacientes.servicio.ts
          pacientes.repositorio.ts
          pacientes.esquemas.ts
          pacientes.presentador.ts
        turnos/
          turnos.rutas.ts
          turnos.controlador.ts
          turnos.servicio.ts
          turnos.repositorio.ts
          turnos.esquemas.ts
          turnos.presentador.ts
        consultas/
          consultas.rutas.ts
          consultas.servicio.ts
          consultas.repositorio.ts
          consultas.esquemas.ts
          consultas.presentador.ts
      generated/prisma/        # generado; no editar
    prisma/
      schema.prisma
      migrations/
      seed.ts
    tests/
      integration/
      unit/
    scripts/
      preparar-local.ts
      postgres-local.ts
      ejecutar-pruebas.ts
    .env.example
    .env                      # local, ignorado por Git
    .gitignore
    .nvmrc
    compose.yaml
    prisma.config.ts
    package.json
    package-lock.json
    tsconfig.json
    tsconfig.verificacion.json
    vitest.config.ts
```

El contrato HTTP conserva campos en inglés; nombres de carpetas, clases, variables y campos Prisma internos están en español. Se usa `server.ts` para el arranque y `app.ts` para crear Express y montar middleware y routers.

### Responsabilidad de cada archivo

| Archivo / capa | Responsabilidad |
|---|---|
| app.ts / server.ts | `app.ts` crea Express y monta middleware y rutas; `server.ts` conecta Prisma, escucha en localhost y cierra conexiones. |
| config/entorno.ts y config/sesion.ts | Validar variables y configurar sesión persistida en PostgreSQL. |
| database/cliente.ts | Instancia compartida de PrismaClient con el adaptador pg. |
| *.rutas.ts | Vincular URLs a controladores y middleware de módulo. |
| *.controlador.ts | Leer y validar entrada, llamar al servicio y devolver estado/JSON. |
| *.esquemas.ts | Esquemas Zod; los errores fluyen al manejador global. |
| *.servicio.ts | Reglas de negocio y coordinación transaccional, sin objetos HTTP. |
| *.repositorio.ts | Consultas concretas del módulo a la base. |
| *.presentador.ts | Convertir registros a la forma contractual, incluidas fechas y campos expuestos. |

Recorrido: ruta -> validación -> controller -> service -> repository -> BD; respuesta vuelve por presenter/controller. No se requiere contenedor de inyección de dependencias; se pueden componer funciones o clases explícitamente.

### Límites de los módulos

- Auth maneja el usuario profesional y su sesión; no administra pacientes.
- Patients maneja identificación y antecedentes; no conoce detalles de turnos.
- Appointments maneja disponibilidad, solicitudes, vínculo con paciente y estados.
- Consultations maneja consultas y cronología. Al guardar una consulta vinculada, coordina el cierre del turno mediante un servicio de appointments en la MISMA transacción.
- No importar repositories privados de otro módulo desde controllers. Servicios exponen las operaciones necesarias; evitar dependencias circulares (appointments no importa consultations).
- shared contiene mecanismos comunes, no reglas de pacientes o turnos. No crear una carpeta utils como depósito de lógica del negocio.

## 5. Base de datos

### Tablas

| Tabla | Columnas principales y reglas |
|---|---|
| users | id UUID PK, email varchar(254) único normalizado, display_name varchar(100), password_hash text, role professional, created_at. Un usuario creado por seed. |
| patients | id UUID PK, first_name/last_name varchar(80), phone varchar(30), document_number varchar(9) nullable único, birth_date DATE nullable, email varchar(254) nullable, background/allergies/medication text nullable, created_at/updated_at. |
| appointments | id UUID PK, patient_id UUID FK nullable, contact_name varchar(160), contact_phone varchar(30), contact_email varchar(254) nullable, starts_at/ends_at TIMESTAMPTZ, status, created_at/updated_at. |
| consultations | id UUID PK, patient_id UUID FK obligatoria, appointment_id UUID FK nullable único, date DATE, reason varchar(500), objective varchar(1000) nullable, observations text nullable, weight_kg/height_cm/waist_cm NUMERIC(5,2) nullable, instructions text, created_at/updated_at. |
| sessions | Tabla técnica del store: sid varchar PK, sess JSON, expire TIMESTAMP según formato del adaptador connect-pg-simple. Índice por expire. No es un recurso público. |

No guardar edad: se deriva de birth_date. No guardar contraseña en Patient. No unir pacientes por teléfono automáticamente. No usar un único JSON gigante como historia clínica: cada consulta es un registro consultable.

Relaciones:

```text
Patient 1 ---- N Consultation
Patient 1 ---- N Appointment (patient_id puede ser null en solicitud)
Appointment 1 ---- 0..1 Consultation
```

Una solicitud puede existir sin paciente. La profesional busca o crea la ficha y la vincula al confirmar. Los datos de contacto originales quedan en el turno; no se actualizan silenciosamente al editar la ficha.

### Tipos y restricciones

- Estados: pending, confirmed, attended, cancelled. Usar enum de PostgreSQL o CHECK versionado.
- Nacimiento y consulta son fechas civiles DATE, no instantes. API devuelve YYYY-MM-DD sin cambios por zona horaria.
- Horarios y timestamps se almacenan como instantes; respuestas en UTC. Mostrar agenda en America/Argentina/Buenos_Aires.
- Medidas decimales exactas en BD; el presenter transforma Decimal de Prisma a number para cumplir el contrato.
- Documento único permite varias fichas con null; normalizar antes de insertar. Índice único también controla creaciones concurrentes.
- FK con eliminación restringida. No hay endpoints de borrado para este MVP.
- Índices: patients(last_name, first_name, id); appointments(starts_at, id); consultations(patient_id, date, created_at, id); unicidad de appointment_id cuando no es null.

Para bloquear reservas duplicadas sin impedir reutilizar horarios cancelados, incluir en una migración SQL:

```sql
CREATE UNIQUE INDEX appointments_active_slot_unique
ON appointments (starts_at)
WHERE status <> 'cancelled';
```

Esa regla funciona porque todos los slots son de 30 minutos y están alineados. No resuelve duraciones libres o múltiples agendas. Ante violación devolver 409 SLOT_UNAVAILABLE, no un error SQL.

### Transacciones

Guardar consulta vinculada: verificar turno confirmado y paciente correcto, insertar consulta y pasar turno a attended en una transacción. Si una parte falla, rollback de todo. Usar bloqueo/actualización condicional o aislamiento adecuado para que no se confirme una consulta sobre un turno cancelado concurrentemente.

## 6. Entorno local

La API se ejecuta con npm/tsx en el host. PostgreSQL puede correr en Docker Compose o con `embedded-postgres`; ambos modos usan `localhost:5433` y persisten datos. En este host Docker falla al conectarse al socket, por lo que el modo portable es el flujo práctico; también queda disponible para hosts sin Docker.

`backend/` contiene `.env.example`, `.gitignore`, `.nvmrc`, `compose.yaml`, scripts npm y la implementación. La preparación local instala/valida el esquema, genera Prisma, aplica migraciones y ejecuta el seed.

Puertos propuestos: frontend 5173, API 3000, PostgreSQL expuesto solo en localhost:5433 (internamente 5432). El puerto 5433 reduce conflictos con un PostgreSQL instalado localmente. No se inicia nada automáticamente.

Instalación limpia desde `backend/` usando Docker:

```powershell
npm ci
npm run setup:local
```

`setup:local` crea `.env` si falta, levanta la base Docker y prepara `nutri_dev`/`nutri_test`. Completá los secretos del `.env` local; no publiques `SEED_PROFESSIONAL_PASSWORD`, que contiene la contraseña aleatoria de la cuenta demo.

Si Docker no está disponible, ejecutá `npm run setup:env` para generar `.env` con secretos locales. En una terminal ejecutá `npm run db:local`; en otra, desde `backend/`, ejecutá `npm run setup:local -- --sin-docker`. `db:local` crea ambas bases y guarda sus archivos en `.local/postgres`; Ctrl+C detiene el proceso. Este modo requiere `.env` porque usa `DATABASE_URL` para configurar el servidor. Para detener Docker sin borrar datos: `docker compose stop db`.

### Variables

| Variable | Uso |
|---|---|
| NODE_ENV | development / test / production. |
| PORT | Puerto de Express, propuesto 3000. |
| APP_ORIGIN | Origen exacto del frontend para CORS; development localhost:5173. |
| TRUST_PROXY | none en HTTP local; loopback cuando cloudflared conecta desde la misma máquina; one solo detrás de un salto de proxy conocido. |
| SESSION_COOKIE_SECURE | true cuando el navegador accede por HTTPS; false solo en desarrollo HTTP. |
| SESSION_COOKIE_SAME_SITE | lax para mismo sitio; none si frontend y API están en sitios distintos (exige Secure). |
| POSTGRES_USER / PASSWORD / DB | Inicialización de la BD local Docker. No son la cuenta del profesional. |
| DATABASE_URL | Conexión de la API y migraciones a BD de desarrollo. |
| TEST_DATABASE_URL | BD de prueba separada; crear nutri_test antes de usarla. Nunca ejecutar pruebas de limpieza contra nutri_dev o producción. |
| SESSION_SECRET | Secreto aleatorio de al menos 32 bytes; sin valor real en el ejemplo. |
| SESSION_TTL_HOURS | 12; vencimiento absoluto de la sesión autenticada. |
| CLINIC_TIME_ZONE | America/Argentina/Buenos_Aires para agenda y fechas locales. |
| SEED_PROFESSIONAL_EMAIL / PASSWORD | Cuenta ficticia inicial; password debe hashearse antes de persistir. |

La aplicación falla al arrancar si faltan secretos o URLs. Los scripts cargan `.env`; el seed hashea la contraseña demo y no debe divulgarse ni copiarse a entornos compartidos.

## 7. Configuración de TypeScript y comandos

El backend usa `type=module`; TypeScript compila ES2022 con NodeNext y strict, y los imports relativos llevan `.js`. Desarrollo usa tsx; producción ejecuta JavaScript compilado. Seed y pruebas se ejecutan fuera del árbol de salida del servidor.

Scripts npm disponibles en `backend/package.json`:

| Script npm | Comando / propósito |
|---|---|
| dev | tsx watch src/server.ts |
| build | prisma generate && tsc -p tsconfig.json |
| start | node dist/server.js |
| typecheck | tsc -p tsconfig.verificacion.json (código, scripts y pruebas) |
| db:generate | prisma generate |
| db:migrate | prisma migrate dev |
| db:deploy | prisma migrate deploy |
| db:seed | prisma db seed (ejecuta prisma/seed.ts) |
| setup:env | Generar .env con secretos aleatorios si falta, sin iniciar servicios. |
| setup:local | Preparar PostgreSQL local, cliente, migraciones y seed. Acepta `-- --sin-docker`. |
| db:local | Iniciar PostgreSQL portable, persistente en `.local/postgres`. |
| test | Preparar `nutri_test` y ejecutar la suite completa; nunca apunta a `nutri_dev`. |
| test:unit | Ejecutar solo `tests/unit` con Vitest. |
| test:integration | Preparar `nutri_test` y ejecutar solo `tests/integration`. |

Para compilar y arrancar en producción: `npm ci`, `npm run build`, configurar variables de entorno y aplicar `npm run db:deploy` antes de `npm start`. El estado real de las verificaciones se informa por separado; esta lista describe los comandos, no afirma un resultado de ejecución.

En Prisma 7: datasource PostgreSQL y generador en schema.prisma; URL de migración y seed en prisma.config.ts; cliente runtime con @prisma/adapter-pg y DATABASE_URL. Versionar las migraciones, incluyendo SQL manual de índice parcial y tabla técnica de sesiones. Evitar creación automática de tablas del store en producción: debe hacerse con migraciones revisadas.

Dev usa migrate dev para generar y aplicar cambios; producción usa migrate deploy. No sustituir migraciones con db push al entregar. Si el proveedor ofrece URL pooled y direct, usar la directa para migraciones y la adecuada para runtime.

## 8. Autenticación y middleware

Se conserva el contrato ya compartido: cookie de sesión, no JWT. Sesiones persistidas en la misma BD PostgreSQL, mediante connect-pg-simple. MemoryStore no sirve para producción. Cookie HttpOnly, Secure obligatorio en producción y SameSite configurable. La confianza del proxy es configurable también en desarrollo para un futuro Cloudflare Tunnel. El README detalla los perfiles local, HTTPS y frontend en otro sitio; no se crea ni configura el túnel desde el proyecto.

El token CSRF vive en la sesión. GET /auth/csrf permite obtenerlo y POST login regenera sesión/token. Las mutaciones públicas también exigen token. La protección se implementa con un mecanismo revisado de token vinculado a sesión; no improvisar un header fijo. Validación de CSRF no reemplaza autenticación ni rate limiting.

Orden propuesto: requestId -> Helmet/CORS -> parser JSON limitado -> sesión -> rutas con validación/auth/CSRF -> 404 -> error handler. El controller no devuelve passwordHash ni objetos crudos del usuario.

Errores JSON siguen el contrato. Zod valida body/params/query; el servicio valida reglas como disponibilidad o transiciones. Los logs de errores internos incluyen requestId y tipo de excepción, sin contraseñas, cookies ni contenido clínico. No hay respuestas cacheables con información privada.

## 9. Pruebas y publicación

- BD de prueba distinta, con migraciones reales. No confiar en mocks para comprobar persistencia o índices.
- Probar login/logout, lectura sin sesión, escritura sin CSRF, CRUD de paciente definido en contrato e historial ordenado.
- Pruebas de integración relevantes: documento duplicado, dos reservas simultáneas y rollback al registrar consulta vinculada.
- Producción: un servicio Node con npm ci/build/start, PostgreSQL persistente y migraciones ejecutadas durante despliegue antes del tráfico. HTTPS mediante hosting/proxy.
- Variables de producción distintas. La profesional demo usa datos ficticios. Pruebas y seed no se ejecutan contra producción automáticamente.

## 10. Estado de implementación

El backend ya cuenta con arranque Express, configuración de entorno y sesión, cliente Prisma, schema/migraciones, setup local y módulos `autenticacion`, `pacientes`, `turnos` y `consultas`. Las rutas se montan en `app.ts`; pacientes implementa capas explícitas de rutas/controlador/servicio/repositorio/presentador. Consultas y turnos conservan sus propias composiciones según el flujo.

Verificado el 19/10/2026: typecheck de código/scripts/tests, build de producción y 27 pruebas (22 de integración con PostgreSQL real y 5 unitarias) aprobadas. Incluyen cookies HTTPS, confianza de proxy y CORS, simulando un proxy local sin abrir túneles. La auditoría de dependencias de producción realizada durante la implementación reportó 0 vulnerabilidades conocidas. Se comprobó por HTTP el servidor compilado: health, CSRF, login y pacientes respondieron 200; logout respondió 204. Se probó PostgreSQL 17 portable porque Docker Desktop del host falla por un socket bloqueado. No se validó el arranque de Compose en este host ni un despliegue público.

La integración visual con el frontend queda a cargo del desarrollador del frontend usando el contrato. Los datos de pruebas residen en nutri_test y no contaminan nutri_dev.

## Referencias técnicas verificadas

- [Express: instalación y TypeScript](https://expressjs.com/en/starter/installing/).
- [Node.js: versiones LTS](https://nodejs.org/en/about/previous-releases).
- [Prisma 7: requisitos](https://www.prisma.io/docs/orm/v7/reference/system-requirements).
- [Prisma 7 con PostgreSQL](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).
- [Express-session: almacenamiento y cookies](https://expressjs.com/en/resources/middleware/session/).
