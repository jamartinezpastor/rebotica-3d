import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { FormaCaja, ProductoResumen } from '@rebotica/shared';
import { datosEnvase } from './arteEnvase';
import { claveEnvase, precargarEnvase } from './Caja';
import { useCacheRecursos } from './RecursosEscena';
import { bytesEnvase, planPrecarga, presupuestoPrecarga, programarPrecarga } from './planPrecarga';

interface EstanteriaPrecargable {
  indice: number;
  cajas: { forma: FormaCaja; item: ProductoResumen }[];
}

/** Prepara las cercanas primero y el resto en reposo, mientras que solo las cercanas se dibujan. */
export function usePrecargaEstanterias(
  modelo: readonly EstanteriaPrecargable[],
  centro: number,
  ligera: boolean,
  pausada: boolean,
) {
  const cache = useCacheRecursos();
  const gl = useThree((s) => s.gl);
  const actividad = useRef({ hasta: 0, tocando: false, x: NaN, y: NaN });
  useFrame(({ camera }, delta) => {
    const a = actividad.current;
    if (a.x !== camera.position.x || a.y !== camera.position.y || (delta > 0.025 && delta < 0.25))
      a.hasta = performance.now() + 350;
    a.x = camera.position.x;
    a.y = camera.position.y;
  });
  const calidad = ligera ? 'ligera' : 'estanteria';
  const envases = useMemo(
    () =>
      modelo.flatMap((est) =>
        est.cajas.map((c) => {
          const datos = datosEnvase(c.item);
          return {
            estanteria: est.indice,
            forma: c.forma,
            datos,
            clave: claveEnvase(c.forma, datos, calidad),
            bytes: bytesEnvase(c.forma, calidad),
          };
        }),
      ),
    [modelo, calidad],
  );
  const presupuesto = useMemo(
    () => presupuestoPrecarga((navigator as Navigator & { deviceMemory?: number }).deviceMemory),
    [],
  );
  const plan = useMemo(
    () => planPrecarga(envases, centro, presupuesto),
    [envases, centro, presupuesto],
  );
  // La reserva sobrevive a los desplazamientos; se libera al cambiar de catálogo/calidad o salir.
  const reservas = useRef(new Map<string, () => void>());
  useEffect(() => {
    const actuales = reservas.current;
    return () => {
      actuales.forEach((soltar) => soltar());
      actuales.clear();
    };
  }, [envases, cache]);
  useEffect(() => {
    const el = gl.domElement;
    const punteros = new Set<number>();
    const tocar = (e: PointerEvent) => {
      punteros.add(e.pointerId);
      actividad.current.tocando = true;
    };
    const soltar = (e: PointerEvent) => {
      punteros.delete(e.pointerId);
      actividad.current.tocando = punteros.size > 0;
      actividad.current.hasta = performance.now() + 350;
    };
    const mover = () => {
      actividad.current.hasta = performance.now() + 350;
    };
    const desenfocar = () => {
      punteros.clear();
      actividad.current.tocando = false;
    };
    el.addEventListener('pointerdown', tocar);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', soltar);
    window.addEventListener('blur', desenfocar);
    el.addEventListener('wheel', mover, { passive: true });
    el.addEventListener('keydown', mover);
    return () => {
      el.removeEventListener('pointerdown', tocar);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', soltar);
      window.removeEventListener('blur', desenfocar);
      el.removeEventListener('wheel', mover);
      el.removeEventListener('keydown', mover);
    };
  }, [gl]);
  useEffect(() => {
    const actuales = reservas.current;
    const permitidas = new Set(plan.map((e) => e.clave));
    for (const [clave, soltar] of actuales)
      if (!permitidas.has(clave)) {
        soltar();
        actuales.delete(clave);
      }
    if (pausada) return;
    const cola = plan.filter((e) => !actuales.has(e.clave));
    let siguiente = 0;
    return programarPrecarga(
      () => {
        const e = cola[siguiente++];
        if (!e) return false;
        try {
          actuales.set(e.clave, precargarEnvase(cache, gl, e.forma, e.datos, calidad));
        } catch {
          // Un fallo de precarga no bloquea la preparación normal al acercarse.
        }
        return siguiente < cola.length;
      },
      () =>
        document.hidden || actividad.current.tocando || performance.now() < actividad.current.hasta,
      {
        programar: (trabajo) => {
          const id = window.setTimeout(trabajo, 80);
          return () => window.clearTimeout(id);
        },
        reposo: (trabajo) => {
          if (typeof window.requestIdleCallback === 'function') {
            const id = window.requestIdleCallback(trabajo);
            return () => window.cancelIdleCallback(id);
          }
          const id = window.setTimeout(trabajo, 40);
          return () => window.clearTimeout(id);
        },
      },
    );
  }, [plan, cache, gl, calidad, pausada]);
}
