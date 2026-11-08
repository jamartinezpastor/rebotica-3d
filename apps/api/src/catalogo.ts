import { ReglaDosis } from '@rebotica/dosis';
import {
  assetCaja,
  grupoReceta,
  medicamento,
  presentacion,
  protocolo as tablaProtocolo,
  reglaDosis,
  seccionFt,
  type Db,
} from '@rebotica/db';
import {
  formaCajaDesde,
  grupoAtc,
  InformacionCima,
  type AssetCajaPublico,
  type ProductoResponse,
  type ProductoResumen,
} from '@rebotica/shared';
import { and, asc, desc, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { claveActivo } from './activos';
import { Protocolo } from '@rebotica/protocolos';

/** Cualquier base PostgreSQL de Drizzle (node-postgres en producción, PGlite en los tests). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseDatos = PgDatabase<any, any>;

interface OpcionesCatalogo {
  /** Los datos cambian una vez al día; un minuto de caché evita recorrer el catálogo por petición. */
  ttlMs?: number;
}

interface Indice {
  porClave: Map<string, ProductoResumen[]>;
}

export class CatalogoNoSincronizado extends Error {}

const esGenerico = (nombre: string) => /\bEFG\b/i.test(nombre);

/** Aspecto de la caja a partir de la fila de `asset_caja`; null si el producto no tiene. */
function aspectoDe(
  colorDominante: string | null | undefined,
  paleta: string[] | null | undefined,
  foto: string | null | undefined,
): AssetCajaPublico | null {
  if (!colorDominante) return null;
  const colores = paleta && paleta.length > 0 ? paleta.slice(0, 4) : [colorDominante];
  return { colorDominante, paleta: colores, foto: foto ?? null };
}

/**
 * Catálogo local comercializado. Las baldas y la vitrina se consultan por separado.
 */
