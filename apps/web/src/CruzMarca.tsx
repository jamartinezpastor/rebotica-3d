const CONTORNO = [
  [12, 0],
  [24, 0],
  [24, 12],
  [36, 12],
  [36, 24],
  [24, 24],
  [24, 36],
  [12, 36],
  [12, 24],
  [0, 24],
  [0, 12],
  [12, 12],
] as const;

/** Cruz extruida en CSS: volumen real en perspectiva sin cargar el motor de la escena. */
export function CruzMarca() {
  return (
    <span className="cruz-marca" aria-hidden="true">
      <span className="cruz-volumen">
        <span className="cruz-cara cruz-frente" />
        <span className="cruz-cara cruz-reverso" />
        {CONTORNO.map(([x, y], i) => {
          const [finX, finY] = CONTORNO[(i + 1) % CONTORNO.length]!;
          const dx = finX - x;
          const dy = finY - y;
          return (
            <span
              key={i}
              className="cruz-canto"
              style={{
                width: Math.hypot(dx, dy),
                backgroundColor: dx > 0 ? '#23a064' : dx < 0 ? '#04592e' : '#076e3a',
                transform: `translate3d(${x}px,${y}px,-3px) rotateZ(${Math.atan2(dy, dx)}rad) rotateX(90deg)`,
              }}
            />
          );
        })}
      </span>
    </span>
  );
}
