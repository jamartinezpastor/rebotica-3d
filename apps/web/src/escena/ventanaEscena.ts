/** Ventana de estanterías GPU; los destinos del raíl conservan el modelo completo. */
export function ventanaEstanterias(
  total: number,
  centro: number,
  radio: number,
  protegida?: number,
): number[] {
  if (total <= 0) return [];
  const actual = Math.max(0, Math.min(total - 1, centro));
  const indices = new Set<number>();
  for (let i = Math.max(0, actual - radio); i <= Math.min(total - 1, actual + radio); i++)
    indices.add(i);
  if (protegida !== undefined && protegida >= 0 && protegida < total) indices.add(protegida);
  return [...indices].sort((a, b) => a - b);
}
