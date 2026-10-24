// @vitest-environment node
import { gzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import { medirJavaScript } from '../scripts/presupuesto';

it('mide el JavaScript inicial compartido una vez, incluye el registro PWA y excluye la escena diferida', () => {
  const archivos: Record<string, Buffer> = {
    'main.js': Buffer.from('entrada'),
    'compartido.js': Buffer.from('compartido'),
    'registerSW.js': Buffer.from('registro'),
  };
  const resultado = medirJavaScript(
    {
      entrada: {
        file: 'main.js',
        isEntry: true,
        imports: ['comun', 'comun'],
        dynamicImports: ['escena'],
      },
      comun: { file: 'compartido.js' },
      escena: { file: 'escena.js' },
    },
    '<script src="/main.js"></script><script defer src="/registerSW.js"></script>',
    (archivo) => {
      if (!archivos[archivo]) throw new Error(`No debe cargar ${archivo}`);
      return archivos[archivo];
    },
  );
  expect(resultado.chunks.map((c) => c.archivo).sort()).toEqual(Object.keys(archivos).sort());
  expect(resultado.gzipBytes).toBe(
    Object.values(archivos).reduce((n, b) => n + gzipSync(b, { level: 9 }).length, 0),
  );
});

it('rechaza un bundle que supera 250 kB comprimidos aunque no importe three', () => {
  let estado = 123456789;
  const ruido = Uint8Array.from({ length: 400_000 }, () => {
    estado ^= estado << 13;
    estado ^= estado >>> 17;
    estado ^= estado << 5;
    return estado & 255;
  });
  expect(() =>
    medirJavaScript({ entrada: { file: 'main.js', isEntry: true } }, '', () => ruido),
  ).toThrow('debe ser inferior a 250000');
});

it('falla ante manifiesto incompleto o JavaScript externo que evadiría el presupuesto', () => {
  expect(() =>
    medirJavaScript(
      { entrada: { file: 'main.js', isEntry: true, imports: ['ausente'] } },
      '',
      () => new Uint8Array(),
    ),
  ).toThrow('ausente');
  expect(() =>
    medirJavaScript(
      {},
      '<script src="https://example.invalid/app.js"></script>',
      () => new Uint8Array(),
    ),
  ).toThrow('debe ser local');
});
