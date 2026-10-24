import { expect, it } from 'vitest';
import {
  CONSULTAS_FRECUENTES,
  TERMINOS_INDICACIONES,
  consultasDeIndicacion,
  mencionaDolencia,
  terminosCoincidentes,
} from '../src';

it.each(CONSULTAS_FRECUENTES)(
  'las expresiones documentadas de $id funcionan con acentos, mayúsculas y saltos',
  (c) => {
    for (const termino of TERMINOS_INDICACIONES[c.id]) {
      const texto = `Texto sintético: ${termino.toUpperCase().replaceAll(' ', '\n')}.`;
      expect(mencionaDolencia(texto, c.id)).toBe(true);
      expect(terminosCoincidentes(texto, c.id)).toContain(termino);
      expect(consultasDeIndicacion(texto).map((x) => x.id)).toContain(c.id);
    }
  },
);
it('evita prefijos y no infiere indicaciones de una expresión genérica de dolor', () => {
  expect(mencionaDolencia('microcefaleas, migrañoso', 'dolor-cabeza')).toBe(false);
  expect(mencionaDolencia('Texto de prueba: dolor ocasional leve o moderado', 'dolor-cabeza')).toBe(
    false,
  );
  expect(mencionaDolencia('tostado', 'tos')).toBe(false);
});
