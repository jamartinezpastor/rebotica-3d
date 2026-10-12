import { PasilloResponse, type ProductoResumen } from '@rebotica/shared';
import { useEffect, useState } from 'react';

export type EstadoPasillo =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; titulo: string; productos: ProductoResumen[] }
  | { tipo: 'error'; mensaje: string };

/**
 * Descarga un pasillo y lo valida con el contrato compartido. Los productos salen en el orden de
 * las baldas, que es el orden en que la escena los coloca.
 */
export function usePasillo(id: string): EstadoPasillo {
  const [estado, setEstado] = useState<{ id: string; valor: EstadoPasillo } | null>(null);

  useEffect(() => {
    const control = new AbortController();
    fetch(`/api/pasillos/${encodeURIComponent(id)}`, { signal: control.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        const pasillo = PasilloResponse.parse(await res.json());
        setEstado({
          id,
          valor: {
            tipo: 'listo',
            titulo: pasillo.titulo,
            productos: pasillo.baldas.flatMap((b) => b.productos),
          },
        });
      })
      .catch((err: unknown) => {
        if (control.signal.aborted) return;
        const mensaje = err instanceof Error ? err.message : 'No se pudo cargar el pasillo';
        setEstado({ id, valor: { tipo: 'error', mensaje } });
      });
    return () => control.abort();
  }, [id]);

  return estado?.id === id ? estado.valor : { tipo: 'cargando' };
}
