import {
  grupoReceta,
  medicamento,
  presentacion,
  reglaDosis,
  seccionFt,
  type Db,
} from '@rebotica/db';
import { and, eq, ne, notInArray, sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { ErrorCima, type ClienteCima } from './cliente';
import {
  SECCIONES_FT,
  urlFichaTecnica,
  urlMedicamento,
  urlMedicamentos,
  urlSeccionFichaTecnica,
} from './cima';
import { Detalle, Listado, SeccionesFT, type ItemListado } from './esquemas';
import { categoriaLegible, hashTexto, htmlATexto, reunirSecciones } from './texto';

/** Cualquier base PostgreSQL de Drizzle (node-postgres en producción, PGlite en los tests). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseDatos = PgDatabase<any, any>;

export interface Informe {
  sinReceta: {
    listados: number;
    sincronizados: number;
    omitidos: number;
    presentaciones: number;
    secciones: number;
    sinPosologia: number;
    retirados: number;
    reglasARevisar: number;
  };
  vitrina: {
    medicamentosConReceta: number;
    sincronizados: number;
    retirados: number;
    grupos: number;
    conIndicacion: number;
    sinPrincipioActivo: number;
  };
  errores: { contexto: string; mensaje: string }[];
  peticiones: number;
  duracionMs: number;
}

export interface OpcionesSync {
  /** Máximo de medicamentos de cada catálogo y de grupos con receta; para pruebas y ensayos. */
  limite?: number;
  log?: (mensaje: string) => void;
}

/** Longitud máxima del extracto de la sección 4.1 que se guarda para la vitrina. */
const MAX_INDICACION = 400;
const MAX_ERRORES_INFORME = 50;

async function* paginas(cliente: ClienteCima, receta: boolean): AsyncGenerator<ItemListado[]> {
  for (let pagina = 1; ; pagina++) {
    const url = urlMedicamentos({ receta, comercializados: true, autorizados: true, pagina });
    const listado = await cliente.obtener(url, Listado);
    if (!listado || listado.resultados.length === 0) return;
    yield listado.resultados;
    if (pagina * listado.tamanioPagina >= listado.totalFilas) return;
  }
}

function mensajeDe(err: unknown): string {
  return err instanceof ErrorCima ? err.message : err instanceof Error ? err.message : String(err);
}

