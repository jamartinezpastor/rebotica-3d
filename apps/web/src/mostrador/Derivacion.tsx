import { useEffect, useRef } from 'react';
import type { DerivacionConsulta, DerivacionTriaje } from '@rebotica/shared';

const MOTIVOS: Record<DerivacionConsulta['alarmasDetectadas'][number], string> = {
  'dolor-toracico': 'Has mencionado dolor o presión en el pecho.',
  'dificultad-respiratoria': 'Has mencionado dificultad para respirar.',
  convulsion: 'Has mencionado convulsiones.',
  sangrado: 'Has mencionado sangre o sangrado.',
  'fiebre-bebe': 'Has mencionado fiebre en un bebé.',
  'conducta-suicida': 'Lo que cuentas merece apoyo y atención personal.',
  'otra-urgencia': 'Has mencionado una posible señal de urgencia.',
  'valoracion-medica': 'La consulta necesita valoración médica.',
};
export function Derivacion({ resultado }: { resultado: DerivacionConsulta | DerivacionTriaje }) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  const destino = resultado.tipo === 'derivacion' ? resultado.destino : resultado.urgencia;
  const apoyo =
    resultado.tipo === 'derivacion' && resultado.alarmasDetectadas.includes('conducta-suicida');
  const motivos =
    resultado.tipo === 'derivacion'
      ? resultado.alarmasDetectadas.map((id) => MOTIVOS[id])
      : resultado.motivos.map((m) => m.descripcion);
  return (
    <section
      aria-labelledby="derivacion-titulo"
      className="space-y-5 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-700"
    >
      <h2
        id="derivacion-titulo"
        ref={titulo}
        tabIndex={-1}
        className="text-3xl font-semibold outline-none"
      >
        {destino === '112'
          ? 'Necesitas atención urgente'
          : apoyo
            ? 'Puedes pedir apoyo ahora'
            : 'Consulta con un profesional'}
      </h2>
      <ul className="list-disc space-y-2 pl-5 text-base">
        {motivos.map((motivo, i) => (
          <li key={i}>{motivo}</li>
        ))}
      </ul>
      {destino === '112' ? (
        <p>Llama al 112 ahora para recibir ayuda.</p>
      ) : destino === 'urgencias' ? (
        <p>Acude a un servicio de urgencias para que te valoren.</p>
      ) : destino === 'farmaceutico' ? (
        <p>Habla con tu farmacéutico antes de elegir un producto.</p>
      ) : !apoyo ? (
        <p>Contacta con tu centro de salud para que un médico valore la consulta.</p>
      ) : (
        <p>
          La Línea 024 ofrece atención a la conducta suicida y apoyo a familiares y personas
          cercanas. Si hay peligro inmediato, llama al 112.
        </p>
      )}
      {(destino === '112' || destino === 'urgencias' || apoyo) && (
        <a
          href="tel:112"
          className="flex min-h-12 items-center justify-center rounded-xl bg-cruz p-3 text-lg font-semibold text-white"
        >
          Llamar al 112{destino === '112' ? '' : ' si hay peligro inmediato'}
        </a>
      )}
      {apoyo && (
        <a
          href="tel:024?oai_link_source=model_response_hotline"
          className="flex min-h-12 items-center justify-center rounded-xl bg-white p-3 text-lg font-semibold text-cruz ring-1 ring-cruz"
        >
          Llamar al 024
        </a>
      )}
      <p className="text-base">No elijas un tratamiento por tu cuenta con esta señal de alarma.</p>
    </section>
  );
}
