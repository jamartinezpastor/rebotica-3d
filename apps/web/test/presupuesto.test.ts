import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Presupuesto del JavaScript inicial (principio 6, < 250 kB): three y React Three Fiber solo
 * pueden cargarse con `import()` dinámico. Este test recorre los imports estáticos que salen de
 * `main.tsx` y falla si alguno llega a esas librerías, directa o transitivamente.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const PROHIBIDOS = [/^three($|\/)/, /^@react-three\//];

/** Imports estáticos que sobreviven a la compilación (los `import type` se borran). */
function importsEstaticos(codigo: string): string[] {
  const sinComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const resultado: string[] = [];
  const patron = /(?:^|\n)\s*(import|export)\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of sinComentarios.matchAll(patron)) {
    const clausula = m[2] ?? '';
    const origen = m[3] ?? '';
    // `import type {…}` y `export type {…}` no generan código.
    if (/^type\s/.test(clausula)) continue;
    // `import { type A, type B }`: sin valores, tampoco generan código.
    const llaves = /^\{([^}]*)\}$/.exec(clausula.trim());
    if (
      llaves &&
      (llaves[1] ?? '').split(',').every((x) => /^\s*type\s/.test(x) || x.trim() === '')
    ) {
      continue;
    }
    resultado.push(origen);
  }
  // Efectos laterales: `import './index.css'`.
  for (const m of sinComentarios.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g)) {
    resultado.push(m[1] ?? '');
  }
  return resultado;
}

function resolver(desde: string, origen: string): string | null {
  const base = resolve(dirname(desde), origen);
  for (const candidato of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidato) && /\.(ts|tsx)$/.test(candidato)) return candidato;
  }
  return null;
}

function recorrer(entrada: string): { archivos: string[]; prohibidos: string[] } {
  const vistos = new Set<string>();
  const prohibidos: string[] = [];
  const pendientes = [entrada];
  while (pendientes.length > 0) {
    const archivo = pendientes.pop();
    if (!archivo || vistos.has(archivo)) continue;
    vistos.add(archivo);
    for (const origen of importsEstaticos(readFileSync(archivo, 'utf8'))) {
      if (PROHIBIDOS.some((p) => p.test(origen))) {
        prohibidos.push(`${archivo.replace(SRC, 'src')} → ${origen}`);
      } else if (origen.startsWith('.')) {
        const destino = resolver(archivo, origen);
        if (destino) pendientes.push(destino);
      }
    }
  }
  return { archivos: [...vistos], prohibidos };
}

describe('presupuesto del JavaScript inicial', () => {
  const { archivos, prohibidos } = recorrer(join(SRC, 'main.tsx'));

  it('el bundle inicial no importa three ni React Three Fiber', () => {
    expect(prohibidos).toEqual([]);
  });

  it('la vista lista y la detección de capacidad están en el bundle inicial', () => {
    const nombres = archivos.map((a) => a.replace(SRC, ''));
    expect(nombres.some((n) => n.endsWith('VistaLista.tsx'))).toBe(true);
    expect(nombres.some((n) => n.endsWith('capacidad.ts'))).toBe(true);
  });

  it('la escena solo se alcanza con import() dinámico', () => {
    const nombres = archivos.map((a) => a.replace(SRC, ''));
    expect(nombres.some((n) => n.endsWith('Escena.tsx'))).toBe(false);
    expect(nombres.some((n) => n.endsWith('Pasillo.tsx'))).toBe(false);
    expect(nombres.some((n) => n.endsWith('Caja.tsx'))).toBe(false);
  });

  it('el propio recorrido detecta una importación prohibida', () => {
    expect(importsEstaticos("import { Canvas } from '@react-three/fiber';")).toEqual([
      '@react-three/fiber',
    ]);
    expect(importsEstaticos("import type { Group } from 'three';")).toEqual([]);
    expect(importsEstaticos("import { type Group } from 'three';")).toEqual([]);
    expect(importsEstaticos("const E = lazy(() => import('./escena/Escena'));")).toEqual([]);
  });
});
