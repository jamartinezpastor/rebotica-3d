import { createHash } from 'node:crypto';
import { SECCIONES_FT } from './cima';
import type { SeccionesFT } from './esquemas';

/** CIMA puede repartir una sección entre el padre y sus apartados (4.2.1, 4.2.2…). */
export function reunirSecciones(secciones: SeccionesFT): SeccionesFT {
  return SECCIONES_FT.flatMap((raiz) => {
    const partes = secciones
      .filter(
        (s) => (s.seccion === raiz || s.seccion.startsWith(`${raiz}.`)) && s.contenido?.trim(),
      )
      .sort((a, b) => a.seccion.localeCompare(b.seccion, 'en', { numeric: true }));
    if (partes.length === 0) return [];
    return [
      {
        seccion: raiz,
        titulo: secciones.find((s) => s.seccion === raiz)?.titulo ?? partes[0]!.titulo,
        contenido: partes.map((s) => s.contenido).join('\n'),
      },
    ];
  });
}

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

/** Palabras que CIMA escribe sin tilde en los nombres ATC y que en español la llevan. */
const TILDES: Record<string, string> = {
  analgesicos: 'analgésicos',
  antipireticos: 'antipiréticos',
  antihistaminicos: 'antihistamínicos',
  antiespasmodicos: 'antiespasmódicos',
  antiacidos: 'antiácidos',
  anticolinergicos: 'anticolinérgicos',
  antifungicos: 'antifúngicos',
  antisepticos: 'antisépticos',
  antibioticos: 'antibióticos',
  antiinflamatorios: 'antiinflamatorios',
  antitusivos: 'antitusivos',
  expectorantes: 'expectorantes',
  mucoliticos: 'mucolíticos',
  broncodilatadores: 'broncodilatadores',
  gastrointestinales: 'gastrointestinales',
  topicos: 'tópicos',
  topica: 'tópica',
  sistemicos: 'sistémicos',
  sistemico: 'sistémico',
  oftalmologicos: 'oftalmológicos',
  otologicos: 'otológicos',
  nasales: 'nasales',
  vitaminas: 'vitaminas',
  minerales: 'minerales',
  laxantes: 'laxantes',
  digestivos: 'digestivos',
  hormonales: 'hormonales',
  esteroides: 'esteroides',
  dermatologicos: 'dermatológicos',
  musculares: 'musculares',
  oseos: 'óseos',
  acido: 'ácido',
  acidos: 'ácidos',
  otros: 'otros',
  y: 'y',
};

/**
 * Nombre ATC de CIMA («OTROS ANALGESICOS Y ANTIPIRETICOS») en frase normal, con las tildes que
 * faltan en las palabras más habituales. Lo que no está en la lista se deja tal cual.
 */
export function categoriaLegible(nombreAtc: string): string {
  const minusculas = nombreAtc.trim().toLowerCase().replace(/\s+/g, ' ');
  const conTildes = minusculas
    .split(' ')
    .map((p) => TILDES[p] ?? p)
    .join(' ');
  return conTildes.charAt(0).toUpperCase() + conTildes.slice(1);
}
