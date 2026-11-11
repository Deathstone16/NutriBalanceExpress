# NutriBalance Express

Backend académico de NutriTurnos: API REST con Express, TypeScript y PostgreSQL, organizada como monolito modular.

## Funcionalidades

- Autenticación profesional mediante sesiones persistentes y protección CSRF.
- Alta, edición, listado, búsqueda y ficha de pacientes.
- Solicitud pública de turnos, disponibilidad y gestión de estados.
- Registro de consultas e historial clínico cronológico.
- Configuración de proxy y cookies HTTPS preparada para conectar un Cloudflare Tunnel.

Los nombres internos se escriben en español; endpoints y campos HTTP conservan los nombres definidos en el contrato. Utilizar exclusivamente datos ficticios.

## Desarrollo local

Requisitos: Node.js 24 y npm. PostgreSQL 17 puede iniciarse mediante Docker o con la herramienta portable incluida para desarrollo.

```powershell
cd backend
npm ci
npm run setup:env
npm run db:local
```

Dejar la base funcionando y abrir otra terminal:

```powershell
cd backend
npm run setup:local -- --sin-docker
npm run dev
```

API local: `http://localhost:3000/api/v1`. Comprobación de conexión: `http://localhost:3000/health`.

Las credenciales de la profesional ficticia se generan localmente y quedan en `backend/.env`. El repositorio incluye solo `.env.example`, sin secretos operativos ni datos de la base.

## Documentación

- [Documentos seleccionados para entregar](docs/entrega/README.md).

- [Instalación, ejecución y configuración de HTTPS/túneles](backend/README.md).
- [Contrato de endpoints para el frontend](docs/api/contrato-api-frontend.md).
- [Arquitectura, base de datos y entorno](docs/desarrollo-api.md).

## Verificación

Desde backend: `npm run typecheck`, `npm run build` y `npm test`. Las pruebas de integración usan únicamente una base local separada llamada nutri_test. No ejecutar pruebas destructivas contra bases con datos que se necesiten conservar.

Cloudflare Tunnel se configura externamente; el proyecto no crea túneles ni contiene tokens de Cloudflare.

## Arrancar en la PC que tiene el túnel

Desde `backend`, con Node.js 24 y npm:

```powershell
npm ci
npm run serve:portable:tunnel
```

Este comando prepara `.env` si falta, inicia PostgreSQL portable si hace falta, aplica migraciones, crea la cuenta ficticia solo si no existe, compila e inicia Express. Conserva bases, secretos y contraseñas existentes. Para PostgreSQL ya administrado por Docker u otro servicio, usar `npm run serve:tunnel`.

El perfil del túnel fija `127.0.0.1`, confianza exclusiva en proxy local, cookie HttpOnly/Secure/Lax y el origen del frontend actual. No requiere cambiar el frontend. En el túnel existente, `api.neadev.com` debe apuntar a `http://127.0.0.1:3000` (sin `/api/v1` al final). Si configuraste otro `PORT`, usar ese puerto también en Cloudflare.

La cuenta se consulta en el `.env` privado de esa PC mediante `SEED_PROFESSIONAL_EMAIL` y `SEED_PROFESSIONAL_PASSWORD`; una cuenta existente conserva su clave. El frontend usa `/api/v1`, `nutri.sid` y `X-CSRF-Token`. No subir `.env`, bases locales ni credenciales del túnel.

Una vez levantado el túnel, `npm run check:public` comprueba por lecturas el health de la API, disponibilidad, rechazo anónimo y el gateway del frontend. Este control no crea turnos ni inicia sesión. Mantener la PC encendida y con la API y el túnel activos durante la defensa.
