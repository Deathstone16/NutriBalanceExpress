import { crearAplicacion } from './app.js';
import { entorno } from './config/entorno.js';
import { baseDatos, cerrarConexiones } from './database/cliente.js';

await baseDatos.$connect();
const servidor = crearAplicacion().listen(entorno.PORT, entorno.HOST, () => {
  console.log(`NutriTurnos API disponible en http://localhost:${entorno.PORT}/api/v1`);
});
let cerrando = false;
async function cerrarServidor() {
  if (cerrando) return;
  cerrando = true;
  servidor.close(async () => { await cerrarConexiones(); process.exit(0); });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', cerrarServidor);
process.on('SIGTERM', cerrarServidor);