export function crearCatalogo(db: BaseDatos, { ttlMs = 60_000 }: OpcionesCatalogo = {}) {
  const conexion = db as unknown as Db;
  let indice: { hasta: number; datos: Promise<Indice> } | null = null;
  let formas: { hasta: number; datos: Promise<Map<string, string[]>> } | null = null;

  /** Reglas validadas cuya sección 4.2 sigue siendo la que se transcribió. */
  async function reglasVigentes(nregistro?: string): Promise<Map<string, ReglaDosis>> {
    const filas = await conexion
      .select({
        nregistro: reglaDosis.nregistro,
        json: reglaDosis.json,
        version: reglaDosis.version,
        hashSeccion: reglaDosis.hashSeccion,
      })
      .from(reglaDosis)
      .innerJoin(
        seccionFt,
        and(
          eq(seccionFt.nregistro, reglaDosis.nregistro),
          eq(seccionFt.seccion, '4.2'),
          eq(seccionFt.hash, reglaDosis.hashSeccion),
        ),
      )
      .innerJoin(medicamento, eq(medicamento.nregistro, reglaDosis.nregistro))
      .where(
        and(
          eq(reglaDosis.estado, 'validada'),
          nregistro ? eq(reglaDosis.nregistro, nregistro) : undefined,
        ),
      )
      .orderBy(asc(reglaDosis.version));
    const reglas = new Map<string, ReglaDosis>();
    for (const f of filas) {
      const analizada = ReglaDosis.safeParse(f.json);
      // Una regla que no cumple el esquema o cuyo JSON no está validado no activa la calculadora.
      if (
        analizada.success &&
        analizada.data.estado === 'validada' &&
        analizada.data.fuente.nregistro === f.nregistro &&
        analizada.data.fuente.hashSeccion === f.hashSeccion &&
        analizada.data.version === f.version
      ) {
        reglas.set(f.nregistro, analizada.data);
      } else {
        reglas.delete(f.nregistro);
      }
    }
    return reglas;
  }

  async function construirIndice(): Promise<Indice> {
    const filas = await conexion
      .select({
        nregistro: medicamento.nregistro,
        receta: medicamento.receta,
        nombre: medicamento.nombre,
        pactivos: medicamento.pactivos,
        forma: medicamento.forma,
        dosis: medicamento.dosis,
        conduc: medicamento.conduc,
        labtitular: medicamento.labtitular,
        categoria: medicamento.categoria,
        atcs: medicamento.atcs,
        colorDominante: assetCaja.colorDominante,
        paleta: assetCaja.paleta,
        foto: assetCaja.foto,
      })
      .from(medicamento)
      .leftJoin(assetCaja, eq(assetCaja.nregistro, medicamento.nregistro))
      .where(eq(medicamento.comerc, true))
      .orderBy(asc(medicamento.nombre), asc(medicamento.nregistro));
    const reglas = await reglasVigentes();

    const filasProtocolos = await conexion
      .select()
      .from(tablaProtocolo)
      .where(eq(tablaProtocolo.estado, 'validada'))
      .orderBy(asc(tablaProtocolo.id), asc(tablaProtocolo.version));
    const protocolos = new Map<string, Protocolo>();
    for (const fila of filasProtocolos) {
      const p = Protocolo.safeParse(fila.json);
      if (
        p.success &&
        p.data.estado === 'validado' &&
        fila.validadoPor &&
        fila.validadoEn &&
        p.data.id === fila.id &&
        p.data.version === fila.version
      ) {
        protocolos.set(p.data.id, p.data);
      }
    }

    const porClave = new Map<string, ProductoResumen[]>();
    for (const f of filas) {
      const regla = reglas.get(f.nregistro);
      const edades = regla?.tramos.map((t) => t.edadMinMeses).filter((edad) => edad < 216) ?? [];
      const clave = claveActivo(f.pactivos);
      const consultas = [...protocolos.values()]
        .filter((p) =>
          (f.receta ? p.vitrina : p.baldas).some((b) => claveActivo(b.principioActivo) === clave),
        )
        .map((p) => ({ id: p.id, titulo: p.titulo }));
      const asset = aspectoDe(f.colorDominante, f.paleta, f.foto);
      const producto: ProductoResumen = {
        clasificacion: {
          edadMinPediatricaMeses: edades.length ? Math.min(...edades) : null,
          consultas,
        },
        receta: f.receta,
        nregistro: f.nregistro,
        nombre: f.nombre,
        principioActivo: f.pactivos,
        forma: f.forma,
        formaCaja: formaCajaDesde(f.forma),
        dosis: f.dosis,
        categoria: f.categoria ?? grupoAtc(f.atcs),
        laboratorio: f.labtitular,
        generico: esGenerico(f.nombre),
        conduccion: f.conduc,
        asset,
        calculadora: reglas.has(f.nregistro),
      };
      const lista = porClave.get(clave) ?? [];
      lista.push(producto);
      porClave.set(clave, lista);
    }
    return { porClave };
  }

  async function obtenerIndice(): Promise<Indice> {
    const ahora = Date.now();
    if (!indice || indice.hasta < ahora) {
      const datos = construirIndice();
      indice = { hasta: ahora + ttlMs, datos };
      // Un fallo no se queda en caché.
      datos.catch(() => {
        if (indice?.datos === datos) indice = null;
      });
    }
    return indice.datos;
  }

  async function obtenerFormas(): Promise<Map<string, string[]>> {
    const ahora = Date.now();
    if (!formas || formas.hasta < ahora) {
      const datos = (async () => {
        const filas = await conexion
          .select({ pactivo: grupoReceta.pactivo, forma: grupoReceta.forma })
          .from(grupoReceta)
          .orderBy(asc(grupoReceta.forma));
        const mapa = new Map<string, string[]>();
        for (const f of filas) {
          const clave = claveActivo(f.pactivo);
          const lista = mapa.get(clave) ?? [];
          if (!lista.includes(f.forma)) lista.push(f.forma);
          mapa.set(clave, lista);
        }
        return mapa;
      })();
      formas = { hasta: ahora + ttlMs, datos };
      datos.catch(() => {
        if (formas?.datos === datos) formas = null;
      });
    }
    return formas.datos;
  }

  return {
    /** Catálogo general: incluye también productos cuya ficha no está segmentada en CIMA. */
    async todos(
      clasificar: (texto: string) => NonNullable<ProductoResumen['clasificacion']>['consultas'],
    ): Promise<ProductoResumen[]> {
      const [indice, secciones] = await Promise.all([
        obtenerIndice(),
        conexion
          .select({ nregistro: seccionFt.nregistro, texto: seccionFt.texto })
          .from(seccionFt)
          .where(eq(seccionFt.seccion, '4.1')),
      ]);
      const indicaciones = new Map(secciones.map((s) => [s.nregistro, s.texto]));
      return [...indice.porClave.values()].flat().map((p) => ({
        ...p,
        clasificacion: {
          edadMinPediatricaMeses: p.clasificacion?.edadMinPediatricaMeses ?? null,
          consultas: clasificar(indicaciones.get(p.nregistro) ?? ''),
        },
      }));
    },

    /** Búsqueda documental local: solo sección 4.1 de productos comercializados. */
    async buscarIndicaciones(
      coincide: (texto: string) => boolean,
      clasificar?: (texto: string) => NonNullable<ProductoResumen['clasificacion']>['consultas'],
    ): Promise<ProductoResumen[]> {
      const [indiceActual, secciones] = await Promise.all([
        obtenerIndice(),
        conexion
          .select({ nregistro: seccionFt.nregistro, texto: seccionFt.texto })
          .from(seccionFt)
          .where(eq(seccionFt.seccion, '4.1')),
      ]);
      const productos = [...indiceActual.porClave.values()].flat();
      const indicaciones = secciones.filter((s) => s.texto.trim());
      const disponibles = new Set(indicaciones.map((s) => s.nregistro));
      if (!productos.some((p) => disponibles.has(p.nregistro))) {
        // No conservar durante un minuto el índice vacío de una carga que acaba de arrancar.
        indice = null;
        throw new CatalogoNoSincronizado();
      }
      const registros = new Map(
        indicaciones.filter((s) => coincide(s.texto)).map((s) => [s.nregistro, s.texto]),
      );
      return productos
        .filter((p) => registros.has(p.nregistro))
        .map((p) =>
          clasificar
            ? {
                ...p,
                clasificacion: {
                  edadMinPediatricaMeses: p.clasificacion?.edadMinPediatricaMeses ?? null,
                  consultas: clasificar(registros.get(p.nregistro)!),
                },
              }
            : p,
        );
    },

    /** Productos de un principio activo (o asociación), separados por condición de prescripción. */
    async productosDe(principioActivo: string, receta = false): Promise<ProductoResumen[]> {
      const { porClave } = await obtenerIndice();
      return (porClave.get(claveActivo(principioActivo)) ?? []).filter((p) => p.receta === receta);
    },

    /** Formas farmacéuticas con receta de un principio activo, para la vitrina. */
    async formasConReceta(principioActivo: string): Promise<string[]> {
      return (await obtenerFormas()).get(claveActivo(principioActivo)) ?? [];
    },

    /** Ficha de un medicamento comercializado, con su condición de prescripción. */
    async ficha(nregistro: string): Promise<ProductoResponse | null> {
      const [m] = await conexion
        .select()
        .from(medicamento)
        .where(eq(medicamento.nregistro, nregistro));
      if (!m || !m.comerc) return null;

      const [asset] = await conexion
        .select()
        .from(assetCaja)
        .where(eq(assetCaja.nregistro, nregistro));
      const presentaciones = await conexion
        .select()
        .from(presentacion)
        .where(and(eq(presentacion.nregistro, nregistro), eq(presentacion.comerc, true)))
        .orderBy(asc(presentacion.cn));
      const secciones = await conexion
        .select()
        .from(seccionFt)
        .where(eq(seccionFt.nregistro, nregistro))
        .orderBy(asc(seccionFt.seccion));
      const regla = (await reglasVigentes(nregistro)).get(nregistro) ?? null;
      let borradorDosis: ProductoResponse['borradorDosis'] = null;
      if (!regla) {
        const borradores = await conexion
          .select()
          .from(reglaDosis)
          .where(and(eq(reglaDosis.nregistro, nregistro), eq(reglaDosis.estado, 'borrador')))
          .orderBy(desc(reglaDosis.version));
        for (const fila of borradores) {
          const r = ReglaDosis.safeParse(fila.json);
          if (
            r.success &&
            r.data.estado === 'borrador' &&
            r.data.version === fila.version &&
            r.data.fuente.nregistro === nregistro &&
            r.data.fuente.hashSeccion === fila.hashSeccion
          ) {
            borradorDosis = { id: r.data.id, version: r.data.version };
            break;
          }
        }
      }

      const id = encodeURIComponent(nregistro);
      return {
        receta: m.receta,
        nregistro: m.nregistro,
        nombre: m.nombre,
        principioActivo: m.pactivos,
        laboratorio: m.labtitular,
        categoria: m.categoria ?? grupoAtc(m.atcs),
        forma: m.forma,
        formaCaja: formaCajaDesde(m.forma),
        dosis: m.dosis,
        generico: esGenerico(m.nombre),
        conduccion: m.conduc,
        triangulo: m.triangulo,
        problemaSuministro: m.psum || presentaciones.some((p) => p.psum),
        informacionCima: InformacionCima.safeParse(m.informacionCima).data ?? null,
        asset: aspectoDe(asset?.colorDominante, asset?.paleta, asset?.foto),
        presentaciones: presentaciones.map((p) => ({
          cn: p.cn,
          nombre: p.nombre,
          problemaSuministro: p.psum,
        })),
        secciones: secciones.map((s) => ({
          hash: s.hash,
          seccion: s.seccion,
          titulo: s.titulo,
          texto: s.texto,
          resumenLlano: s.resumenLlano,
        })),
        enlaces: {
          prospecto: `https://cima.aemps.es/cima/dochtml/p/${id}/P_${id}.html`,
          fichaTecnica: `https://cima.aemps.es/cima/dochtml/ft/${id}/FT_${id}.html`,
        },
        reglaDosis: regla,
        borradorDosis,
      };
    },
  };
}

export type Catalogo = ReturnType<typeof crearCatalogo>;
