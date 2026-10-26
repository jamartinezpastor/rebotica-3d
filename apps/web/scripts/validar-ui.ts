import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import axe from 'axe-core';
import puppeteer, { type HTTPRequest, type Page } from 'puppeteer-core';
import {
  catalogoComparacion,
  fichaComparacion,
  productosComparacion,
} from '../test/fixtures/comparacion';

const raiz = fileURLToPath(new URL('../../../', import.meta.url));
const salida = resolve(raiz, '.local/validacion-ui');
const puerto = 4176;
const origen = `http://127.0.0.1:${puerto}`;
for (const p of productosComparacion)
  if (['demo-1', 'demo-76'].includes(p.nregistro))
    p.asset = {
      colorDominante: '#08773e',
      paleta: ['#08773e'],
      foto: '/media/miniaturas/validacion.svg',
    };
const chrome =
  process.env.CHROME_PATH ??
  [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find(existsSync);
if (!chrome) throw new Error('Indica CHROME_PATH para ejecutar la revisión de navegador.');
if (
  !existsSync(resolve(raiz, 'apps/web/dist/index.html')) ||
  !existsSync(resolve(raiz, 'apps/api/dist/server.js'))
)
  throw new Error('Ejecuta pnpm build antes de validar la UI.');
await mkdir(salida, { recursive: true });
const servidor = spawn(process.execPath, ['apps/api/dist/server.js'], {
  cwd: raiz,
  stdio: 'ignore',
  env: {
    ...process.env,
    PORT: String(puerto),
    HOST: '127.0.0.1',
    WEB_DIST: resolve(raiz, 'apps/web/dist'),
    DATABASE_URL: '',
    ASSETS_DIR: '',
    GEMINI_API_KEY: '',
    INTERPRETACION_IA_HABILITADA: 'false',
  },
});
let falloServidor: Error | undefined;
servidor.on('error', (e) => {
  falloServidor = e;
});
process.once('exit', () => servidor.kill('SIGTERM'));
const informe: {
  fecha: string;
  navegador?: string;
  revisiones: unknown[];
  errores: string[];
  limites: string[];
  pwa?: unknown;
} = {
  fecha: new Date().toISOString(),
  revisiones: [],
  errores: [],
  limites: [
    'No sustituye VoiceOver/NVDA, zoom del navegador ni instalación real en iOS/Android.',
    'Los datos del catálogo son ficticios. El servidor no usa BD ni credenciales de Gemini.',
    'Los fps de este navegador no son una medición en un móvil físico.',
  ],
};
async function esperarServidor() {
  for (let i = 0; i < 60; i++) {
    if (falloServidor) throw falloServidor;
    if (servidor.exitCode !== null)
      throw new Error('El servidor de validación no pudo arrancar; comprueba el puerto 4176.');
    try {
      if ((await fetch(`${origen}/api/health`)).ok) return;
    } catch {
      /* Aún arrancando. */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('No responde el servidor de validación.');
}
async function revisar(page: Page, nombre: string) {
  await page.addScriptTag({ content: axe.source });
  const resultados = await page.evaluate(async () => {
    const motor = (window as unknown as { axe: typeof axe }).axe;
    const r = await motor.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    });
    return {
      violaciones: r.violations.map((v) => ({
        id: v.id,
        impacto: v.impact,
        ayuda: v.help,
        url: v.helpUrl,
        nodos: v.nodes.map((n) => ({ objetivo: n.target, detalle: n.failureSummary })),
      })),
      incompletos: r.incomplete.map((v) => ({
        id: v.id,
        ayuda: v.help,
        nodos: v.nodes.map((n) => ({ objetivo: n.target, detalle: n.failureSummary })),
      })),
      reglasSuperadas: r.passes.length,
    };
  });
  const dimensiones = await page.evaluate(() => ({
    ancho: innerWidth,
    alto: innerHeight,
    contenido: document.documentElement.scrollWidth,
  }));
  informe.revisiones.push({ nombre, ...dimensiones, ...resultados });
  if (dimensiones.contenido > dimensiones.ancho + 1)
    informe.errores.push(`${nombre}: desbordamiento horizontal`);
  if (resultados.violaciones.length)
    informe.errores.push(`${nombre}: ${resultados.violaciones.map((v) => v.id).join(', ')}`);
  await page.screenshot({ path: resolve(salida, `${nombre}.png`) });
}
async function focoVisible(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2));
    const encima = document.elementFromPoint(x, y);
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.top < innerHeight &&
      !!encima &&
      el.contains(encima)
    );
  });
}
let navegador: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
try {
  await esperarServidor();
  navegador = await puppeteer.launch({ executablePath: chrome, headless: true });
  informe.navegador = await navegador.version();
  const page = await navegador.newPage();
  page.on('pageerror', (e) => informe.errores.push(`Error de página: ${String(e)}`));
  await page.setRequestInterception(true);
  const interceptar = (r: HTTPRequest) => {
    const url = new URL(r.url());
    if (url.origin !== origen) {
      void r.abort();
      return;
    }
    const responder = (body: unknown, status = 200) =>
      r.respond({
        status,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(body),
      });
    if (url.pathname === '/api/catalogo') {
      void responder(catalogoComparacion);
      return;
    }
    if (url.pathname === '/api/explorar') {
      const id = (JSON.parse(r.postData() ?? '{}') as { consultaId?: string }).consultaId;
      void responder({ ...catalogoComparacion, id: id ?? 'fiebre', titulo: 'Consulta ficticia' });
      return;
    }
    if (url.pathname === '/api/interpretar') {
      informe.errores.push('La revisión no debe enviar texto al intérprete.');
      void responder({}, 503);
      return;
    }
    if (url.pathname.startsWith('/api/productos/')) {
      const p = productosComparacion.find((p) => url.pathname.endsWith('/' + p.nregistro));
      void responder(p ? fichaComparacion(p) : {}, p ? 200 : 404);
      return;
    }
    if (url.pathname === '/media/miniaturas/validacion.svg') {
      void r.respond({
        status: 200,
        contentType: 'image/svg+xml',
        headers: { 'cache-control': 'no-store' },
        body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect x="8" y="8" width="184" height="104" fill="white" stroke="#08773e" stroke-width="3"/><text x="20" y="65" fill="#08773e" font-size="18">ENVASE FICTICIO</text></svg>',
      });
      return;
    }
    void r.continue();
  };
  page.on('request', interceptar);
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(origen, { waitUntil: 'networkidle0' });
  await page.waitForSelector('textarea');
  await revisar(page, 'portada');
  await page.goto(`${origen}/informacion`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('dl');
  await revisar(page, 'informacion');
  for (const { width, height } of [
    { width: 390, height: 844 },
    { width: 640, height: 360 },
    { width: 320, height: 256 },
  ]) {
    await page.setViewport({ width, height });
    await page.goto(`${origen}/escena?vista=lista`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-registro]');
    if ((await page.$$('[data-registro]')).length !== productosComparacion.length)
      informe.errores.push(`La lista no contiene todos los resultados (${width}x${height}).`);
    if (await page.$('nav[aria-label="Páginas del catálogo"]'))
      informe.errores.push('El catálogo no debe tener paginación.');
    await revisar(page, `lista-${width}x${height}`);
    await page.keyboard.press('Tab');
    const registroFoco = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-registro'),
    );
    if (!(await focoVisible(page)))
      informe.errores.push(`El foco del producto queda tapado (${width}x${height}).`);
    if (registroFoco !== 'demo-1')
      throw new Error(`Orden de foco inesperado en ${width}x${height}: ${registroFoco}`);
    await page.keyboard.press('Enter');
    await page.waitForSelector('section[role="dialog"] a[href^="https://cima.aemps.es"]');
    await revisar(page, `ficha-${width}x${height}`);
    await page.keyboard.down('Shift');
    await page.keyboard.press('Tab');
    await page.keyboard.up('Shift');
    const focoFinal = await page.evaluate(() => document.activeElement?.textContent);
    if (!(await focoVisible(page)))
      informe.errores.push(`El último control de la ficha queda tapado (${width}x${height}).`);
    if (focoFinal !== 'Privacidad y fuentes')
      informe.errores.push(`La ficha no contiene el foco con Mayús+Tab (${width}x${height}).`);
    await page.keyboard.press('Tab');
    const focoInicio = await page.evaluate(() => document.activeElement?.textContent);
    if (!(await focoVisible(page)))
      informe.errores.push(`El primer control de la ficha queda tapado (${width}x${height}).`);
    if (focoInicio !== 'Añadir a comparación')
      informe.errores.push(
        `La ficha no devuelve el foco a su primer control (${width}x${height}).`,
      );
    await page.keyboard.press('Escape');
    await page.waitForSelector('section[role="dialog"]', { hidden: true });
    const devuelto = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-registro'),
    );
    if (devuelto !== 'demo-1')
      informe.errores.push(`Escape no restaura el producto (${width}x${height}).`);
    informe.revisiones.push({
      nombre: `teclado-${width}x${height}`,
      registroFoco,
      focoFinal,
      focoInicio,
      devuelto,
    });
  }
  await page.setViewport({ width: 390, height: 844 });
  await page.goto(`${origen}/escena?vista=lista`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-registro]');
  for (const registro of ['demo-1', 'demo-76']) {
    await page.click(`[data-registro="${registro}"]`);
    await page.waitForSelector('section[role="dialog"] a[href^="https://cima.aemps.es"]');
    if (registro === 'demo-1') {
      await page.click('button[aria-label="Foto CIMA: ampliar foto del envase"]');
      await page.waitForSelector('dialog[open]');
      await revisar(page, 'foto');
      await page.keyboard.press('Escape');
      await page.waitForSelector('dialog[open]', { hidden: true });
      if (!(await page.$('section[role="dialog"]')))
        informe.errores.push('Cerrar la foto también cerró la ficha.');
    }
    if (registro === 'demo-76') await revisar(page, 'ficha-con-receta');
    await page.click('section[role="dialog"] button[aria-pressed]');
    await page.click('[aria-label="Volver al pasillo"]');
    await page.waitForSelector('section[role="dialog"]', { hidden: true });
  }
  await page.click('[aria-label="Comparar medicamentos"]');
  await page.waitForSelector('dialog[open] a[href]');
  await revisar(page, 'comparacion');
  await page.setViewport({ width: 320, height: 256 });
  await revisar(page, 'comparacion-320x256');
  await page.keyboard.press('Escape');
  await page.waitForSelector('dialog[open]', { hidden: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const animacion = await page.$eval(
    '.entrada-resultados',
    (el) => getComputedStyle(el).animationName,
  );
  informe.revisiones.push({ nombre: 'menos-movimiento', animacion });
  if (animacion !== 'none') informe.errores.push('La transición no respeta menos movimiento.');
  await page.setViewport({ width: 390, height: 844 });
  const manifest = (await (await fetch(`${origen}/manifest.webmanifest`)).json()) as {
    display: string;
    start_url: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  for (const icono of manifest.icons)
    if (!(await fetch(new URL(icono.src, origen))).ok)
      informe.errores.push(`Icono no disponible: ${icono.src}`);
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 });
  page.off('request', interceptar);
  await page.setRequestInterception(false);
  await page.goto(origen, { waitUntil: 'networkidle0' });
  await page.evaluate(() =>
    Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Service worker no preparado')), 15000),
      ),
    ]),
  );
  await page.reload({ waitUntil: 'networkidle0' });
  const cache = await page.evaluate(async () => {
    const claves = await caches.keys();
    const rutas: string[] = [];
    for (const clave of claves)
      for (const r of await (await caches.open(clave)).keys()) rutas.push(new URL(r.url).pathname);
    return { controlada: !!navigator.serviceWorker.controller, rutas };
  });
  if (cache.rutas.some((p) => p.startsWith('/api/') || p.startsWith('/media/')))
    informe.errores.push('La caché de la PWA contiene rutas de datos.');
  await page.setOfflineMode(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('textarea');
  informe.pwa = { manifest, cache, portadaSinRed: true, instalacionFisica: 'pendiente' };
} catch (error) {
  informe.errores.push(error instanceof Error ? error.message : String(error));
} finally {
  await navegador?.close();
  servidor.kill('SIGTERM');
  await writeFile(resolve(salida, 'resultados.json'), JSON.stringify(informe, null, 2));
}
console.log(
  `Validación UI: ${informe.revisiones.length} revisiones; ${informe.errores.length} incidencias. Informe: .local/validacion-ui/resultados.json`,
);
console.log(
  'Revisa los casos incompletos de axe y los límites manuales del informe antes de valorar conformidad.',
);
if (informe.errores.length) {
  for (const error of informe.errores) console.error(error);
  process.exitCode = 1;
}
