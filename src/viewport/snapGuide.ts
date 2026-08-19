import * as THREE from 'three';
import type { FaceSnapGuide } from './faceSnap';
import type { SceneManager } from './SceneManager';

const GUIDE_COLOR = 0x4fa3ff;

/**
 * World-space rectangle drawn on the face a live gizmo snap would hit.
 * Not parented to parts, so it is never framed, exported, or raycast.
 */
export class SnapGuide {
  private readonly group = new THREE.Group();
  private readonly material = new THREE.LineBasicMaterial({
    color: GUIDE_COLOR,
    depthTest: false,
  });
  private readonly lines: THREE.Line[] = [];

  constructor(scene: SceneManager) {
    this.group.renderOrder = 10;
    this.group.raycast = () => {};
    scene.scene.add(this.group);
  }

  setGuides(guides: readonly FaceSnapGuide[]): void {
    this.clear();
    for (const guide of guides) {
      const points = guide.corners.map(([x, y, z]) => new THREE.Vector3(x, y, z));
      points.push(points[0]!.clone());
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, this.material);
      line.frustumCulled = false;
      line.raycast = () => {};
      this.group.add(line);
      this.lines.push(line);
    }
  }

  clear(): void {
    for (const line of this.lines) {
      line.removeFromParent();
      line.geometry.dispose();
    }
    this.lines.length = 0;
  }

  dispose(): void {
    this.clear();
    this.group.removeFromParent();
    this.material.dispose();
  }
}