export async function sincronizar(
  db: BaseDatos,
  cliente: ClienteCima,
  opciones: OpcionesSync = {},
): Promise<Informe> {
  const inicio = Date.now();
  const log = opciones.log ?? (() => {});
  const limite = opciones.limite ?? Infinity;
  // Misma API en ambos drivers; se tipa con el del esquema para tener las tablas tipadas.
  const conexion = db as unknown as Db;

  const informe: Informe = {
    sinReceta: {
      listados: 0,
      sincronizados: 0,
      omitidos: 0,
      presentaciones: 0,
      secciones: 0,
      sinPosologia: 0,
      retirados: 0,
      reglasARevisar: 0,
    },
    vitrina: {
      medicamentosConReceta: 0,
      sincronizados: 0,
      retirados: 0,
      grupos: 0,
      conIndicacion: 0,
      sinPrincipioActivo: 0,
    },
    errores: [],
    peticiones: 0,
    duracionMs: 0,
  };
  let totalErrores = 0;
  const registrarError = (contexto: string, err: unknown) => {
    totalErrores++;
    if (informe.errores.length < MAX_ERRORES_INFORME) {
      informe.errores.push({ contexto, mensaje: mensajeDe(err) });
    }
    log(`error en ${contexto}: ${mensajeDe(err)}`);
  };

  // ---------- 1. Medicamentos sin receta: detalle, presentaciones y secciones 4.1–4.7 ----------
  const vistos: string[] = [];
  let procesados = 0;
  recorrido: for await (const pagina of paginas(cliente, false)) {
    for (const item of pagina) {
      informe.sinReceta.listados++;
      if (procesados >= limite) break recorrido;
      procesados++;

      // Principio 1: nada con receta o sin comercializar entra en las baldas.
      if (item.receta || !item.comerc) {
        informe.sinReceta.omitidos++;
        continue;
      }
      try {
        const detalle = await cliente.obtener(urlMedicamento(item.nregistro), Detalle);
        if (!detalle || detalle.receta || !detalle.comerc) {
          informe.sinReceta.omitidos++;
          continue;
        }
        const secciones =
          (await cliente.obtener(urlFichaTecnica(item.nregistro), SeccionesFT)) ?? [];
        const resultado = await guardarMedicamento(conexion, detalle, secciones);
        vistos.push(detalle.nregistro);
        informe.sinReceta.sincronizados++;
        informe.sinReceta.presentaciones += resultado.presentaciones;
        informe.sinReceta.secciones += resultado.secciones;
        informe.sinReceta.reglasARevisar += resultado.reglasARevisar;
        if (!resultado.tienePosologia) informe.sinReceta.sinPosologia++;
        if (informe.sinReceta.sincronizados % 50 === 0) {
          log(`sin receta: ${informe.sinReceta.sincronizados} sincronizados`);
        }
      } catch (err) {
        registrarError(`medicamento ${item.nregistro}`, err);
      }
    }
  }

  // ---------- 2. Vitrina: fichas completas y grupos con receta ----------
  let procesadosReceta = 0;
  const grupos = new Map<
    string,
    {
      pactivo: string;
      forma: string;
      condiciones: Set<string>;
      representante: string;
      // Solo en memoria, para quitar las marcas del extracto; nunca se guardan.
      marcas: Set<string>;
    }
  >();
  try {
    for await (const pagina of paginas(cliente, true)) {
      for (const item of pagina) {
        informe.vitrina.medicamentosConReceta++;
        if (procesadosReceta < limite) {
          procesadosReceta++;
          try {
            const detalle = await cliente.obtener(urlMedicamento(item.nregistro), Detalle);
            if (detalle?.comerc) {
              const secciones =
                (await cliente.obtener(urlFichaTecnica(item.nregistro), SeccionesFT)) ?? [];
              const resultado = await guardarMedicamento(conexion, detalle, secciones);
              vistos.push(detalle.nregistro);
              informe.vitrina.sincronizados++;
              informe.sinReceta.reglasARevisar += resultado.reglasARevisar;
            }
          } catch (err) {
            registrarError(`medicamento ${item.nregistro}`, err);
          }
        }
        const pactivo = item.vtm?.nombre?.trim();
        if (!pactivo) {
          informe.vitrina.sinPrincipioActivo++;
          continue;
        }
        const forma = (
          item.formaFarmaceuticaSimplificada?.nombre ??
          item.formaFarmaceutica?.nombre ??
          'sin especificar'
        )
          .trim()
          .toLowerCase();
        const clave = `${pactivo.toLowerCase()}|${forma}`;
        let grupo = grupos.get(clave);
        if (!grupo) {
          grupo = {
            pactivo,
            forma,
            condiciones: new Set(),
            representante: item.nregistro,
            marcas: new Set(),
          };
          grupos.set(clave, grupo);
        }
        if (item.cpresc) grupo.condiciones.add(item.cpresc.trim());
        grupo.marcas.add(item.nombre);
      }
    }
  } catch (err) {
    registrarError('listado con receta', err);
  }

  let guardados = 0;
  for (const grupo of grupos.values()) {
    if (guardados >= limite) break;
    guardados++;
    let indicacion: string | null = null;
    try {
      const secciones = await cliente.obtener(
        urlSeccionFichaTecnica(grupo.representante, '4.1'),
        SeccionesFT,
      );
      const texto = secciones?.find((s) => s.seccion === '4.1')?.contenido;
      if (texto) {
        const limpio = quitarMarcas(htmlATexto(texto), grupo.marcas, grupo.pactivo);
        indicacion = extracto(limpio, MAX_INDICACION) || null;
      }
    } catch (err) {
      registrarError(`indicación de ${grupo.pactivo}`, err);
    }
    const valores = {
      pactivo: grupo.pactivo,
      forma: grupo.forma,
      indicacion,
      condicionesPrescripcion: [...grupo.condiciones].sort().join('; ') || null,
      actualizadoEn: new Date(),
    };
    await conexion
      .insert(grupoReceta)
      .values(valores)
      .onConflictDoUpdate({
        target: [grupoReceta.pactivo, grupoReceta.forma],
        set: valores,
      });
    informe.vitrina.grupos++;
    if (indicacion) informe.vitrina.conIndicacion++;
  }

  informe.peticiones = cliente.peticiones;
  // Solo una pasada completa y sin errores puede retirar productos ausentes de ambos listados.
  if (limite === Infinity && totalErrores === 0 && vistos.length > 0) {
    const retirados = await conexion
      .update(medicamento)
      .set({ comerc: false, actualizadoEn: new Date() })
      .where(and(eq(medicamento.comerc, true), notInArray(medicamento.nregistro, vistos)))
      .returning({ receta: medicamento.receta });
    informe.sinReceta.retirados = retirados.filter((m) => !m.receta).length;
    informe.vitrina.retirados = retirados.filter((m) => m.receta).length;
  }
  informe.duracionMs = Date.now() - inicio;
  return informe;
}

