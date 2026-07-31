import * as THREE from 'three';
import { SelectionOverlay } from './SelectionOverlay';

/**
 * World-space bounding box of a subtree, excluding selection halos.
 *
 * `Box3.expandByObject(mesh)` recurses into `mesh`'s children on its own, so
 * calling it only on non-halo nodes found via `traverse` doesn't actually
 * exclude a halo — the halo is a child of the selected mesh, and
 * `expandByObject` pulls its (1.045×-scaled) geometry in through its parent
 * regardless of whether the halo itself was skipped. Building the box from
 * each mesh's own geometry, transformed by its own world matrix, sidesteps
 * that recursion entirely.
 */
export function worldBoundsExcludingHalos(root: THREE.Object3D): THREE.Box3 | null {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let found = false;

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || SelectionOverlay.isHalo(mesh)) return;
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    box.union(geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld));
    found = true;
  });

  return found && !box.isEmpty() ? box : null;
}

/** Combined world bounding box across several parts' roots, halos excluded. */
export function combinedWorldBounds(roots: readonly (THREE.Object3D | undefined)[]): THREE.Box3 | null {
  const box = new THREE.Box3();
  let found = false;
  for (const root of roots) {
    if (!root) continue;
    const partBox = worldBoundsExcludingHalos(root);
    if (!partBox) continue;
    box.union(partBox);
    found = true;
  }
  return found ? box : null;
}
