import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { reglaFicticia } from '../../../packages/dosis/test/fixtures';
import { protocoloTriajeFicticio } from '../../../packages/protocolos/test/fixtures';
import { prepararRevisionClinica, revisionClinicaMarkdown } from '../src/revision-clinica';

describe('F6-01: preparación de revisión, sin validación clínica', () => {
  let temporal: string;
  let reglasDir: string;
  let protocolosDir: string;
  beforeEach(async () => {
    temporal = await mkdtemp(join(tmpdir(), 'rebotica-revision-'));
    reglasDir = join(temporal, 'reglas');
    protocolosDir = join(temporal, 'protocolos');
    await mkdir(reglasDir);
    await mkdir(protocolosDir);
  });
  afterEach(async () => {
    await rm(temporal, { recursive: true, force: true });
  });
  const regla = () => ({
    ...reglaFicticia(),
    fuente: { ...reglaFicticia().fuente, hashSeccion: 'a'.repeat(64) },
  });
  const escribir = async <T extends { id: string }>(dir: string, d: T) => {
    await writeFile(join(dir, `${d.id}.json`), JSON.stringify(d));
  };

  it('recoge las 19 semillas reales como borradores, sin generar ni ejecutar pautas', async () => {
    const informe = await prepararRevisionClinica({
      reglasDir: fileURLToPath(new URL('../../../packages/dosis/data/reglas/', import.meta.url)),
      protocolosDir: fileURLToPath(new URL('../../../packages/protocolos/data/', import.meta.url)),
    });
    expect(informe.resumen).toEqual({
      reglas: 5,
      protocolos: 14,
      borradores: 19,
      firmasDeclaradas: 0,
      erroresTecnicos: 0,
    });
    expect(informe.cobertura).toEqual({ faltan: [], adicionales: [] });
    expect(informe.documentos.every((d) => d.sha256Archivo?.length === 64)).toBe(true);
    expect(informe.documentos.every((d) => d.comprobacionesPendientes.length)).toBe(true);
    expect(
      informe.documentos
        .filter((d) => d.tipo === 'protocolo')
        .every((d) => d.tareasEditoriales.length),
    ).toBe(true);
  });

  it('no interpreta estado y firma declarados como revisión profesional ni vigencia', async () => {
    const r = regla();
    await escribir(reglasDir, r);
    await escribir(protocolosDir, protocoloTriajeFicticio());
    const antes = await readFile(join(reglasDir, `${r.id}.json`));
    const informe = await prepararRevisionClinica({ reglasDir, protocolosDir });
    expect(informe.resumen.firmasDeclaradas).toBe(2);
    expect(informe.identidadFirmantes).toBe('no-comprobada');
    expect(informe.vigenciaCima).toBe('no-comprobada');
    expect(informe.documentos.every((d) => d.comprobacionesPendientes.length)).toBe(true);
    expect(await readFile(join(reglasDir, `${r.id}.json`))).toEqual(antes);
    expect(revisionClinicaMarkdown(informe)).toContain('No habilita calculadoras ni triaje');
  });

  it('conserva los archivos inválidos y sigue revisando los demás', async () => {
    await writeFile(join(reglasDir, 'roto.json'), '{');
    await writeFile(join(reglasDir, 'esquema.json'), JSON.stringify({ estado: 'validada' }));
    await escribir(reglasDir, regla());
    const informe = await prepararRevisionClinica({ reglasDir, protocolosDir });
    expect(informe.documentos).toHaveLength(3);
    expect(informe.documentos.filter((d) => d.errores.length)).toHaveLength(2);
    expect(informe.documentos.find((d) => d.id === regla().id)?.fuentes).toHaveLength(1);
    expect(informe.resumen.erroresTecnicos).toBeGreaterThan(0);
    expect(informe.cobertura.faltan).toHaveLength(14);
  });

  it('detecta dos reglas para el mismo registro y versión aunque tengan distinto id', async () => {
    await escribir(reglasDir, regla());
    await escribir(reglasDir, { ...regla(), id: 'otra-regla-ficticia' });
    const informe = await prepararRevisionClinica({ reglasDir, protocolosDir });
    expect(informe.documentos.flatMap((d) => d.errores)).toContain(
      'Registro o id y versión duplicados.',
    );
  });

  it('denuncia carpeta ausente sin perder el resto del inventario', async () => {
    await escribir(reglasDir, regla());
    const informe = await prepararRevisionClinica({
      reglasDir,
      protocolosDir: join(temporal, 'ausente'),
    });
    expect(informe.resumen.reglas).toBe(1);
    expect(informe.errores).toContain('No se pudo leer el directorio de protocolo.');
  });

  it('distingue una modificación de archivo aunque no se cambie la versión', async () => {
    await escribir(reglasDir, regla());
    const primero = await prepararRevisionClinica({ reglasDir, protocolosDir });
    await escribir(reglasDir, { ...regla(), avisos: [] });
    const segundo = await prepararRevisionClinica({ reglasDir, protocolosDir });
    expect(segundo.documentos[0]?.version).toBe(primero.documentos[0]?.version);
    expect(segundo.documentos[0]?.sha256Archivo).not.toBe(primero.documentos[0]?.sha256Archivo);
    expect(segundo.documentos[0]?.hashSeccionDeclarado).toBe(
      primero.documentos[0]?.hashSeccionDeclarado,
    );
  });

  it('mantiene pendientes los protocolos sin trazabilidad y las duraciones sin resolver', async () => {
    const r = regla();
    await escribir(reglasDir, {
      ...r,
      diasMaxSinConsultar: {},
      fuente: { ...r.fuente, cita: undefined },
    });
    await escribir(protocolosDir, protocoloTriajeFicticio());
    const informe = await prepararRevisionClinica({ reglasDir, protocolosDir });
    expect(informe.documentos[0]?.errores).toContain('Falta la cita literal de la sección 4.2.');
    expect(informe.documentos[0]?.comprobacionesPendientes.join(' ')).toContain(
      'duración no especificada',
    );
    expect(informe.documentos[1]?.errores).toContain('Falta la trazabilidad editorial (revision).');
  });
});
