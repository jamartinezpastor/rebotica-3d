import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CacheRecursos, type RecursoLiberable } from './cacheRecursos';
const ContextoRecursos = createContext<CacheRecursos | null>(null);
export function RecursosEscena({ children }: { children: ReactNode }) {
  const [cache] = useState(() => new CacheRecursos());
  useEffect(() => cache.iniciar(), [cache]);
  return <ContextoRecursos value={cache}>{children}</ContextoRecursos>;
}
export function useRecurso<T extends RecursoLiberable>(clave: string, crear: () => T): T {
  const cache = useContext(ContextoRecursos);
  if (!cache) throw new Error('Los recursos gráficos requieren RecursosEscena');
  const recurso = useMemo(() => cache.obtener(clave, crear), [cache, clave, crear]);
  useEffect(() => {
    cache.retener(clave);
    return () => cache.soltar(clave);
  }, [cache, clave]);
  return recurso;
}
