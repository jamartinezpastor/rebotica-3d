import { PasilloResponse } from '@rebotica/shared';
import { useEffect, useState } from 'react';
import type { BaldaEscena } from './Pasillo';

export type EstadoPasillo =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; titulo: string; estado: PasilloResponse['estado']; baldas: BaldaEscena[] }
  | { tipo: 'error'; mensaje: string };

export function pasilloAEscena(
  pasillo: PasilloResponse,
): Extract<EstadoPasillo, { tipo: 'listo' }> {
  return {
    tipo: 'listo',
    titulo: pasillo.titulo,
    estado: pasillo.estado,
    baldas: [
      ...pasillo.baldas.map((b) => ({ titulo: b.titulo, productos: b.productos })),
      ...pasillo.vitrina.map((g) => ({
        titulo: g.principioActivo,
        productos: g.productos,
        receta: true,
        descripcion: [g.paraQueSeUsa, g.porQueNecesitaReceta, g.situacion].join(' '),
      })),
    ],
  };
}

/**
 * Descarga un pasillo y lo valida con el contrato compartido. Las baldas conservan el orden del
 * protocolo, que es el orden en que la escena las coloca.
 */
export function usePasillo(id: string | null, general = false): EstadoPasillo {
  const [estado, setEstado] = useState<{ id: string; valor: EstadoPasillo } | null>(null);

  useEffect(() => {
    if (id === null && !general) return;
    const clave = general ? 'catalogo' : id!;
    const control = new AbortController();
    fetch(general ? '/api/catalogo' : `/api/pasillos/${encodeURIComponent(id!)}`, {
      signal: control.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        const pasillo = PasilloResponse.parse(await res.json());
        setEstado({
          id: clave,
          valor: pasilloAEscena(pasillo),
        });
      })
      .catch((err: unknown) => {
        if (control.signal.aborted) return;
        const mensaje = err instanceof Error ? err.message : 'No se pudo cargar el pasillo';
        setEstado({ id: clave, valor: { tipo: 'error', mensaje } });
      });
    return () => control.abort();
  }, [id, general]);

  return estado?.id === (general ? 'catalogo' : id) ? estado.valor : { tipo: 'cargando' };
}
