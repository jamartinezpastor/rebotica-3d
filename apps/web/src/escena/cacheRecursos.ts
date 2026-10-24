export interface RecursoLiberable {
  liberar(): void;
}
/** Cada escena es dueña de su caché; las referencias compartidas se liberan tras el último uso. */
export class CacheRecursos {
  private ciclo = 0;
  iniciar(): () => void {
    const actual = ++this.ciclo;
    return () =>
      queueMicrotask(() => {
        if (this.ciclo === actual) this.liberar();
      });
  }
  private entradas = new Map<string, { recurso: RecursoLiberable; usuarios: number }>();
  obtener<T extends RecursoLiberable>(clave: string, crear: () => T): T {
    let entrada = this.entradas.get(clave);
    if (!entrada) {
      entrada = { recurso: crear(), usuarios: 0 };
      this.entradas.set(clave, entrada);
    }
    return entrada.recurso as T;
  }
  retener(clave: string): void {
    const entrada = this.entradas.get(clave);
    if (entrada) entrada.usuarios++;
  }
  soltar(clave: string): void {
    const entrada = this.entradas.get(clave);
    if (!entrada) return;
    entrada.usuarios = Math.max(0, entrada.usuarios - 1);
    // El segundo montaje de StrictMode puede recuperar el recurso antes de liberar la GPU.
    queueMicrotask(() => {
      if (entrada.usuarios === 0 && this.entradas.get(clave) === entrada) {
        this.entradas.delete(clave);
        entrada.recurso.liberar();
      }
    });
  }
  liberar(): void {
    for (const entrada of this.entradas.values()) entrada.recurso.liberar();
    this.entradas.clear();
  }
}
