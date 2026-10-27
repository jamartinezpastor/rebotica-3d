import type { MouseEvent } from 'react';
import { CruzMarca } from './CruzMarca';

export function MarcaInicio({
  onInicio,
  className = '',
}: {
  onInicio?: () => void;
  className?: string;
}) {
  const volver = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!onInicio || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onInicio();
  };
  return (
    <a
      href="/"
      onClick={volver}
      title="Ir al inicio"
      className={`inline-flex min-h-12 items-center gap-2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cruz ${className}`}
    >
      <CruzMarca />
      <span>REBOTICA</span>
    </a>
  );
}
