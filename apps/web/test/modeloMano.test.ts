import { Box3, Mesh, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { crearModeloMano } from '../src/escena/modeloMano';

describe('modelo tridimensional de la mano', () => {
  it('tiene grosor, normales, mallas iluminadas y los cinco dedos', () => {
    const mano = crearModeloMano();
    try {
      const tamano = new Box3().setFromObject(mano.grupo).getSize(new Vector3());
      expect(tamano.z).toBeGreaterThan(0.5);
      for (const dedo of ['pulgar', 'indice', 'corazon', 'anular', 'menique']) {
        expect(mano.grupo.getObjectByName(dedo)).toBeDefined();
      }
      mano.grupo.traverse((objeto) => {
        if (objeto instanceof Mesh) {
          expect(objeto.geometry.getAttribute('normal')).toBeDefined();
          expect(objeto.castShadow && objeto.receiveShadow).toBe(true);
        }
      });
    } finally {
      mano.liberar();
    }
  });

  it('dobla las falanges y reduce la altura al cerrar; abrir recupera la geometría', () => {
    const mano = crearModeloMano();
    try {
      const abierta = new Box3().setFromObject(mano.grupo);
      mano.cerrar(1);
      const cerrada = new Box3().setFromObject(mano.grupo);
      expect(cerrada.max.y).toBeLessThan(abierta.max.y - 0.5);
      expect(mano.grupo.getObjectByName('indice-media')?.rotation.x).toBeLessThan(-1);
      mano.cerrar(0);
      expect(new Box3().setFromObject(mano.grupo).equals(abierta)).toBe(true);
    } finally {
      mano.liberar();
    }
  });

  it('recoge el pulgar sobre la cara palmar al cerrar, por debajo de los nudillos', () => {
    const mano = crearModeloMano();
    try {
      mano.cerrar(1);
      mano.grupo.updateMatrixWorld(true);
      const falange = mano.grupo.getObjectByName('pulgar-punta')!;
      const punta = falange.localToWorld(new Vector3(0, 0.52, 0));
      // La palma mira a -Z; una punta sobre el dorso (+Z) reproduciría el fallo anterior.
      expect(punta.z).toBeLessThan(-0.31);
      expect(punta.y).toBeLessThan(0.25);
      expect(Math.abs(punta.x)).toBeLessThan(0.65);
    } finally {
      mano.liberar();
    }
  });

  it('libera geometrías compartidas y materiales al desmontar', () => {
    const mano = crearModeloMano();
    const malla = mano.grupo.children.find((o) => o instanceof Mesh) as Mesh;
    const liberarGeometria = vi.spyOn(malla.geometry, 'dispose');
    mano.liberar();
    expect(liberarGeometria).toHaveBeenCalledTimes(1);
  });
});
