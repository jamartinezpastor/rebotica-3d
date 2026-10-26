import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ReglaDosis } from '@rebotica/dosis';
import { Protocolo } from '@rebotica/protocolos';
import { CONSULTAS_FRECUENTES } from '@rebotica/shared';

interface DocumentoRevision {
  tipo: 'regla' | 'protocolo';
  archivo: string;
  sha256Archivo: string | null;
  id: string | null;
  version: number | null;
  estadoDeclarado: string | null;
  firmaDeclarada: { nombre: string | null; fecha: string | null } | null;
  fuentes: { titulo: string; url: string }[];
  hashSeccionDeclarado: string | null;
  registroCima: string | null;
  tareasEditoriales: string[];
  comprobacionesPendientes: string[];
  errores: string[];
}

const pendientesRegla = [
  'Contrastar transcripción, presentación y límites con las secciones oficiales vigentes.',
  'Revisar exclusiones, alergias, interacciones y alcance no expresado por el esquema.',
  'Aportar casos clínicos revisados; los tests aritméticos ficticios no los sustituyen.',
  'Comprobar vigencia del hash y de la cita frente a la copia CIMA actual.',
  'Revisión farmacéutica y comprobación de la identidad de quien firma.',
];
const pendientesProtocolo = [
  'Revisar alarmas, poblaciones, vías, presentaciones y circuito de derivación.',
  'Contrastar las fuentes y resolver las tareas editoriales de la revisión.',
  'Aportar casos clínicos y adversarios revisados.',
  'Revisión farmacéutica y comprobación de la identidad de quien firma.',
];

/** Inventario editorial de solo lectura. No evalúa pacientes ni publica contenido clínico. */
export async function prepararRevisionClinica(opciones: {
  reglasDir: string;
  protocolosDir: string;
}) {
  const documentos: DocumentoRevision[] = [];
  const errores: string[] = [];
  for (const [tipo, directorio] of [
    ['regla', opciones.reglasDir],
    ['protocolo', opciones.protocolosDir],
  ] as const) {
    let archivos: string[];
    try {
      archivos = (await readdir(directorio)).filter((a) => a.endsWith('.json')).sort();
    } catch {
      errores.push(`No se pudo leer el directorio de ${tipo}.`);
      continue;
    }
    if (!archivos.length) errores.push(`No hay documentos de tipo ${tipo}.`);
    for (const archivo of archivos) {
      const documento: DocumentoRevision = {
        tipo,
        archivo,
        sha256Archivo: null,
        id: null,
        version: null,
        estadoDeclarado: null,
        firmaDeclarada: null,
        fuentes: [],
        hashSeccionDeclarado: null,
        registroCima: null,
        tareasEditoriales: [],
        comprobacionesPendientes: [...(tipo === 'regla' ? pendientesRegla : pendientesProtocolo)],
        errores: [],
      };
      documentos.push(documento);
      let datos: unknown;
      try {
        const bytes = await readFile(join(directorio, archivo));
        documento.sha256Archivo = createHash('sha256').update(bytes).digest('hex');
        datos = JSON.parse(bytes.toString('utf8'));
      } catch {
        documento.errores.push('Archivo ilegible o JSON inválido.');
        continue;
      }
      const resultado = tipo === 'regla' ? ReglaDosis.safeParse(datos) : Protocolo.safeParse(datos);
      if (!resultado.success) {
        documento.errores.push(
          ...resultado.error.issues.map(
            (e) => `Esquema: ${e.path.join('.') || '(raíz)'} (${e.code}).`,
          ),
        );
        continue;
      }
      const d = resultado.data;
      documento.id = d.id;
      documento.version = d.version;
      documento.estadoDeclarado = d.estado;
      if (archivo !== `${d.id}.json`)
        documento.errores.push('El nombre del archivo no coincide con el id.');
      if ('fuente' in d) {
        documento.registroCima = d.fuente.nregistro;
        documento.firmaDeclarada = { nombre: d.fuente.validadoPor, fecha: d.fuente.fecha };
        documento.hashSeccionDeclarado = d.fuente.hashSeccion;
        documento.fuentes = [
          {
            titulo: `CIMA ${d.fuente.nregistro}, sección 4.2`,
            url: `https://cima.aemps.es/cima/dochtml/ft/${encodeURIComponent(d.fuente.nregistro)}/FT_${encodeURIComponent(d.fuente.nregistro)}.html`,
          },
        ];
        if (!/^[a-f0-9]{64}$/.test(d.fuente.hashSeccion))
          documento.errores.push('La huella declarada de la sección 4.2 no es SHA-256.');
        if (!d.fuente.cita) documento.errores.push('Falta la cita literal de la sección 4.2.');
        if (!Object.keys(d.diasMaxSinConsultar).length)
          documento.comprobacionesPendientes.push(
            'Resolver la duración no especificada: el motor no ofrece resultados sin motivo cubierto.',
          );
      } else {
        documento.firmaDeclarada = { nombre: d.validadoPor, fecha: d.validadoEn };
        documento.fuentes = d.revision?.fuentes ?? [];
        documento.tareasEditoriales = d.revision?.pendienteDe ?? [];
        if (!d.revision) documento.errores.push('Falta la trazabilidad editorial (revision).');
        if (d.criteriosDerivacion.some((c) => !c.cuando))
          documento.errores.push('Hay criterios sin condición ejecutable.');
      }
      if (!documento.firmaDeclarada.nombre || !documento.firmaDeclarada.fecha)
        documento.comprobacionesPendientes.push('Falta firma o fecha declarada.');
      if (!['validada', 'validado'].includes(d.estado))
        documento.comprobacionesPendientes.push('El documento no está en estado validado.');
    }
  }
  const identidades = new Set<string>();
  for (const d of documentos) {
    if (!d.id) continue;
    const clave = `${d.tipo}:${d.registroCima ?? d.id}:${d.version}`;
    if (identidades.has(clave)) d.errores.push('Registro o id y versión duplicados.');
    identidades.add(clave);
  }
  const ids = documentos.filter((d) => d.tipo === 'protocolo' && d.id).map((d) => d.id!);
  const esperados: readonly string[] = CONSULTAS_FRECUENTES.map((c) => c.id);
  const cobertura = {
    faltan: esperados.filter((id) => !ids.includes(id)),
    adicionales: [...new Set(ids.filter((id) => !esperados.includes(id)))],
  };
  if (cobertura.faltan.length || cobertura.adicionales.length)
    errores.push('Los protocolos no coinciden con el catálogo cerrado de consultas.');
  return {
    formato: 1,
    generadoEn: new Date().toISOString(),
    alcance:
      'Inventario de archivos del repositorio; no es validación farmacéutica ni publicación.',
    vigenciaCima: 'no-comprobada',
    identidadFirmantes: 'no-comprobada',
    resumen: {
      reglas: documentos.filter((d) => d.tipo === 'regla').length,
      protocolos: documentos.filter((d) => d.tipo === 'protocolo').length,
      borradores: documentos.filter((d) => d.estadoDeclarado === 'borrador').length,
      firmasDeclaradas: documentos.filter((d) => d.firmaDeclarada?.nombre && d.firmaDeclarada.fecha)
        .length,
      erroresTecnicos: errores.length + documentos.reduce((n, d) => n + d.errores.length, 0),
    },
    cobertura,
    errores,
    documentos,
  };
}

