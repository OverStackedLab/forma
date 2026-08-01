import { resolveAppearance } from './catalog';
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
 * Every part is either a box (panels) or a cylinder (round hardware like
 * knobs), sharing one unit geometry per shape scaled per instance, so
 * changing a dimension is a scale write rather than a geometry allocation.
 * The cache owns the geometry; never dispose it from a rebuild loop.
 */
export class GeometryCache {
  private box: TBufferGeometry | null = null;
  private cylinder: TBufferGeometry | null = null;

  constructor(private readonly THREE: ThreeModule) {}

  /** 1×1×1 box centred on the origin, shared by every box-shaped part. */
  unitBox(): TBufferGeometry {
    if (!this.box) this.box = new this.THREE.BoxGeometry(1, 1, 1);
    return this.box;
  }

  /** Rounded unit knob centred on the origin, projecting along world Z. */
  unitCylinder(): TBufferGeometry {
    if (!this.cylinder) {
      const profile = [
        new this.THREE.Vector2(0, -0.5),
        new this.THREE.Vector2(0.42, -0.5),
        new this.THREE.Vector2(0.48, -0.45),
        new this.THREE.Vector2(0.5, -0.35),
        new this.THREE.Vector2(0.5, 0.35),
        new this.THREE.Vector2(0.48, 0.45),
        new this.THREE.Vector2(0.42, 0.5),
        new this.THREE.Vector2(0, 0.5),
      ];
      this.cylinder = new this.THREE.LatheGeometry(profile, 48);
      this.cylinder.rotateX(Math.PI / 2);
      this.cylinder.computeVertexNormals();
    }
    return this.cylinder;
  }

  dispose(): void {
    this.box?.dispose();
    this.box = null;
    this.cylinder?.dispose();
    this.cylinder = null;
  }
}

/**
 * Shared PBR materials keyed by material + color id. The prototype allocated
 * one material per mesh; these are owned here and must be exempt from any
 * traverse-and-dispose loop.
 */
export class MaterialCache {
  private readonly cache = new Map<string, TMaterial>();

  constructor(private readonly THREE: ThreeModule) {}

  body(materialId: string | undefined, colorId: string | undefined): TMaterial {
    const appearance = resolveAppearance(materialId, colorId);
    const key = `${materialId ?? ''}:${colorId ?? ''}`;
    let m = this.cache.get(key);
    if (!m) {
      m = new this.THREE.MeshStandardMaterial({
        color: appearance.color,
        roughness: appearance.roughness,
        metalness: appearance.metalness,
      });
      this.cache.set(key, m);
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
  const geometry = spec.shape === 'cylinder' ? geometries.unitCylinder() : geometries.unitBox();
  const mesh = new THREE.Mesh(geometry, material);
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
