import { AVISO_RECETA } from '@rebotica/shared';

export function AvisoReceta() {
  return (
    <p
      role="note"
      className="rounded-xl border-2 border-amber-700 bg-amber-50 px-3 py-2 text-base text-amber-950"
    >
      <strong>⚠ Precaución. </strong>
      {AVISO_RECETA}
    </p>
  );
}
