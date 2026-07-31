import { findFinish } from './catalog';
import type { PartSpec } from './types';

/**
 * three.js is injected rather than imported so this module stays unit-testable
 * in Node and three.js stays code-splittable. `import type` is fully erased.
 */
export type ThreeModule = typeof import('three');
type TObject3D = import('three').Object3D;
type TMesh = import('three').Mesh;
type TBufferGeometry = import('three').BufferGeometry;
type TMaterial = import('three').MeshStandardMaterial;

/** Millimetres to three.js world units (metres). */
const MM = 1 / 1000;

/**
 * Every part is a library panel — a plain box — sharing one unit geometry
 * scaled per instance, so changing a dimension is a scale write rather than a
 * geometry allocation. The cache owns the geometry; never dispose it from a
 * rebuild loop.
 */
export class GeometryCache {
  private box: TBufferGeometry | null = null;

  constructor(private readonly THREE: ThreeModule) {}

  /** 1×1×1 box centred on the origin, shared by every part. */
  unitBox(): TBufferGeometry {
    if (!this.box) this.box = new this.THREE.BoxGeometry(1, 1, 1);
    return this.box;
  }

  dispose(): void {
    this.box?.dispose();
    this.box = null;
  }
}

/**
 * Shared PBR materials keyed by finish id. The prototype allocated one
 * material per mesh; these are owned here and must be exempt from any
 * traverse-and-dispose loop.
 */
export class MaterialCache {
  private readonly cache = new Map<string, TMaterial>();

  constructor(private readonly THREE: ThreeModule) {}

  body(finishId: string | undefined): TMaterial {
    const f = findFinish(finishId);
    let m = this.cache.get(f.id);
    if (!m) {
      m = new this.THREE.MeshStandardMaterial({
        color: f.color,
        roughness: f.roughness,
        metalness: f.metalness,
      });
      this.cache.set(f.id, m);
    }
    return m;
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
  }
}

/**
 * A part in the scene. `root` carries placement (and is what the gizmo
 * attaches to and the manual transform is written onto); the mesh beneath it
 * carries size via scale.
 */
export type PartNode = {
  id: string;
  root: TObject3D;
  /** The mesh a selection halo attaches to. */
  highlightTarget: TMesh;
  /** Resizes in place — no allocation. */
  update(spec: PartSpec): void;
  setMaterial(material: TMaterial): void;
};

export function createPartNode(
  THREE: ThreeModule,
  geometries: GeometryCache,
  spec: PartSpec,
  material: TMaterial,
): PartNode {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(geometries.unitBox(), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  root.add(mesh);
  root.name = spec.id;
  root.userData.partId = spec.id;
  mesh.userData.partId = spec.id;

  const node: PartNode = {
    id: spec.id,
    root,
    highlightTarget: mesh,
    update(next) {
      mesh.scale.set(next.size.x * MM, next.size.y * MM, next.size.z * MM);
    },
    setMaterial(m) {
      mesh.material = m;
    },
  };
  node.update(spec);
  return node;
}