/**
 * La descripción del grupo usa el principio activo. Las marcas se conservan en las fichas
 * de los productos; no se usan como sujeto del texto genérico del grupo.
 */
export function quitarMarcas(texto: string, nombres: Iterable<string>, pactivo: string): string {
  let resultado = texto;
  const bases = new Set<string>();
  for (const nombre of nombres) {
    // «ABRILIA 20 MG COMPRIMIDOS EFG» -> «ABRILIA»: todo lo anterior a la primera cifra suelta.
    const base = nombre.split(/\s+\d/)[0]?.trim();
    if (base && base.length >= 3) bases.add(base);
  }
  // Primero los nombres largos, para no dejar restos de los que contienen a otros.
  for (const base of [...bases].sort((a, b) => b.length - a.length)) {
    const escapado = base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    resultado = resultado.replace(new RegExp(escapado, 'gi'), () => pactivo);
  }
  // Nombres sin cifras («ABRYSVO polvo…») no se detectan arriba: si la frase abre con un sujeto
  // corto seguido de «está indicado», ese sujeto es el nombre comercial.
  return resultado.replace(
    /^(?:[^\s,.:;]+\s+){0,4}?[^\s,.:;]+(?= (?:está|están) indicad[oa]s?\b)/i,
    () => pactivo,
  );
}

function extracto(texto: string, max: number): string {
  const plano = texto.replace(/\s+/g, ' ').trim();
  if (plano.length <= max) return plano;
  const corte = plano.slice(0, max);
  const ultimoEspacio = corte.lastIndexOf(' ');
  return `${corte.slice(0, ultimoEspacio > max * 0.6 ? ultimoEspacio : max)}…`;
}

/** Categoría legible: el nombre ATC de nivel 3 (o el más cercano por debajo) que da CIMA. */
export function categoriaDe(detalle: Pick<Detalle, 'atcs'>): string | null {
  const con = detalle.atcs.filter((a) => a.nombre && a.nivel);
  const nivel3 = con.find((a) => a.nivel === 3) ?? con.find((a) => a.nivel === 4);
  return nivel3?.nombre ? categoriaLegible(nivel3.nombre) : null;
}

export interface ResultadoGuardado {
  presentaciones: number;
  secciones: number;
  tienePosologia: boolean;
  /** Reglas de dosis que pasan a `revisar` porque la sección 4.2 ya no coincide con su hash. */
  reglasARevisar: number;
}

