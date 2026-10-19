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

- [Instalación, ejecución y configuración de HTTPS/túneles](backend/README.md).
- [Contrato de endpoints para el frontend](docs/api/contrato-api-frontend.md).
- [Arquitectura, base de datos y entorno](docs/desarrollo-api.md).

## Verificación

Desde backend: `npm run typecheck`, `npm run build` y `npm test`. Las pruebas de integración usan únicamente una base local separada llamada nutri_test. No ejecutar pruebas destructivas contra bases con datos que se necesiten conservar.

Cloudflare Tunnel se configura externamente; el proyecto no crea túneles ni contiene tokens de Cloudflare.
