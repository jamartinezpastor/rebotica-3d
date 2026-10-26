import { useEffect, useState, type RefObject } from 'react';
import { useMenosMovimiento } from '../useMenosMovimiento';

/** Decoración desenfocada, sin hitboxes ni texto; anima sin redibujar el lienzo de productos. */
export function FondoFarmacia({
  animado = true,
  referencia,
}: {
  animado?: boolean;
  referencia?: RefObject<HTMLDivElement | null>;
}) {
  const [visible, setVisible] = useState(() => !document.hidden);
  const menosMovimiento = useMenosMovimiento();
  useEffect(() => {
    const cambiar = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', cambiar);
    return () => document.removeEventListener('visibilitychange', cambiar);
  }, []);
  return (
    <div
      ref={referencia}
      className="fondo-farmacia"
      aria-hidden="true"
      data-en-movimiento={animado && visible && !menosMovimiento}
    >
      <div className="camara-farmacia">
        {['frente', 'derecha', 'detras', 'izquierda'].map((pared) => (
          <div key={pared} className={`pared-farmacia pared-${pared}`}>
            <div className="farmacia-lejana" />
            {['a', 'b', 'c'].map((lado) => (
              <div key={lado} className={`persona-fondo sanitario sanitario-${lado}`}>
                <i className="cabeza-fondo" />
                <i className="cuerpo-fondo" />
                <i className="brazo-fondo">
                  <b className="envase-fondo" />
                </i>
                <i className="pierna-fondo pierna-a" />
                <i className="pierna-fondo pierna-b" />
              </div>
            ))}
            {['a', 'b'].map((cliente) => (
              <div key={cliente} className={`cliente-cruzando cliente-${cliente}`}>
                <div className="persona-fondo cliente-fondo">
                  <i className="cabeza-fondo" />
                  <i className="cuerpo-fondo" />
                  <i className="brazo-fondo" />
                  <i className="pierna-fondo pierna-a" />
                  <i className="pierna-fondo pierna-b" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