export async function guardarMedicamento(
  base: BaseDatos,
  detalle: Detalle,
  secciones: SeccionesFT,
): Promise<ResultadoGuardado> {
  const db = base as unknown as Db;
  const pactivos =
    detalle.pactivos?.trim() || detalle.principiosActivos.map((p) => p.nombre).join(', ');
  const foto = detalle.fotos.find((f) => f.tipo === 'materialas')?.url ?? null;
  const ahora = new Date();
  const fila = {
    nregistro: detalle.nregistro,
    nombre: detalle.nombre,
    pactivos,
    labtitular: detalle.labtitular ?? null,
    receta: detalle.receta,
    comerc: detalle.comerc,
    conduc: detalle.conduc,
    triangulo: detalle.triangulo,
    psum: detalle.psum,
    forma: detalle.formaFarmaceutica?.nombre ?? null,
    dosis: detalle.dosis ?? null,
    categoria: categoriaDe(detalle),
    atcs: detalle.atcs.map((a) => a.codigo),
    fotoUrl: foto,
    actualizadoEn: ahora,
  };

  const filasSeccion = reunirSecciones(secciones)
    .filter((s) => (SECCIONES_FT as readonly string[]).includes(s.seccion) && s.contenido)
    .map((s) => {
      const html = s.contenido ?? '';
      const texto = htmlATexto(html);
      return {
        nregistro: detalle.nregistro,
        seccion: s.seccion,
        titulo: s.titulo,
        html,
        texto,
        hash: hashTexto(texto),
      };
    });

  const filasPresentacion = [
    ...new Map(
      detalle.presentaciones.map((p) => [
        p.cn,
        {
          cn: p.cn,
          nregistro: detalle.nregistro,
          nombre: p.nombre,
          comerc: p.comerc,
          psum: p.psum,
        },
      ]),
    ).values(),
  ];

  let reglasARevisar = 0;
  await db.transaction(async (tx) => {
    const { nregistro, ...cambios } = fila;
    const [anterior] = await tx
      .select({ receta: medicamento.receta })
      .from(medicamento)
      .where(eq(medicamento.nregistro, nregistro));
    await tx
      .insert(medicamento)
      .values(fila)
      .onConflictDoUpdate({ target: medicamento.nregistro, set: cambios });

    await tx.delete(presentacion).where(eq(presentacion.nregistro, nregistro));
    if (filasPresentacion.length > 0) await tx.insert(presentacion).values(filasPresentacion);

    // El resumen en lenguaje llano lo escribe otro proceso: no se toca al sincronizar.
    for (const f of filasSeccion) {
      await tx
        .insert(seccionFt)
        .values(f)
        .onConflictDoUpdate({
          target: [seccionFt.nregistro, seccionFt.seccion],
          set: {
            titulo: f.titulo,
            html: f.html,
            texto: f.texto,
            hash: f.hash,
            // Un resumen revisado deja de valer si cambia el texto del que sale.
            resumenLlano: sql`CASE WHEN ${seccionFt.hash} = ${f.hash} THEN ${seccionFt.resumenLlano} ELSE NULL END`,
          },
        });
    }
    const presentes = filasSeccion.map((f) => f.seccion);
    await tx
      .delete(seccionFt)
      .where(
        presentes.length > 0
          ? and(eq(seccionFt.nregistro, nregistro), notInArray(seccionFt.seccion, presentes))
          : eq(seccionFt.nregistro, nregistro),
      );

    // Una regla se transcribió de una versión concreta de la 4.2 (su `hashSeccion` es el hash de
    // `seccion_ft`). Si la ficha técnica ya no coincide, la calculadora se oculta hasta que un
    // farmacéutico la revise (plan §Sincronización).
    const hash42 = filasSeccion.find((f) => f.seccion === '4.2')?.hash;
    const obsoletas = await tx
      .update(reglaDosis)
      .set({ estado: 'revisar' })
      .where(
        and(
          eq(reglaDosis.nregistro, nregistro),
          ne(reglaDosis.estado, 'revisar'),
          anterior && anterior.receta !== detalle.receta
            ? undefined
            : hash42
              ? ne(reglaDosis.hashSeccion, hash42)
              : undefined,
        ),
      )
      .returning({ id: reglaDosis.id });
    reglasARevisar = obsoletas.length;
  });

  return {
    presentaciones: filasPresentacion.length,
    secciones: filasSeccion.length,
    tienePosologia: filasSeccion.some((f) => f.seccion === '4.2' && f.texto.length > 0),
    reglasARevisar,
  };
}
