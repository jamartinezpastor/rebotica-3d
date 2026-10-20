import { LIMITE_CONSULTA } from '@rebotica/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';

interface SesionVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  processLocally: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((evento: unknown) => void) | null;
  onerror: ((evento: unknown) => void) | null;
  onnomatch: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface ConstructorVoz {
  new (): SesionVoz;
  available?(opciones: { langs: string[]; processLocally: boolean }): Promise<unknown>;
}
type VentanaVoz = Window & {
  SpeechRecognition?: ConstructorVoz;
  webkitSpeechRecognition?: ConstructorVoz;
};
const constructorVoz = () => {
  const w = window as VentanaVoz;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return window.isSecureContext && typeof Ctor?.available === 'function' ? Ctor : null;
};
const ListaResultados = z.object({ length: z.number().int().min(0).max(16) });
const EventoResultado = z.object({
  resultIndex: z.number().int().min(0).max(15),
  results: z.custom<SpeechRecognitionResultList>(
    (v) =>
      ListaResultados.safeParse({
        length: typeof v === 'object' && v !== null ? Reflect.get(v, 'length') : undefined,
      }).success,
  ),
});
const Resultado = z.object({
  isFinal: z.literal(true),
  texto: z.string().trim().min(1).max(LIMITE_CONSULTA),
});

function abortar(r: SesionVoz | null) {
  if (!r) return;
  r.onstart = r.onend = r.onresult = r.onerror = r.onnomatch = null;
  try {
    r.abort();
  } catch {
    /* Ya había terminado. */
  }
}

/** Solo dictado local, iniciado por un gesto explícito. Sin red propia, audio ni almacenamiento. */
export function useDictado(onTexto: (texto: string) => void) {
  const [disponibilidad, setDisponibilidad] = useState<
    'comprobando' | 'disponible' | 'noDisponible'
  >(() => (constructorVoz() ? 'comprobando' : 'noDisponible'));
  const [fase, setFase] = useState<'reposo' | 'iniciando' | 'escuchando' | 'finalizando'>('reposo');
  const [mensaje, setMensaje] = useState<string | null>(null);
  const constructor = useRef<ConstructorVoz | null>(null);
  const sesion = useRef<SesionVoz | null>(null);
  const cancelar = useCallback(() => {
    const r = sesion.current;
    sesion.current = null;
    abortar(r);
    setFase('reposo');
    setMensaje(null);
  }, []);

  useEffect(() => {
    const Ctor = constructorVoz();
    if (!Ctor?.available) return;
    let vigente = true;
    // No solicita micrófono ni instala paquetes. Solo comprueba el idioma local disponible.
    Promise.resolve()
      .then(() => Ctor.available!({ langs: ['es-ES'], processLocally: true }))
      .then((estado) => {
        if (!vigente) return;
        const r = new Ctor();
        const local = estado === 'available' && 'processLocally' in r;
        constructor.current = local ? Ctor : null;
        setDisponibilidad(local ? 'disponible' : 'noDisponible');
      })
      .catch(() => {
        if (vigente) setDisponibilidad('noDisponible');
      });
    const ocultar = () => {
      if (document.hidden) cancelar();
    };
    window.addEventListener('blur', cancelar);
    window.addEventListener('pagehide', cancelar);
    document.addEventListener('visibilitychange', ocultar);
    return () => {
      vigente = false;
      constructor.current = null;
      const r = sesion.current;
      sesion.current = null;
      abortar(r);
      window.removeEventListener('blur', cancelar);
      window.removeEventListener('pagehide', cancelar);
      document.removeEventListener('visibilitychange', ocultar);
    };
  }, [cancelar]);

  const empezar = () => {
    const Ctor = constructor.current;
    if (!Ctor || sesion.current) return;
    setMensaje(null);
    let r: SesionVoz;
    try {
      r = new Ctor();
      if (!('processLocally' in r)) throw new Error();
      r.processLocally = true;
      if (!r.processLocally) throw new Error();
    } catch {
      setMensaje('El dictado local no está disponible. Puedes escribir tu consulta.');
      return;
    }
    r.lang = 'es-ES';
    r.continuous = false;
    r.interimResults = false;
    r.maxAlternatives = 1;
    sesion.current = r;
    const recibidos = new Set<number>();
    const fallar = (texto: string) => {
      if (sesion.current !== r) return;
      sesion.current = null;
      abortar(r);
      setFase('reposo');
      setMensaje(texto);
    };
    r.onstart = () => {
      if (sesion.current === r) setFase('escuchando');
    };
    r.onresult = (evento) => {
      if (sesion.current !== r) return;
      const e = EventoResultado.safeParse(evento);
      if (!e.success) {
        fallar('No se ha podido completar el dictado. Revisa el texto o vuelve a intentarlo.');
        return;
      }
      for (let i = e.data.resultIndex; i < e.data.results.length; i++) {
        const resultado = e.data.results[i];
        if (resultado?.isFinal === false || recibidos.has(i)) continue;
        const analizado = Resultado.safeParse({
          isFinal: resultado?.isFinal,
          texto: resultado?.[0]?.transcript,
        });
        if (!analizado.success) {
          fallar(
            'No se ha añadido el dictado: no se ha reconocido texto válido o supera el límite. Puedes escribir o volver a dictar algo más breve.',
          );
          return;
        }
        recibidos.add(i);
        onTexto(analizado.data.texto);
      }
    };
    r.onnomatch = () =>
      fallar('No se han entendido las palabras. Puedes escribir o volver a dictar.');
    r.onerror = (evento) => {
      const e = z.object({ error: z.string() }).safeParse(evento);
      const permiso = e.success && ['not-allowed', 'service-not-allowed'].includes(e.data.error);
      fallar(
        permiso
          ? 'No se ha permitido el micrófono. Puedes escribir tu consulta.'
          : 'No se ha podido completar el dictado local. Puedes escribir o volver a intentarlo.',
      );
    };
    r.onend = () => {
      if (sesion.current !== r) return;
      sesion.current = null;
      setFase('reposo');
      if (recibidos.size === 0)
        setMensaje('No se ha reconocido ninguna palabra. Puedes escribir o volver a dictar.');
    };
    setFase('iniciando');
    try {
      r.start();
    } catch {
      fallar('No se ha podido iniciar el micrófono. Puedes escribir tu consulta.');
    }
  };
  const detener = () => {
    if (!sesion.current) return;
    setFase('finalizando');
    try {
      sesion.current.stop();
    } catch {
      cancelar();
    }
  };
  return { disponibilidad, fase, mensaje, empezar, detener, cancelar };
}
