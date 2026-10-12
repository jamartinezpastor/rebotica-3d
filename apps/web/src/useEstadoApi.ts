import { HealthResponse } from '@rebotica/shared';
import { useEffect, useState } from 'react';

export type EstadoApi = { tipo: 'cargando' } | { tipo: 'ok'; version: string } | { tipo: 'caida' };

/** Comprueba GET /api/health una vez al montar. */
export function useEstadoApi(): EstadoApi {
  const [estado, setEstado] = useState<EstadoApi>({ tipo: 'cargando' });

  useEffect(() => {
    const control = new AbortController();
    fetch('/api/health', { signal: control.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: unknown) => {
        const salud = HealthResponse.parse(json);
        setEstado({ tipo: 'ok', version: salud.version });
      })
      .catch(() => {
        if (!control.signal.aborted) setEstado({ tipo: 'caida' });
      });
    return () => control.abort();
  }, []);

  return estado;
}
