import { CONSULTAS_FRECUENTES } from './consulta';

type IdConsulta = (typeof CONSULTAS_FRECUENTES)[number]['id'];
export const VERSION_CORRESPONDENCIAS = 1 as const;
/** Correspondencias documentales v1. Solo se buscan estas expresiones en la sección 4.1. */
export const TERMINOS_INDICACIONES: Record<IdConsulta, readonly string[]> = {
  'dolor-cabeza': [
    'dolor de cabeza',
    'dolores de cabeza',
    'cefalea',
    'cefaleas',
    'migraña',
    'migrañas',
  ],
  fiebre: ['fiebre', 'estados febriles'],
  'resfriado-congestion': ['resfriado', 'congestión nasal', 'catarro', 'procesos catarrales'],
  'dolor-garganta': ['dolor de garganta', 'irritación de garganta', 'irritación de la garganta'],
  tos: ['tos', 'secreciones mucosas', 'secreciones bronquiales'],
  acidez: ['acidez', 'ardor de estómago', 'reflujo gastroesofágico'],
  diarrea: ['diarrea'],
  estrenimiento: ['estreñimiento'],
  'alergia-estacional': ['rinitis alérgica', 'rinoconjuntivitis alérgica'],
  picaduras: ['picaduras'],
  'quemadura-solar': ['quemaduras solares', 'quemadura solar'],
  'herpes-labial': ['herpes labial', 'herpes simple labial'],
  'dolor-muscular': ['dolor muscular', 'dolores musculares', 'contracturas', 'lumbalgia'],
  piojos: ['pediculosis', 'piojos'],
};
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const coincide = (contenido: string, termino: string) =>
  contenido.includes(` ${normalizar(termino)} `);

export function terminosCoincidentes(texto: string, id: IdConsulta): string[] {
  const contenido = ` ${normalizar(texto)} `;
  return TERMINOS_INDICACIONES[id].filter((t) => coincide(contenido, t));
}
export function mencionaDolencia(texto: string, id: IdConsulta): boolean {
  return terminosCoincidentes(texto, id).length > 0;
}
export function consultasDeIndicacion(texto: string): { id: IdConsulta; titulo: string }[] {
  const contenido = ` ${normalizar(texto)} `;
  return CONSULTAS_FRECUENTES.filter((c) =>
    TERMINOS_INDICACIONES[c.id].some((t) => coincide(contenido, t)),
  ).map((c) => ({ id: c.id, titulo: c.etiqueta }));
}
