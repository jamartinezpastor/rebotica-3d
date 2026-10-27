import { z } from 'zod';
import { ProtocoloConsulta } from './consulta';
import { PasilloResponse } from './api';
import { InterpretarRespuesta } from './interpretacion';

/** Navegación informativa por tema: sin perfil del paciente ni autorización de tratamiento. */
export const ExplorarEntrada = z.strictObject({ consultaId: ProtocoloConsulta });
export const ExplorarRespuesta = PasilloResponse.refine((p) => p.estado === 'informativo');
export const InterpretarCatalogoRespuesta = z.union([
  InterpretarRespuesta,
  z.strictObject({ tipo: z.literal('catalogo'), pasillo: ExplorarRespuesta }),
]);
