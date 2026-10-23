import { useSyncExternalStore } from 'react';

const consulta = '(prefers-reduced-motion: reduce)';
const actual = () => typeof window.matchMedia === 'function' && window.matchMedia(consulta).matches;
const escuchar = (avisar: () => void) => {
  if (typeof window.matchMedia !== 'function') return () => {};
  const medio = window.matchMedia(consulta);
  medio.addEventListener('change', avisar);
  return () => medio.removeEventListener('change', avisar);
};

/** Sigue también los cambios de preferencia mientras el pasillo permanece abierto. */
export function useMenosMovimiento() {
  return useSyncExternalStore(escuchar, actual, () => false);
}
