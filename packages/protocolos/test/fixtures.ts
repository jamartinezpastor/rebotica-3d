import { Protocolo } from '../src/index';

/** Contenido y umbrales FICTICIOS de pruebas. No es un protocolo clínico ni va en data/. */
export const protocoloTriajeFicticio = (): Protocolo =>
  Protocolo.parse({
    id: 'tos',
    version: 1,
    titulo: 'Consulta ficticia',
    sinonimos: ['prueba'],
    preguntasTriaje: [
      { id: 'alarma', tipo: 'siNo', texto: '¿Presenta la señal ficticia de alarma?' },
      { id: 'grupo', tipo: 'grupo', texto: '¿Para quién es la consulta?' },
      { id: 'edad', tipo: 'edad', texto: '¿Qué edad tiene?' },
      { id: 'duracion', tipo: 'duracion', texto: '¿Desde hace cuánto?' },
      { id: 'ulcera', tipo: 'siNo', texto: '¿Tiene la condición ficticia de exclusión?' },
    ],
    criteriosDerivacion: [
      {
        id: 'alarma-prueba',
        descripcion: 'Alarma ficticia',
        urgencia: '112',
        palabrasClave: [],
        cuando: { todas: [{ preguntaId: 'alarma', operador: 'igual', valor: true }] },
      },
      {
        id: 'edad-prueba',
        descripcion: 'Edad ficticia de derivación',
        urgencia: 'urgencias',
        palabrasClave: [],
        cuando: { todas: [{ preguntaId: 'edad', operador: 'menor', valor: 7 }] },
      },
      {
        id: 'duracion-prueba',
        descripcion: 'Duración ficticia de derivación',
        urgencia: 'medico',
        palabrasClave: [],
        cuando: { todas: [{ preguntaId: 'duracion', operador: 'mayorIgual', valor: 13 }] },
      },
    ],
    baldas: [
      {
        titulo: 'Balda ficticia',
        principioActivo: 'activo ficticio a',
        orden: 1,
        edadMinMeses: 80,
        gruposExcluidos: ['embarazo'],
        condicionesExcluidas: ['ulcera'],
      },
      {
        titulo: 'Otra balda ficticia',
        principioActivo: 'activo ficticio b',
        orden: 2,
        gruposExcluidos: [],
        condicionesExcluidas: [],
      },
    ],
    vitrina: [
      {
        principioActivo: 'activo receta ficticio',
        paraQueSeUsa: 'Texto ficticio',
        porQueNecesitaReceta: 'Texto ficticio',
        situacion: 'Texto ficticio',
      },
    ],
    consejos: [],
    parafarmacia: [],
    estado: 'validado',
    validadoPor: 'Farmacéutica Ficticia',
    validadoEn: '2020-01-01',
  });
export const respuestasFicticias = {
  alarma: false,
  grupo: 'adulto',
  edad: 100,
  duracion: 0,
  ulcera: false,
};
