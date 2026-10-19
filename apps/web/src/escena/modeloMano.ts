import {
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';

/** Guante tridimensional: palma con grosor, cinco dedos articulados, uñas y puño. */
export function crearModeloMano() {
  const grupo = new Group();
  grupo.name = 'mano-cursor-3d';
  const esfera = new SphereGeometry(1, 20, 14);
  const capsula = new CapsuleGeometry(1, 2, 6, 12);
  const muneca = new CylinderGeometry(0.43, 0.4, 0.32, 20);
  const guante = new MeshPhysicalMaterial({
    color: '#f5eee1',
    roughness: 0.36,
    clearcoat: 0.22,
    clearcoatRoughness: 0.3,
    metalness: 0,
  });
  const una = new MeshPhysicalMaterial({ color: '#d6ded8', roughness: 0.28, clearcoat: 0.4 });
  const puno = new MeshPhysicalMaterial({ color: '#147149', roughness: 0.5 });

  function pieza(
    padre: Group,
    geometria: BufferGeometry,
    material: Material,
    posicion: [number, number, number],
    escala: [number, number, number],
  ) {
    const mesh = new Mesh(geometria, material);
    mesh.position.set(...posicion);
    mesh.scale.set(...escala);
    mesh.castShadow = mesh.receiveShadow = true;
    padre.add(mesh);
    return mesh;
  }
  pieza(grupo, esfera, guante, [0, -0.03, 0], [0.78, 0.84, 0.31]);
  pieza(grupo, esfera, guante, [-0.55, -0.32, 0.02], [0.35, 0.47, 0.3]);
  pieza(grupo, esfera, guante, [0, -0.82, -0.01], [0.44, 0.42, 0.26]);
  pieza(grupo, muneca, puno, [0, -1.09, -0.01], [1, 1, 0.72]);

  const dedos: { raiz: Group; media: Group; punta: Group; apertura: number }[] = [];
  const medidas = [
    {
      nombre: 'indice',
      x: -0.56,
      y: 0.59,
      radio: 0.155,
      largos: [0.66, 0.48, 0.35],
      apertura: 0.1,
    },
    {
      nombre: 'corazon',
      x: -0.18,
      y: 0.7,
      radio: 0.17,
      largos: [0.74, 0.53, 0.37],
      apertura: 0.025,
    },
    {
      nombre: 'anular',
      x: 0.22,
      y: 0.65,
      radio: 0.16,
      largos: [0.67, 0.49, 0.35],
      apertura: -0.055,
    },
    {
      nombre: 'menique',
      x: 0.57,
      y: 0.48,
      radio: 0.135,
      largos: [0.53, 0.39, 0.3],
      apertura: -0.17,
    },
  ];
  function falange(padre: Group, nombre: string, largo: number, radio: number, origen: number) {
    const articulacion = new Group();
    articulacion.name = nombre;
    articulacion.position.y = origen;
    padre.add(articulacion);
    pieza(articulacion, capsula, guante, [0, largo / 2, 0], [radio, largo / 4, radio]);
    pieza(articulacion, esfera, guante, [0, 0.04, 0], [radio * 1.02, radio * 0.95, radio]);
    return articulacion;
  }
  for (const m of medidas) {
    const raiz = falange(grupo, m.nombre, m.largos[0]!, m.radio, m.y);
    raiz.position.x = m.x;
    const media = falange(
      raiz,
      `${m.nombre}-media`,
      m.largos[1]!,
      m.radio * 0.9,
      m.largos[0]! * 0.88,
    );
    const punta = falange(
      media,
      `${m.nombre}-punta`,
      m.largos[2]!,
      m.radio * 0.8,
      m.largos[1]! * 0.88,
    );
    pieza(
      punta,
      esfera,
      una,
      [0, m.largos[2]! * 0.62, m.radio * 0.78],
      [m.radio * 0.64, m.largos[2]! * 0.25, 0.022],
    );
    dedos.push({ raiz, media, punta, apertura: m.apertura });
  }
  const pulgar = falange(grupo, 'pulgar', 0.63, 0.2, -0.35);
  pulgar.position.x = -0.66;
  pulgar.position.z = 0.06;
  const puntaPulgar = falange(pulgar, 'pulgar-punta', 0.52, 0.175, 0.56);
  pieza(puntaPulgar, esfera, una, [0, 0.34, 0.16], [0.12, 0.14, 0.025]);
  function cerrar(cierre: number) {
    const u = Math.max(0, Math.min(1, cierre));
    for (const dedo of dedos) {
      dedo.raiz.rotation.set(-0.08 - u * 1.14, 0, dedo.apertura * (1 - u));
      dedo.media.rotation.x = -0.06 - u * 1.58;
      dedo.punta.rotation.x = -0.04 - u * 1.03;
    }
    // Dorso en +Z y palma en -Z: el pulgar se opone por la cara palmar al cerrar.
    pulgar.position.set(-0.66, -0.35 - u * 0.08, 0.06 - u * 0.18);
    pulgar.rotation.set(0.15 - u * 1.25, -0.15 + u * 0.25, 0.95 - u * 2.1);
    puntaPulgar.rotation.x = -0.12 - u * 0.65;
  }
  cerrar(0);
  return {
    grupo,
    cerrar,
    liberar() {
      esfera.dispose();
      capsula.dispose();
      muneca.dispose();
      guante.dispose();
      una.dispose();
      puno.dispose();
    },
  };
}
