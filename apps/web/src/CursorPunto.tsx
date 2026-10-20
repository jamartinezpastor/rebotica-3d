import { useEffect, useRef } from 'react';
import { instalarCursorPunto } from './controlCursorPunto';

export function CursorPunto() {
  const punto = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (punto.current) return instalarCursorPunto(punto.current);
  }, []);
  return (
    <div ref={punto} aria-hidden="true" className="cursor-punto" hidden>
      <svg className="cursor-punto-ojo-icono" viewBox="0 0 28 20" fill="none">
        <path d="M2 10c3-5 7-8 12-8s9 3 12 8c-3 5-7 8-12 8S5 15 2 10Z" />
        <circle cx="14" cy="10" r="4" />
        <circle className="cursor-punto-ojo-reflejo" cx="15" cy="9" r="1" />
      </svg>
    </div>
  );
}
