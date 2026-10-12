import { describe, expect, it } from 'vitest';
import { hashTexto, htmlATexto } from '../src/texto';

describe('htmlATexto', () => {
  it('quita etiquetas, decodifica entidades numéricas y conserva los párrafos', () => {
    const html =
      '<div><p style="x"><u>Posolog&#237;a:</u></p><p>Adultos&#xa0;y &amp; m&#225;s</p><p>Fin</p></div>';
    expect(htmlATexto(html)).toBe('Posología:\nAdultos y & más\nFin');
  });

  it('no inventa entidades desconocidas ni acepta códigos inválidos', () => {
    expect(htmlATexto('<p>a &zzz; b &#0; c</p>')).toBe('a &zzz; b &#0; c');
  });
});

describe('hashTexto', () => {
  it('es estable y sensible al contenido', () => {
    expect(hashTexto('a')).toBe(hashTexto('a'));
    expect(hashTexto('a')).not.toBe(hashTexto('b'));
  });
});
