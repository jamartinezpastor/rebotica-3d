import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  MathUtils,
  PerspectiveCamera,
  Scene,
  Vector4,
} from 'three';
import { instalarCursor3D, type EstadoCursorMano } from './cursorMano';
import { crearModeloMano } from './modeloMano';

const ANCHO = 112;
const ALTO = 132;

function crearVistaMano() {
  const modelo = crearModeloMano();
  const escena = new Scene();
  const camara = new PerspectiveCamera(38, ANCHO / ALTO, 0.1, 30);
  camara.position.set(0, 0.55, 7.6);
  camara.lookAt(0, 0.55, 0);
  const principal = new DirectionalLight('#fff6e6', 3.2);
  principal.position.set(-3, 5, 7);
  principal.castShadow = true;
  principal.shadow.mapSize.set(512, 512);
  principal.shadow.camera.left = principal.shadow.camera.bottom = -3;
  principal.shadow.camera.right = principal.shadow.camera.top = 3;
  principal.shadow.camera.near = 0.1;
  principal.shadow.camera.far = 20;
  principal.shadow.normalBias = 0.015;
  principal.shadow.bias = -0.0004;
  const relleno = new DirectionalLight('#d7e9ff', 1.2);
  relleno.position.set(4, 0, 3);
  const borde = new DirectionalLight('#d9ffec', 2);
  borde.position.set(2, 3, -4);
  escena.add(
    modelo.grupo,
    principal,
    principal.target,
    relleno,
    borde,
    new HemisphereLight('#ffffff', '#38493f', 1),
  );
  return {
    modelo,
    escena,
    camara,
    liberar() {
      principal.shadow.dispose();
      modelo.liberar();
    },
  };
}

/** Mano de mallas reales, iluminada y articulada, sobre el mismo contexto WebGL del pasillo. */
export function Cursor3D() {
  const lienzo = useThree((s) => s.gl.domElement);
  const invalidar = useThree((s) => s.invalidate);
  const vista = useMemo(() => crearVistaMano(), []);
  const estado = useRef<EstadoCursorMano | null>(null);
  const viewport = useMemo(() => new Vector4(), []);
  const recorte = useMemo(() => new Vector4(), []);
  useEffect(
    () =>
      instalarCursor3D(lienzo, (nuevo) => {
        estado.current = nuevo;
        invalidar();
      }),
    [lienzo, invalidar],
  );
  useEffect(() => () => vista.liberar(), [vista]);

  // R3F v9: prioridad positiva toma el render. Primero el pasillo; luego la región del cursor.
  useFrame(({ gl, scene, camera, size }) => {
    gl.render(scene, camera);
    const cursor = estado.current;
    if (!cursor?.visible) return;
    // Sobre una caja seleccionable se muestra el ojo; al arrastrar manda la mano cerrada.
    if (lienzo.dataset.cursor === 'medicamento' && !cursor.cerrada) return;
    const rect = lienzo.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = ((cursor.x - rect.left) * size.width) / rect.width;
    const y = ((cursor.y - rect.top) * size.height) / rect.height;
    vista.modelo.grupo.rotation.set(
      -0.24 + MathUtils.degToRad(cursor.giroX),
      -0.4 + MathUtils.degToRad(cursor.giroY),
      -0.08 + MathUtils.degToRad(cursor.giroZ),
    );
    vista.modelo.cerrar(cursor.cierre);
    gl.getViewport(viewport);
    gl.getScissor(recorte);
    const recortando = gl.getScissorTest();
    const limpiar = gl.autoClear;
    const sombras = gl.shadowMap.enabled;
    const actualizarSombras = gl.shadowMap.autoUpdate;
    const tonos = gl.toneMapping;
    const exposicion = gl.toneMappingExposure;
    try {
      gl.autoClear = false;
      // Conserva luces y curvatura en el guante claro, incluso con el pasillo sin tone mapping.
      gl.toneMapping = ACESFilmicToneMapping;
      gl.toneMappingExposure = 0.95;
      gl.shadowMap.enabled = gl.shadowMap.autoUpdate = true;
      gl.setViewport(x - ANCHO / 2, size.height - y - ALTO / 2, ANCHO, ALTO);
      gl.setScissor(x - ANCHO / 2, size.height - y - ALTO / 2, ANCHO, ALTO);
      gl.setScissorTest(true);
      gl.clearDepth();
      gl.render(vista.escena, vista.camara);
    } finally {
      gl.setViewport(viewport);
      gl.setScissor(recorte);
      gl.setScissorTest(recortando);
      gl.autoClear = limpiar;
      gl.shadowMap.enabled = sombras;
      gl.shadowMap.autoUpdate = actualizarSombras;
      gl.toneMapping = tonos;
      gl.toneMappingExposure = exposicion;
    }
  }, 1);
  return null;
}
