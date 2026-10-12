import type { ZodType } from 'zod';

export interface OpcionesCliente {
  fetch?: typeof fetch;
  /** Separación mínima entre peticiones; límite propio y conservador (CIMA no publica uno). */
  intervaloMs?: number;
  /** Reintentos tras el primer intento ante 429, 5xx o error de red. */
  maxReintentos?: number;
  /** Espera inicial; se duplica en cada reintento hasta `esperaMaxMs`. */
  esperaBaseMs?: number;
  esperaMaxMs?: number;
  timeoutMs?: number;
  esperar?: (ms: number) => Promise<void>;
}

export class ErrorCima extends Error {
  constructor(
    mensaje: string,
    readonly url: string,
    readonly estado?: number,
  ) {
    super(mensaje);
    this.name = 'ErrorCima';
  }
}

const dormir = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface ClienteCima {
  /** Devuelve el JSON validado, o `null` si CIMA responde 204 o 404. */
  obtener<T>(url: URL, esquema: ZodType<T>): Promise<T | null>;
  /** Descarga un archivo (foto); `null` si CIMA responde 204 o 404. */
  obtenerBinario(url: URL): Promise<Uint8Array | null>;
  /** Peticiones HTTP realizadas, reintentos incluidos. */
  readonly peticiones: number;
}

export function crearClienteCima(opciones: OpcionesCliente = {}): ClienteCima {
  const {
    fetch: fetchImpl = fetch,
    intervaloMs = 250,
    maxReintentos = 5,
    esperaBaseMs = 1000,
    esperaMaxMs = 30_000,
    timeoutMs = 30_000,
    esperar = dormir,
  } = opciones;

  let siguiente = 0;
  let peticiones = 0;

  // Reserva sincrónica del turno: también limita el ritmo si alguien llama en paralelo.
  async function turno(): Promise<void> {
    const t = Math.max(Date.now(), siguiente);
    siguiente = t + intervaloMs;
    const demora = t - Date.now();
    if (demora > 0) await esperar(demora);
  }

  function esperaReintento(intento: number, retryAfter: string | null): number {
    const segundos = Number(retryAfter);
    if (retryAfter && Number.isFinite(segundos) && segundos >= 0) {
      return Math.min(segundos * 1000, esperaMaxMs);
    }
    return Math.min(esperaBaseMs * 2 ** intento, esperaMaxMs);
  }

  /** Petición con límite de ritmo y reintentos; `null` ante 404 y 204. */
  async function pedir(url: URL, accept: string): Promise<Response | null> {
    for (let intento = 0; ; intento++) {
      await turno();
      peticiones++;
      let respuesta: Response;
      try {
        respuesta = await fetchImpl(url, {
          headers: { Accept: accept },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        if (intento >= maxReintentos) {
          throw new ErrorCima(`Sin respuesta de CIMA: ${String(err)}`, url.toString());
        }
        await esperar(esperaReintento(intento, null));
        continue;
      }

      if (respuesta.status === 404 || respuesta.status === 204) return null;

      if (respuesta.status === 429 || respuesta.status >= 500) {
        if (intento >= maxReintentos) {
          throw new ErrorCima(
            `CIMA respondió ${respuesta.status} tras ${intento + 1} intentos`,
            url.toString(),
            respuesta.status,
          );
        }
        await esperar(esperaReintento(intento, respuesta.headers.get('retry-after')));
        continue;
      }

      if (!respuesta.ok) {
        throw new ErrorCima(`CIMA respondió ${respuesta.status}`, url.toString(), respuesta.status);
      }

      return respuesta;
    }
  }

  async function obtener<T>(url: URL, esquema: ZodType<T>): Promise<T | null> {
    const respuesta = await pedir(url, 'application/json');
    if (!respuesta) return null;
    const texto = await respuesta.text();
    if (texto.trim() === '') return null;
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      throw new ErrorCima('Respuesta de CIMA que no es JSON', url.toString(), respuesta.status);
    }
    const analizado = esquema.safeParse(json);
    if (!analizado.success) {
      throw new ErrorCima(
        `Respuesta de CIMA con forma inesperada: ${analizado.error.message}`,
        url.toString(),
        respuesta.status,
      );
    }
    return analizado.data;
  }

  async function obtenerBinario(url: URL): Promise<Uint8Array | null> {
    const respuesta = await pedir(url, 'image/*');
    if (!respuesta) return null;
    const bytes = new Uint8Array(await respuesta.arrayBuffer());
    return bytes.length > 0 ? bytes : null;
  }

  return {
    obtener,
    obtenerBinario,
    get peticiones() {
      return peticiones;
    },
  };
}
