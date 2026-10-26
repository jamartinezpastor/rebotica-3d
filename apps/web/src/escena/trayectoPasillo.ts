/** Coordenada del raíl antes/después de la esquina y posición de la pared derecha. */
export interface EsquinaRiel {
  inicio: number;
  fin: number;
  x: number;
}

/** El raíl lógico sigue siendo continuo, aunque el segundo tramo mire 90° a la derecha. */
export function marcoEnRiel(s: number, esquina?: EsquinaRiel) {
  if (!esquina || (esquina.inicio !== esquina.fin && s <= esquina.inicio))
    return { x: s, z: 0, giro: 0 };
  if (esquina.inicio === esquina.fin || s >= esquina.fin)
    return { x: esquina.x, z: s - esquina.x, giro: -Math.PI / 2 };
  const t = (s - esquina.inicio) / (esquina.fin - esquina.inicio);
  const u = 1 - t;
  const dx = esquina.x - esquina.inicio;
  const dz = esquina.fin - esquina.x;
  return {
    x: u ** 3 * esquina.inicio + (1 - u ** 3) * esquina.x,
    z: t ** 3 * dz,
    giro: -Math.atan2(t * t * dz, u * u * dx),
  };
}
