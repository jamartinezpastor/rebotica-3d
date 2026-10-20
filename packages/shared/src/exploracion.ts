import { z } from 'zod';
import { ProtocoloConsulta } from './consulta';
import { PasilloResponse } from './api';

/** Navegación informativa por tema: sin perfil del paciente ni autorización de tratamiento. */
export const ExplorarEntrada = z.strictObject({ consultaId: ProtocoloConsulta });
export const ExplorarRespuesta = PasilloResponse.refine((p) => p.estado === 'informativo');
