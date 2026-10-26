/** Perspectiva equivalente al lienzo, con paralaje leve para un ambiente lejano. */
export function camaraFondo({
  giro,
  inclinacion,
  x,
  y,
  z,
  fov,
  alto,
}: {
  giro: number;
  inclinacion: number;
  x: number;
  y: number;
  z: number;
  fov: number;
  alto: number;
}) {
  const perspectiva = alto / (2 * Math.tan((fov * Math.PI) / 360));
  // El catálogo puede medir kilómetros: el ambiente lejano nunca sale de su envolvente.
  const lateral = -Math.atan(x / 12) * 80;
  const fondo = -Math.atan(z / 12) * 80;
  return {
    perspectiva: `${perspectiva}px`,
    transformacion: `translateZ(${perspectiva}px) rotateX(${inclinacion}rad) rotateY(${-giro}rad) translate3d(${lateral}px,${(y - 1) * 65}px,${fondo}px)`,
  };
}