export type InformeRevisionClinica = Awaited<ReturnType<typeof prepararRevisionClinica>>;

export function revisionClinicaMarkdown(informe: InformeRevisionClinica): string {
  // El contenido editorial puede contener caracteres Markdown: siempre se escapa como texto.
  const texto = (s: string) => s.replace(/[\\`*_[\]<>#|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
  const url = (s: string) => s.replace(/[<>\s\\]/g, (c) => encodeURIComponent(c));
  return [
    '# F6-01 — preparación de revisión farmacéutica',
    '',
    informe.alcance,
    `Generado en UTC: ${informe.generadoEn}.`,
    'Vigencia CIMA e identidad de firmantes: no comprobadas. No habilita calculadoras ni triaje.',
    '',
    `Reglas: ${informe.resumen.reglas}; protocolos: ${informe.resumen.protocolos}; borradores: ${informe.resumen.borradores}; errores técnicos: ${informe.resumen.erroresTecnicos}.`,
    '',
    ...informe.errores.map((e) => `- ${texto(e)}`),
    ...informe.cobertura.faltan.map((id) => `- Falta protocolo: ${texto(id)}.`),
    ...informe.cobertura.adicionales.map((id) => `- Protocolo fuera del catálogo: ${texto(id)}.`),
    ...informe.documentos.flatMap((d) => [
      '',
      `## ${texto(d.tipo)}: ${texto(d.id ?? d.archivo)}`,
      '',
      `Archivo: ${texto(d.archivo)}. Versión: ${d.version ?? 'desconocida'}. Estado declarado: ${texto(d.estadoDeclarado ?? 'ilegible')}.`,
      `SHA-256 del archivo: ${d.sha256Archivo ?? 'no disponible'}.`,
      `Firma declarada (no verificada): ${texto(d.firmaDeclarada?.nombre ?? 'ausente')}; fecha: ${texto(d.firmaDeclarada?.fecha ?? 'ausente')}.`,
      ...(d.hashSeccionDeclarado
        ? [`SHA-256 declarado de sección 4.2: ${texto(d.hashSeccionDeclarado)}.`]
        : []),
      '',
      ...d.fuentes.map((f) => `- Fuente: [${texto(f.titulo)}](<${url(f.url)}>)`),
      ...d.errores.map((e) => `- Error técnico: ${texto(e)}`),
      ...d.tareasEditoriales.map((t) => `- [ ] Tarea editorial: ${texto(t)}`),
      ...d.comprobacionesPendientes.map((t) => `- [ ] ${texto(t)}`),
    ]),
    '',
  ].join('\n');
}
