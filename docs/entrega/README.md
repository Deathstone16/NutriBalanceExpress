# Entrega del TP Integrador - NutriBalance

Selección revisada el 11/11/2026. Los cinco PDF originales del equipo se conservaron sin modificar su contenido; se ordenaron y renombraron para evitar duplicados de descarga.

| Entregable de la consigna | Archivo o evidencia |
|---|---|
| 1. Análisis funcional | [01-analisis-funcional.pdf](01-analisis-funcional.pdf) |
| 2. Wireframes y prototipo navegable | [02-wireframes-y-prototipo.pdf](02-wireframes-y-prototipo.pdf) |
| 3. Modelo de datos | [03-modelo-de-datos-logico.pdf](03-modelo-de-datos-logico.pdf), [esquema Prisma real](../../backend/prisma/schema.prisma) y [migraciones](../../backend/prisma/migrations) |
| 4. Código y README | [Repositorio backend](https://github.com/Deathstone16/NutriBalanceExpress), [repositorio frontend](https://github.com/Maaupelozo/nutribalance-tp-web) |
| 5. Aplicación con BD | API Express/PostgreSQL; ejecución y pruebas en el [anexo actualizado](09-anexo-backend-y-entrega.pdf) |
| 6. URL pública | [NutriBalance](https://nutribalance-mauricio.maauri.chatgpt.site/). API: `https://api.neadev.com/api/v1` |
| 7. SEO y calidad | [07-evidencias-seo-y-calidad.pdf](07-evidencias-seo-y-calidad.pdf), [Lighthouse HTML](../evidencias/lighthouse-inicio-mobile-2026-11-08.report.html) y [JSON](../evidencias/lighthouse-inicio-mobile-2026-11-08.report.json) |
| 8. Documento final | [08-documento-final.pdf](08-documento-final.pdf) y [09-anexo-backend-y-entrega.pdf](09-anexo-backend-y-entrega.pdf) |
| 9. Defensa oral y demostración | Se realiza con ambos integrantes y el flujo publicado operativo. No se sustituye con un archivo. |

## Resultado de la revisión documental

Los documentos cubren análisis, requerimientos, wireframes, rutas del prototipo, relaciones de datos, SEO, stack, decisiones, dificultades, distribución del trabajo y uso de IA. Los wireframes contienen tres vistas y declaran que fueron reconstruidos a partir de la aplicación implementada; no se atribuyen a una etapa previa inexistente.

El modelo lógico coincide con los recursos del backend. Sus aclaraciones sobre migraciones no inspeccionadas corresponden al frontend desde el que se elaboró. El anexo incorpora el esquema PostgreSQL efectivamente revisado y corrige ese límite para esta entrega conjunta.

La memoria final original describe la integración del frontend y el uso de IA conocido en ese momento. El anexo identifica el apoyo posterior de Codex al arranque, pruebas y preparación de este backend, sin modificar la atribución de la implementación original.

Las rutas relativas mencionadas dentro de los PDF originales se refieren a la documentación del frontend. El paquete completo conserva esa documentación en `nutribalance-tp-web/docs`; para el backend se usa el [contrato propio](../api/contrato-api-frontend.md).

## Antes de presentar

1. En la PC del túnel: actualizar este repositorio, ejecutar `npm ci` dentro de `backend` y `npm run serve:portable:tunnel` (o `serve:tunnel` si PostgreSQL ya está funcionando).
2. Mantener el túnel existente con `api.neadev.com` dirigido a `http://127.0.0.1:3000`. No agregar `/api/v1` al destino del túnel.
3. Ejecutar `npm run check:public` y demostrar solicitud, confirmación con paciente, consulta e historial tras recargar. Una consulta vinculada exige un turno que ya haya comenzado.
4. Confirmar que el docente puede abrir ambos repositorios; un repositorio privado requiere acceso concedido por su propietario.
5. Confirmar con el responsable del frontend que su código entregado corresponde a la versión publicada. La revisión anterior detectó diferencias y este trabajo no modificó el frontend.

El ZIP contiene los fuentes versionados y estos documentos. Excluye `.git`, `node_modules`, compilaciones, `.env` privados, contraseñas, datos PostgreSQL, credenciales del túnel y descargas incompletas. No corresponde entregar el informe interno de auditoría ni el archivo `.crdownload`.
