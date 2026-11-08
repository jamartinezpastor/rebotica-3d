import type { IdPestana } from './fichaSecciones';

export function IconoFicha({ tipo }: { tipo: IdPestana | 'suministro' | 'seguridad' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {tipo === 'uso' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v6M12 7h.01" />
        </>
      )}
      {tipo === 'precauciones' && (
        <>
          <path d="m12 3 10 18H2L12 3Z" />
          <path d="M12 9v5M12 17h.01" />
        </>
      )}
      {tipo === 'dosis' && (
        <>
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M8 6h8v3H8zM8 13h1M15 13h1M8 17h1M15 17h1" />
        </>
      )}
      {tipo === 'suministro' && (
        <>
          <path d="M3 17H2V5h12v12H7M14 9h4l4 5v3h-3M14 17h1" />
          <circle cx="5" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </>
      )}
      {tipo === 'seguridad' && (
        <>
          <path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z" />
          <path d="m8 12 3 3 5-6" />
        </>
      )}
    </svg>
  );
}
