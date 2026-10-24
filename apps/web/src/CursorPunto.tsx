import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { instalarCursorPunto } from './controlCursorPunto';

export function CursorPunto() {
  const punto = useRef<HTMLDivElement>(null);
  const [dialogo, setDialogo] = useState<HTMLDialogElement | null>(null);
  useEffect(() => {
    const actualizar = () => {
      const destino =
        Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1) ?? null;
      setDialogo((actual) => (actual === destino ? actual : destino));
    };
    // Un z-index no puede dibujar por encima de la capa superior de showModal().
    const observador = new MutationObserver(actualizar);
    observador.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['open'],
    });
    actualizar();
    return () => observador.disconnect();
  }, []);
  useEffect(() => {
    if (punto.current) return instalarCursorPunto(punto.current);
  }, [dialogo]);
  const cursor = (
    <div ref={punto} aria-hidden="true" className="cursor-punto" hidden>
      <svg className="cursor-punto-ojo-icono" viewBox="0 0 28 20" fill="none">
        <path d="M2 10c3-5 7-8 12-8s9 3 12 8c-3 5-7 8-12 8S5 15 2 10Z" />
        <circle cx="14" cy="10" r="4" />
        <circle className="cursor-punto-ojo-reflejo" cx="15" cy="9" r="1" />
      </svg>
    </div>
  );
  return dialogo ? createPortal(cursor, dialogo) : cursor;
}
