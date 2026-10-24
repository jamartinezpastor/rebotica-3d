import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// El servidor real de producción, aislado del catálogo local y de las credenciales de Gemini.
const servidor = spawn(process.execPath, ['apps/api/dist/server.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: '4175',
    HOST: '127.0.0.1',
    WEB_DIST: resolve('apps/web/dist'),
    DATABASE_URL: '',
    ASSETS_DIR: '',
    INTERPRETACION_IA_HABILITADA: 'false',
  },
});
process.on('SIGINT', () => servidor.kill('SIGINT'));
process.on('SIGTERM', () => servidor.kill('SIGTERM'));
servidor.on('error', () => {
  console.error('No se pudo iniciar el servidor de rendimiento');
  process.exitCode = 1;
});
servidor.on('exit', (codigo) => {
  process.exitCode = codigo ?? 1;
});
