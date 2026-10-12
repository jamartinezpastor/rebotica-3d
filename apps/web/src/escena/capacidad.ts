/**
 * Detección de la capacidad gráfica del dispositivo (plan §Rendimiento): en equipos que no
 * pueden con el 3D se ofrece la vista lista, con el mismo contenido y la misma acción.
 */

export interface InfoDispositivo {
  /** Hay un contexto WebGL utilizable sin penalización de rendimiento importante. */
  webgl: boolean;
  /** Cadena del renderizador (WEBGL_debug_renderer_info), si el navegador la expone. */
  renderer?: string;
  /** `navigator.deviceMemory` en GB (valores acotados: 0,25 a 8). */
  memoriaGB?: number;
  /** `navigator.hardwareConcurrency`. */
  nucleos?: number;
  /** El usuario ha pedido ahorrar datos. */
  ahorroDatos?: boolean;
}

export type NivelCapacidad = 'alto' | 'bajo' | 'sin3d';

export interface Capacidad {
  nivel: NivelCapacidad;
  motivos: string[];
}

/** Renderizadores por software: funcionan, pero no a 60 fps. */
const POR_SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render|microsoft basic/i;
/** GPU móviles de hace una década: sin potencia para ~40 cajas con texturas. */
const GPU_ANTIGUA =
  /mali-(4\d\d|t[67]\d\d)|adreno \(tm\) [2-3]\d\d|adreno 3\d\d|powervr sgx|vivante|tegra [234]/i;

export function evaluarCapacidad(info: InfoDispositivo): Capacidad {
  if (!info.webgl) {
    return { nivel: 'sin3d', motivos: ['El navegador no ofrece WebGL utilizable'] };
  }
  const motivos: string[] = [];
  if (info.renderer && POR_SOFTWARE.test(info.renderer)) {
    motivos.push('Renderizado por software');
  }
  if (info.renderer && GPU_ANTIGUA.test(info.renderer)) {
    motivos.push('GPU antigua');
  }
  if (info.memoriaGB !== undefined && info.memoriaGB <= 2) {
    motivos.push('Poca memoria');
  }
  if (info.nucleos !== undefined && info.nucleos <= 2) {
    motivos.push('Pocos núcleos');
  }
  if (info.ahorroDatos) {
    motivos.push('Ahorro de datos activado');
  }
  return { nivel: motivos.length > 0 ? 'bajo' : 'alto', motivos };
}

interface NavegadorExtendido {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean };
}

/** Sondea el navegador. Crea y descarta un lienzo: hacerlo una vez y guardar el resultado. */
export function detectarDispositivo(): InfoDispositivo {
  const nav = (typeof navigator === 'undefined' ? {} : navigator) as NavegadorExtendido;
  const comun = {
    memoriaGB: nav.deviceMemory,
    nucleos: nav.hardwareConcurrency,
    ahorroDatos: nav.connection?.saveData === true,
  };
  if (typeof document === 'undefined') return { webgl: false, ...comun };
  try {
    const lienzo = document.createElement('canvas');
    // `failIfMajorPerformanceCaveat`: los navegadores rechazan el contexto si fuera por software.
    const gl =
      (lienzo.getContext('webgl2', {
        failIfMajorPerformanceCaveat: true,
      }) as WebGL2RenderingContext | null) ??
      (lienzo.getContext('webgl', {
        failIfMajorPerformanceCaveat: true,
      }) as WebGLRenderingContext | null);
    if (!gl) {
      // Puede que exista un contexto lento: se distingue para etiquetarlo como «bajo».
      const lento =
        lienzo.getContext('webgl2') ?? (lienzo.getContext('webgl') as WebGLRenderingContext | null);
      if (!lento) return { webgl: false, ...comun };
      return { webgl: true, renderer: 'Renderizado por software', ...comun };
    }
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : undefined;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { webgl: true, renderer, ...comun };
  } catch {
    return { webgl: false, ...comun };
  }
}

export type VistaElegida = '3d' | 'lista';

/**
 * Vista inicial: la que pide la URL (`?vista=`), si no la preferencia guardada y, si tampoco hay,
 * la que recomienda la capacidad del dispositivo.
 */
export function vistaInicial(
  parametro: string | null,
  guardada: string | null,
  capacidad: Capacidad,
): VistaElegida {
  for (const valor of [parametro, guardada]) {
    if (valor === '3d' && capacidad.nivel !== 'sin3d') return '3d';
    if (valor === 'lista') return 'lista';
  }
  return capacidad.nivel === 'alto' ? '3d' : 'lista';
}
