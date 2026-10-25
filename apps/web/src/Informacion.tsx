import { AVISO_LEGAL, InformacionPublica } from '@rebotica/shared';
import { useEffect, useRef, useState } from 'react';
import { EstadoCatalogo } from './escena/EstadoCatalogo';

export default function Informacion() {
  const titulo = useRef<HTMLHeadingElement>(null);
  const [datos, setDatos] = useState<InformacionPublica | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
    const control = new AbortController();
    void fetch('/api/informacion', { signal: control.signal, cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = InformacionPublica.parse(await r.json());
        if (!control.signal.aborted) setDatos(d);
      })
      .catch(() => {
        if (!control.signal.aborted) setError(true);
      });
    return () => control.abort();
  }, []);
  const enlace = 'font-medium text-cruz underline';
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 text-base leading-relaxed">
      <a href="/" className="inline-flex min-h-11 items-center font-semibold text-cruz">
        ← Volver al inicio
      </a>
      <main className="mt-5 space-y-8">
        <header>
          <h1
            ref={titulo}
            tabIndex={-1}
            className="text-3xl font-semibold tracking-tight outline-none"
          >
            Privacidad y fuentes
          </h1>
          <p className="mt-3 text-tinta-suave">
            Cómo funciona Rebotica 3D y qué ocurre con los datos que introduces.
          </p>
        </header>
        <section aria-labelledby="consulta-datos">
          <h2 id="consulta-datos" className="text-xl font-semibold">
            Consulta y uso de Gemini
          </h2>
          <div className="mt-3 space-y-3">
            <p>
              Al elegir una consulta frecuente se envía al servidor solo su identificador. Ese
              recorrido no necesita enviar texto a Gemini.
            </p>
            <p>
              Al pulsar «Realizar consulta», el texto escrito se envía al servidor. Primero se
              aplica un filtro local de alarmas. Si no activa una derivación y la interpretación
              está configurada, el servidor envía el texto a Google Gemini para identificar la
              dolencia y detectar otras alarmas.
            </p>
            <p>
              Gemini no elige medicamentos ni calcula dosis. Los resultados se buscan en las
              indicaciones oficiales de la copia local de CIMA.
            </p>
            <p>
              No incluyas nombres, teléfonos, direcciones ni otros datos que identifiquen a una
              persona.
            </p>
            <details className="rounded-xl bg-white p-4 ring-1 ring-black/10">
              <summary className="min-h-11 cursor-pointer font-semibold">
                Qué puede conservar Google
              </summary>
              <div className="mt-2 space-y-3">
                <p>
                  Que Rebotica no guarde el texto no significa que Google lo borre inmediatamente.
                  El tratamiento y la retención del proveedor dependen de sus condiciones y de la
                  configuración del proyecto. Esta página no certifica esa configuración.
                </p>
                <p>
                  Consulta las{' '}
                  <a
                    className={enlace}
                    href="https://ai.google.dev/gemini-api/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    condiciones de Gemini API
                  </a>{' '}
                  y la información sobre{' '}
                  <a
                    className={enlace}
                    href="https://ai.google.dev/gemini-api/docs/logs-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    registros y uso de datos en Google
                  </a>
                  .
                </p>
              </div>
            </details>
          </div>
        </section>
        <section aria-labelledby="almacenamiento">
          <h2 id="almacenamiento" className="text-xl font-semibold">
            Datos y almacenamiento
          </h2>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>
              No hay cuentas. El recorrido de consulta no guarda el texto libre ni las respuestas en
              la base de datos o en los registros de sus rutas.
            </li>
            <li>
              El borrador vive en la memoria de la pestaña y se borra al empezar una nueva consulta
              o abandonar la página. Los filtros y la comparación también se mantienen en memoria;
              no se escriben en la URL ni en almacenamiento persistente.
            </li>
            <li>
              La edad, el peso y las condiciones de la calculadora se procesan en tu dispositivo,
              sin enviarse al servidor. Se limpian al salir de la página.
            </li>
            <li>
              Se guarda únicamente la preferencia de vista, lista o 3D, en el almacenamiento local
              del navegador. La aplicación instalable conserva sus archivos para poder abrirse; su
              caché no guarda consultas ni respuestas de Gemini. El navegador puede conservar fichas
              y fotos públicas según sus cabeceras de caché.
            </li>
            <li>
              Se conservan conteos diarios de consultas por dolencia, sin texto, IP ni
              identificadores de personas. Estos conteos agregados no tienen borrado automático
              configurado.
            </li>
            <li>
              Los registros técnicos de acceso del servidor o del alojamiento pueden contener IP,
              fecha y ruta solicitada. Su conservación depende de la configuración de esa
              infraestructura.
            </li>
          </ul>
        </section>
        <section aria-labelledby="fuentes">
          <h2 id="fuentes" className="text-xl font-semibold">
            Fuentes y límites del catálogo
          </h2>
          <div className="mt-3 space-y-3">
            <p>
              Los medicamentos, sus fichas técnicas, prospectos y fotos proceden de{' '}
              <a
                className={enlace}
                href="https://cima.aemps.es/cima/publico/home.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                CIMA, de la AEMPS
              </a>
              . La app sirve una copia local sincronizada; la información puede cambiar y una ficha
              puede no estar completa en esa copia.
            </p>
            <p>
              Las asociaciones por dolencia usan búsquedas textuales en la sección 4.1. No son una
              validación clínica de idoneidad. Agrupar organiza los resultados, manteniendo la
              separación entre medicamentos sin receta y con receta.
            </p>
            <p>
              Las cajas 3D son representaciones generadas a partir de datos del catálogo. Las fotos
              identificadas como CIMA son imágenes oficiales del envase. Cada ficha incluye sus
              enlaces oficiales.
            </p>
            {datos?.catalogo ? (
              <EstadoCatalogo datos={datos.catalogo} />
            ) : (
              datos && (
                <p className="text-tinta-suave">
                  El estado de sincronización del catálogo no está disponible ahora.
                </p>
              )
            )}
          </div>
        </section>
        <section aria-labelledby="versiones">
          <h2 id="versiones" className="text-xl font-semibold">
            Reglas y versiones
          </h2>
          <div className="mt-3 space-y-3">
            <p>
              La calculadora utiliza código determinista y solo aparece con una regla validada que
              coincida con la sección 4.2 de la ficha disponible. Los borradores o las reglas
              desactualizadas no habilitan el cálculo.
            </p>
            <p>
              La pestaña Dosis permite consultar el identificador, la versión, la revisión y la cita
              de la regla que se utiliza. Si no hay regla válida, se muestra la posología oficial en
              texto. El catálogo informativo no exige un cuestionario clínico.
            </p>
            {datos ? (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-white p-4 ring-1 ring-black/10">
                <dt>Aplicación</dt>
                <dd className="break-words">{datos.versionApp}</dd>
                <dt>Motor de dosis</dt>
                <dd>{datos.versionMotorDosis}</dd>
                <dt>Correspondencias</dt>
                <dd>Versión {datos.versionCorrespondencias}</dd>
                <dt>Interpretación IA</dt>
                <dd>{datos.interpretacionConfigurada ? 'Configurada' : 'No disponible'}</dd>
              </dl>
            ) : (
              <p role="status" className="text-tinta-suave">
                {error
                  ? 'No se pueden consultar ahora las versiones del despliegue. La información de funcionamiento sigue disponible.'
                  : 'Consultando versiones del despliegue…'}
              </p>
            )}
          </div>
        </section>
      </main>
      <footer className="mt-8 border-t border-black/10 pt-4 text-sm text-tinta-suave">
        <p>{AVISO_LEGAL}</p>
      </footer>
    </div>
  );
}
