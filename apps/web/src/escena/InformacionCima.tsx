import type { ProductoResponse } from '@rebotica/shared';
import { useState } from 'react';
import { esEnlaceAemps } from './fichaSecciones';

const formatoFecha = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'medium',
  timeZone: 'Europe/Madrid',
});
const fecha = (valor: string) => formatoFecha.format(new Date(valor));

function ConsultaCima({ consultadoEn }: { consultadoEn: string }) {
  const [ahora] = useState(() => Date.now());
  return (
    <p className="text-sm text-tinta-suave">
      Fuente: AEMPS · Consulta del {fecha(consultadoEn)}.
      {ahora - new Date(consultadoEn).getTime() > 48 * 60 * 60 * 1000 &&
        ' Esta copia tiene más de 48 horas; la información puede haber cambiado.'}
    </p>
  );
}

export function Suministro({ ficha }: { ficha: ProductoResponse }) {
  const datos = ficha.informacionCima?.suministro;
  return (
    <>
      <h3 className="text-base font-semibold">Suministro</h3>
      <p className="text-sm text-tinta-suave">
        Incidencias notificadas en España. No indica existencias en farmacias ni disponibilidad por
        comunidad autónoma.
      </p>
      {!datos ? (
        <p role="status">
          {ficha.problemaSuministro
            ? 'Hay problemas de suministro registrados, pero el detalle no está disponible en esta copia.'
            : 'Información de suministro pendiente de actualizar. No podemos confirmar si hay incidencias.'}
        </p>
      ) : (
        <>
          <ConsultaCima consultadoEn={datos.consultadoEn} />
          {datos.incidencias.length === 0 ? (
            <p>
              Sin incidencias de suministro notificadas en esta consulta. Esto no garantiza
              disponibilidad.
            </p>
          ) : (
            <ul className="space-y-3">
              {datos.incidencias.map((incidencia, i) => (
                <li
                  key={`${incidencia.cn}-${i}`}
                  className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200"
                >
                  <details>
                    <summary className="min-h-11 cursor-pointer content-center font-semibold">
                      {incidencia.nombre}
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="text-sm">Código nacional: {incidencia.cn}</p>
                      {incidencia.inicio && <p>Inicio: {fecha(incidencia.inicio)}.</p>}
                      <p>
                        {incidencia.finPrevisto
                          ? `Fin previsto: ${fecha(incidencia.finPrevisto)} (puede cambiar).`
                          : 'Sin fecha de fin prevista.'}
                      </p>
                      {incidencia.observaciones && (
                        <p className="whitespace-pre-line">{incidencia.observaciones}</p>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

export function NotasSeguridad({ ficha }: { ficha: ProductoResponse }) {
  const datos = ficha.informacionCima?.seguridad;
  return (
    <>
      <h3 className="text-base font-semibold">Notas de seguridad de la AEMPS</h3>
      {!datos ? (
        <p role="status">Las notas de seguridad todavía no están disponibles en esta copia.</p>
      ) : (
        <>
          <ConsultaCima consultadoEn={datos.consultadoEn} />
          {datos.notas.length === 0 ? (
            <p>
              No constan notas de seguridad asociadas en esta consulta. Consulta también las
              precauciones y el prospecto.
            </p>
          ) : (
            <ul className="space-y-3">
              {datos.notas.map((nota, i) => (
                <li key={`${nota.referencia}-${i}`} className="rounded-xl bg-black/[0.03] p-3">
                  <details>
                    <summary className="min-h-11 cursor-pointer content-center font-semibold">
                      {nota.asunto}
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-tinta-suave">
                        {[nota.referencia, nota.fecha ? fecha(nota.fecha) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {esEnlaceAemps(nota.url) && (
                        <a
                          href={nota.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center font-semibold text-cruz underline"
                        >
                          Leer nota completa en la AEMPS
                        </a>
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
