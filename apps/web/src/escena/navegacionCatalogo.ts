import type { BaldaEscena } from './Pasillo';

/** Solo identidad de producto, en memoria. No guarda búsquedas ni perfiles en URL o storage. */
export function indiceDeRegistro(baldas: readonly BaldaEscena[], registro: string | null) {
  return registro
    ? baldas.flatMap((b) => b.productos).findIndex((p) => p.nregistro === registro)
    : -1;
}
export function registroVisible(raiz: HTMLElement | null, limiteSuperior = 0): string | null {
  const controles = Array.from(raiz?.querySelectorAll<HTMLElement>('[data-registro]') ?? []);
  return (
    controles.find((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom > limiteSuperior && r.top < window.innerHeight;
    })?.dataset.registro ?? null
  );
}
export interface RetornoLista {
  registro: string | null;
  scrollY?: number;
}

export function destinosGrupos(baldas: readonly BaldaEscena[]) {
  const vistos = new Set<string>();
  return baldas.flatMap((b) => {
    const titulo = b.grupo ?? b.titulo;
    const clave = `${!!b.receta}:${titulo}`;
    const registro = b.productos[0]?.nregistro;
    if (!registro || vistos.has(clave)) return [];
    vistos.add(clave);
    return [{ registro, texto: `${b.receta ? 'Con receta · ' : ''}${titulo}` }];
  });
}
