export function CargaVisual({ texto, compacta = false }: { texto: string; compacta?: boolean }) {
  return (
    <div className={compacta ? '' : 'mx-auto max-w-2xl p-6'}>
      <p role="status" className="text-base text-tinta-suave">
        {texto}
      </p>
      <div aria-hidden="true" className="mt-4 space-y-3 motion-safe:animate-pulse">
        {Array.from({ length: compacta ? 2 : 3 }, (_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5"
          >
            <span className="h-16 w-16 shrink-0 rounded-lg bg-cruz-claro" />
            <span className="flex-1 space-y-2">
              <span className="block h-3 w-4/5 rounded bg-black/10" />
              <span className="block h-3 w-3/5 rounded bg-black/5" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
