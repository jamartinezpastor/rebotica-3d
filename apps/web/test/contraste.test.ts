// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

function luminancia(hex: string) {
  const [r = 0, g = 0, b = 0] = (hex.match(/../g) ?? []).map((valor) => {
    const canal = parseInt(valor, 16) / 255;
    return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

it('los colores de texto mantienen contraste AA sobre sus superficies habituales', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  const colores = Object.fromEntries(
    [...css.matchAll(/--color-([\w-]+): #([\da-f]{6});/g)].map((m) => [m[1], m[2]]),
  );
  for (const [tinta, fondo] of [
    ['tinta', 'papel'],
    ['tinta-suave', 'papel'],
    ['cruz', 'papel'],
    ['cruz', 'cruz-claro'],
    ['cruz', 'ffffff'],
  ]) {
    const a = luminancia(colores[tinta!]!);
    const b = luminancia(colores[fondo!] ?? fondo!);
    expect(
      (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      `${tinta} sobre ${fondo}`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});
