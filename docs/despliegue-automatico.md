# CI/CD de NutriBalance en la PC y Cloudflare

## Funcionamiento

```text
Push a main del frontend o backend
  → GitHub Actions: instalación, tipos, pruebas y compilación
  → solicitud de despliegue local-cloudflare, solo si CI termina correctamente
  → agente de la PC comprueba main y el resultado de Actions
  → copia nueva del SHA aprobado, instalación y compilación local
  → cambio de versión y comprobación de servicios
  → estado success/failure en GitHub Deployments
```

Repositorios:

- Frontend: [Deathstone16/nutribalance-tp-web](https://github.com/Deathstone16/nutribalance-tp-web), fork propio del proyecto de Mauricio.
- Backend: `Deathstone16/NutriBalanceExpress`.

El agente consulta cada 30 segundos. Un commit desplegable debe seguir siendo la cabeza de `main`, tener una ejecución `push` o `workflow_dispatch` del mismo repositorio y haber terminado correctamente. Si `main` avanza durante la preparación, se espera a la nueva versión. Los PR y sus forks no provocan ejecución en la PC.

Las dos pipelines usan ejecutores de GitHub. La PC no se registra como runner: el agente obtiene los resultados con GitHub CLI y no expone un endpoint para recibir comandos. Ambos repositorios operativos pertenecen a `Deathstone16`. El frontend conserva el original de Mauricio como remoto `upstream` y publica los cambios en el fork mediante `origin`.

Vercel debe importar el fork del frontend y seguir su rama `main`. Cuando se conecte el proyecto en Vercel, sus despliegues y el despliegue local por Cloudflare podrán coexistir. Las variables y los pasos están en [la guía del frontend](https://github.com/Deathstone16/nutribalance-tp-web/blob/main/docs/despliegue-vercel.md).

## Servicios publicados

| Servicio | Destino |
|---|---|
| Web para exponer | `https://api.neadev.com/` → Cloudflare existente → frontend en 127.0.0.1:3000 |
| API interna del frontend | Gateway `/api/v1` → Express en 127.0.0.1:3001 |
| API directa para consultas | Segundo túnel Cloudflare → Express en 127.0.0.1:3001 |
| PostgreSQL | Directorio persistente y puerto local del `.env` privado |

El segundo túnel usa una URL temporal `trycloudflare.com`. Mientras el proceso siga activo, los despliegues no cambian esa dirección. Puede cambiar al reiniciar el túnel o la PC; el agente actualiza `frontend/.sites-runtime/expo/api-url.json`, `deployment/state.json` y únicamente la variable `baseUrl` de la colección local de Postman. Para una dirección fija adicional hace falta configurar otro hostname en la cuenta de Cloudflare.

La API directa conserva cookie de sesión, CSRF, autenticación y validación. `/health` verifica la conexión con PostgreSQL. Las lecturas privadas requieren login. En Postman: obtener CSRF, iniciar sesión y usar el nuevo token para escrituras; el cliente conserva la cookie.

Cloudflare Access está activo en `api.neadev.com`: sin autorización devuelve 403. El despliegue comprueba la portada HTML, frontend y API dentro de la PC. Si el dominio devuelve la página identificable de Cloudflare Access, registra `publicEndpoint.access=cloudflare-access` y `externalApplicationVerified=false`; no desactiva la protección ni afirma haber validado la aplicación a través de ella. La comprobación completa desde Vercel queda pendiente de cargar allí `CF_ACCESS_CLIENT_ID` y `CF_ACCESS_CLIENT_SECRET` del Service Token. No hace falta guardar ese secreto en esta PC.

## Instalación en esta PC

Requisitos: Windows, PowerShell 7, Node.js 24, Corepack, Git, GitHub CLI y cloudflared. GitHub CLI debe estar autenticado con acceso de lectura a código/Actions y de escritura a Deployments en ambos repositorios. No se copia su token a GitHub Actions ni a los fuentes.

Con frontend y backend preparados y sus `.env` locales existentes:

```powershell
Set-Location 'C:\Users\Bruno\Desktop\Nutri_express'
& ./backend/scripts/setup-deployment.ps1 -Autostart -Start
```

El instalador crea la configuración sin valores secretos en `deployment/config.json`, copia los scripts de operación a `deployment/ops` e instala un acceso directo del usuario para iniciar el agente **después de entrar a Windows**. No instala servicios administrativos ni cambia opciones de energía.

La PC debe estar encendida, conectada y sin suspensión. El servicio de Cloudflare del frontend debe seguir apuntando a 127.0.0.1:3000. Al iniciar, el agente recupera los últimos directorios activos y levanta los servicios si faltan.

La configuración conserva como fuentes privadas el `.env` del backend y `.env.local` del frontend de este workspace. No eliminarlos. Si se mueve el proyecto o cambia el usuario, actualizar las rutas ejecutando el instalador desde la ubicación nueva.

## Datos, secretos y versiones

Los commits se preparan en `deployment/releases/<componente>/<sha>`. No se usa `git reset --hard` sobre los repositorios de trabajo ni se sobrescriben sus cambios locales. Las dependencias y la compilación se resuelven antes de interrumpir la versión activa.

Los archivos privados de entorno se copian solo a las carpetas locales de preparación, ignoradas por Git. No se transfieren a los ejecutores de GitHub. Los valores de PostgreSQL y sesión de la pipeline CI son únicamente de una base aislada de test.

Las versiones de backend acceden al mismo directorio persistente de PostgreSQL mediante una unión de Windows. Antes de aplicar una versión nueva del backend, el agente detiene los servicios propios y crea una **copia física con PostgreSQL detenido** en `deployment/backups`. Si el servidor sigue activo por otra causa, cancela el respaldo y la actualización en lugar de copiar datos en uso.

El arranque de Express utiliza únicamente `prisma migrate deploy`; no ejecuta resets ni crea una base vacía para sustituir la existente. Una migración puede cambiar el esquema: el retorno al código anterior no revierte SQL ni restaura automáticamente el respaldo, para evitar perder datos posteriores. Revisar y probar las migraciones antes de hacer merge.

Se conservan los directorios de versiones y respaldos para recuperación. Su limpieza es manual; revisar el espacio disponible. Actualizaciones del propio agente requieren volver a ejecutar el instalador y reiniciar el agente; los cambios normales de frontend/backend se aplican automáticamente.

## Supervisión

```powershell
node deployment/ops/agent.mjs --config deployment/config.json --status
```

Campos principales: `live` identifica carpetas y SHAs activos; `repositories` muestra CI y resultado de despliegue; `lastDeployment` es el último cambio correcto; `apiUrl` indica la API directa y `lastDatabaseBackup` la última copia física.

Registros:

- `deployment/agent-out.log` y `agent-error.log`: agente.
- `deployment/app-out.log` y `app-error.log`: servicios publicados.
- `deployment/<componente>-<sha>.log`: instalación y compilación de un candidato.

En GitHub: **Actions** muestra validación y solicitud; **Deployments**, entorno `local-cloudflare`, muestra el resultado aplicado por la PC. No confundir CI aprobada con versión ya activa si la PC está apagada.

## Detener, reiniciar y reintentar

```powershell
# Detener solo el agente; la web y la API siguen funcionando.
node deployment/ops/agent.mjs --config deployment/config.json --stop

# Iniciar nuevamente.
& ./deployment/ops/start-agent.ps1
```

Si una versión falla al preparar, sigue activa la anterior. Si falla después del cambio, se intenta recuperar la pareja de directorios anterior y se informa `failure`. Un SHA fallido no se reintenta en bucle: corregirlo con otro commit o, después de detener el agente, ejecutar:

```powershell
node deployment/ops/agent.mjs --config deployment/config.json --retry
```

Este comando deja el agente en primer plano y permite reintentar los commits aprobados. No ejecutarlo a la vez que otra instancia.

## Alcance de las comprobaciones

CI backend usa PostgreSQL 17 aislado, comprueba tipos, genera Prisma, compila y ejecuta las pruebas. CI frontend usa el lockfile, sus pruebas, Next.js y TypeScript. El despliegue local valida servicios y portada local, y distingue entre portada pública y bloqueo de Cloudflare Access. La comprobación funcional completa se puede ejecutar desde Vercel con `pnpm check:public` después de configurar el Service Token.

Referencias: [GitHub Actions](https://docs.github.com/en/actions), [GitHub Deployments API](https://docs.github.com/en/rest/deployments), [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
