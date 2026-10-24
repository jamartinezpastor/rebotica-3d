import { ProductoResponse } from '@rebotica/shared';
import { useEffect, useState } from 'react';

export type EstadoFicha =
  | { tipo: 'cargando' }
  | { tipo: 'listo'; ficha: ProductoResponse }
  | { tipo: 'error'; noDisponible: boolean };

/**
 * Descarga y valida la ficha de un producto (GET /api/productos/:nregistro). La respuesta se
 * valida con el contrato compartido: lo que no cumple el esquema no se enseña.
 */
export function useFicha(nregistro: string): EstadoFicha {
  const [estado, setEstado] = useState<{ nregistro: string; valor: EstadoFicha } | null>(null);

  useEffect(() => {
    const control = new AbortController();
    fetch(`/api/productos/${encodeURIComponent(nregistro)}`, { signal: control.signal })
      .then(async (res) => {
        if (res.status === 404) {
          setEstado({ nregistro, valor: { tipo: 'error', noDisponible: true } });
          return;
        }
        if (!res.ok) throw new Error(`El servidor respondió ${res.status}`);
        const ficha = ProductoResponse.parse(await res.json());
        if (ficha.nregistro !== nregistro)
          throw new Error('La ficha no corresponde al registro solicitado');
        setEstado({ nregistro, valor: { tipo: 'listo', ficha } });
      })
      .catch(() => {
        if (control.signal.aborted) return;
        setEstado({ nregistro, valor: { tipo: 'error', noDisponible: false } });
      });
    return () => control.abort();
  }, [nregistro]);

  return estado?.nregistro === nregistro ? estado.valor : { tipo: 'cargando' };
}
