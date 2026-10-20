import { describe, expect, it } from 'vitest';
import { hashTexto, htmlATexto, reunirSecciones } from '../src/texto';

describe('reunirSecciones', () => {
  it('incluye todos los subapartados en orden, incluso con padre vacío, y detecta sus cambios', () => {
    const partes = [
      { seccion: '4.2.2', titulo: 'Administración ficticia', contenido: '<p>Final ficticio.</p>' },
      { seccion: '4.2', titulo: 'Posología ficticia' },
      { seccion: '4.2.1', titulo: 'Dosis ficticia', contenido: '<p>Inicio ficticio.</p>' },
      { seccion: '5.1', titulo: 'Fuera de alcance', contenido: '<p>Otro.</p>' },
    ];
    const [seccion] = reunirSecciones(partes);
    expect(seccion?.seccion).toBe('4.2');
    expect(seccion?.titulo).toBe('Posología ficticia');
    const texto = htmlATexto(seccion?.contenido ?? '');
    expect(texto).toBe('Inicio ficticio.\n\nFinal ficticio.');
    partes[0]!.contenido += '<p>Cambio ficticio.</p>';
    expect(hashTexto(htmlATexto(reunirSecciones(partes)[0]?.contenido ?? ''))).not.toBe(
      hashTexto(texto),
    );
  });

  it('conserva el contenido padre y no toma 4.20 como parte de 4.2', () => {
    expect(
      reunirSecciones([
        { seccion: '4.2', titulo: 'Posología', contenido: '<p>Padre.</p>' },
        { seccion: '4.2.1', titulo: 'Posología', contenido: '<p>Hijo.</p>' },
        { seccion: '4.20', titulo: 'Otro', contenido: '<p>Ajeno.</p>' },
      ])[0]?.contenido,
    ).toBe('<p>Padre.</p>\n<p>Hijo.</p>');
  });
});

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
