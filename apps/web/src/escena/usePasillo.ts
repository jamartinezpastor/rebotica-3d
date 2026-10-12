import { PasilloResponse } from '@rebotica/shared';
import { useEffect, useState } from 'react';
import type { BaldaEscena } from './Pasillo';

export type EstadoPasillo =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; titulo: string; baldas: BaldaEscena[] }
  | { tipo: 'error'; mensaje: string };

/**
 * Descarga un pasillo y lo valida con el contrato compartido. Las baldas conservan el orden del
 * protocolo, que es el orden en que la escena las coloca.
 */
export function usePasillo(id: string | null): EstadoPasillo {
  const [estado, setEstado] = useState<{ id: string; valor: EstadoPasillo } | null>(null);

  useEffect(() => {
    if (id === null) return;
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
            baldas: pasillo.baldas.map((b) => ({ titulo: b.titulo, productos: b.productos })),
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

  return id !== null && estado?.id === id ? estado.valor : { tipo: 'cargando' };
}
