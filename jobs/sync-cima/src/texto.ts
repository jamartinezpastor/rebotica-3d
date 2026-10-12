import { createHash } from 'node:crypto';

const ENTIDADES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodificar(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entidad, cuerpo: string) => {
    if (cuerpo.startsWith('#')) {
      const codigo =
        cuerpo[1] === 'x' || cuerpo[1] === 'X'
          ? parseInt(cuerpo.slice(2), 16)
          : parseInt(cuerpo.slice(1), 10);
      return Number.isFinite(codigo) && codigo > 0 && codigo <= 0x10ffff
        ? String.fromCodePoint(codigo)
        : entidad;
    }
    return ENTIDADES[cuerpo.toLowerCase()] ?? entidad;
  });
}

/** Texto plano de un fragmento HTML de la ficha técnica, con saltos de línea por bloque. */
export function htmlATexto(html: string): string {
  const sinEtiquetas = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|tr|h[1-6]|table|ul|ol)\s*>/gi, '\n')
    .replace(/<\/\s*t[dh]\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '');
  return decodificar(sinEtiquetas)
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Hash estable del texto de una sección: si cambia, F1-03 manda la regla a revisión. */
export function hashTexto(texto: string): string {
  return createHash('sha256').update(texto, 'utf8').digest('hex');
}
