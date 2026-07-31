import * as THREE from 'three';
import type { ModelBuilder } from './ModelBuilder';

const HALO_SCALE = 1.045;

/**
 * Draws the selection outline: a back-face clone of each selected mesh, scaled
 * slightly and parented to it so it follows every transform for free.
 *
 * Halos deliberately carry no `userData.partId`, so the pick raycast filters
 * them out, and they are excluded from framing so they don't inflate the box.
 */
export class SelectionOverlay {
  private readonly material = new THREE.MeshBasicMaterial({
    color: 0x4fa3ff,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.85,
  });
  private readonly halos = new Map<string, THREE.Mesh>();

  constructor(private readonly builder: ModelBuilder) {}

  static isHalo(object: THREE.Object3D): boolean {
    return object.userData.isSelectionHalo === true;
  }

  apply(selectedIds: readonly string[]): void {
    const wanted = new Set(selectedIds);

    for (const [id, halo] of this.halos) {
      if (!wanted.has(id) || this.builder.getHighlightTarget(id) !== halo.parent) {
        halo.removeFromParent();
        this.halos.delete(id);
      }
    }

    for (const id of wanted) {
      if (this.halos.has(id)) continue;
      const target = this.builder.getHighlightTarget(id);
      if (!target) continue;
      const halo = new THREE.Mesh(target.geometry, this.material);
      halo.scale.setScalar(HALO_SCALE);
      halo.userData.isSelectionHalo = true;
      halo.raycast = () => {};
      target.add(halo);
      this.halos.set(id, halo);
    }
  }

  dispose(): void {
    for (const halo of this.halos.values()) halo.removeFromParent();
    this.halos.clear();
    this.material.dispose();
  }
}
