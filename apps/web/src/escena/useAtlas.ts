import { useThree } from '@react-three/fiber';
import { useEffect, useState } from 'react';
import { SRGBColorSpace, type Texture, type WebGLRenderer } from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

// Un cargador por renderer y una promesa por atlas: varias cajas comparten la misma textura.
const cargadores = new WeakMap<WebGLRenderer, KTX2Loader>();
const texturas = new Map<string, Promise<Texture>>();

function cargadorDe(gl: WebGLRenderer): KTX2Loader {
  let cargador = cargadores.get(gl);
  if (!cargador) {
    cargador = new KTX2Loader()
      .setTranscoderPath(`${import.meta.env.BASE_URL}basis/`)
      .detectSupport(gl);
    cargadores.set(gl, cargador);
  }
  return cargador;
}

/**
 * Textura de un atlas KTX2 (null mientras carga o si falla: la caja se ve con su color).
 * La escena se dibuja bajo demanda, así que al llegar la textura se pide un fotograma.
 */
export function useAtlas(url: string | null | undefined): Texture | null {
  const gl = useThree((s) => s.gl);
  const invalidar = useThree((s) => s.invalidate);
  // Se guarda junto a su URL: si la URL cambia, la textura anterior deja de valer sin tocar el estado.
  const [cargada, setCargada] = useState<{ url: string; textura: Texture } | null>(null);

  useEffect(() => {
    if (!url) return;
    let activo = true;
    let promesa = texturas.get(url);
    if (!promesa) {
      promesa = cargadorDe(gl)
        .loadAsync(url)
        .then((t) => {
          t.colorSpace = SRGBColorSpace;
          return t;
        });
      texturas.set(url, promesa);
      // Un fallo no se queda en caché: se reintentará la próxima vez.
      promesa.catch(() => texturas.delete(url));
    }
    promesa.then(
      (textura) => {
        if (!activo) return;
        setCargada({ url, textura });
        invalidar();
      },
      (err: unknown) => {
        // La caja sigue visible con su color lateral; el motivo queda en la consola.
        console.warn(`No se pudo cargar el atlas ${url}`, err);
      },
    );
    return () => {
      activo = false;
    };
  }, [url, gl, invalidar]);

  return url && cargada?.url === url ? cargada.textura : null;
}
