import { describe, expect, it } from 'vitest';
import {
  urlMedicamento,
  urlMedicamentos,
  urlProblemasSuministro,
  urlRegistroCambios,
  urlSeccionFichaTecnica,
} from '../src/cima';

describe('URLs de CIMA', () => {
  it('listado sin receta, comercializado y autorizado', () => {
    const url = urlMedicamentos({
      receta: false,
      comercializados: true,
      autorizados: true,
      atc: 'N02BE01',
      pagina: 2,
    });
    expect(url.toString()).toBe(
      'https://cima.aemps.es/cima/rest/medicamentos?receta=0&comerc=1&autorizados=1&atc=N02BE01&pagina=2',
    );
  });

  it('grupos con receta para la vitrina', () => {
    expect(urlMedicamentos({ receta: true }).searchParams.get('receta')).toBe('1');
  });

  it('detalle de un medicamento', () => {
    expect(urlMedicamento('51347').toString()).toBe(
      'https://cima.aemps.es/cima/rest/medicamento?nregistro=51347',
    );
  });

  it('sección 4.2 de la ficha técnica', () => {
    expect(urlSeccionFichaTecnica('51347', '4.2').toString()).toBe(
      'https://cima.aemps.es/cima/rest/docSegmentado/contenido/1?nregistro=51347&seccion=4.2',
    );
  });

  it('registro de cambios con fecha dd/mm/aaaa', () => {
    const url = urlRegistroCambios(new Date(Date.UTC(2026, 9, 5)));
    expect(url.searchParams.get('fecha')).toBe('05/10/2026');
  });

  it('problemas de suministro por código nacional', () => {
    expect(urlProblemasSuministro('712345').pathname).toBe('/cima/rest/psuministro/712345');
  });
});
