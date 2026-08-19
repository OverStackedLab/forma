import { resolveAppearance } from './catalog';
import { createOakGrainCanvas } from './oakGrain';
import type { PanelShape, PartSpec } from './types';

/**
 * three.js is injected rather than imported so this module stays unit-testable
 * in Node and three.js stays code-splittable. `import type` is fully erased.
 */
export type ThreeModule = typeof import('three');
type TObject3D = import('three').Object3D;
type TMesh = import('three').Mesh;
type TBufferGeometry = import('three').BufferGeometry;
type TMaterial = import('three').MeshStandardMaterial;
type TTexture = import('three').Texture;

/** Millimetres to three.js world units (metres). */
const MM = 1 / 1000;

/**
 * Every part shares one unit geometry per shape, scaled per instance, so
 * changing a dimension is a scale write rather than a geometry allocation.
 * The cache owns the geometry; never dispose it from a rebuild loop.
 */
export class GeometryCache {
  private box: TBufferGeometry | null = null;
  private cylinder: TBufferGeometry | null = null;
  private bagganas: TBufferGeometry | null = null;
  private eneryda: TBufferGeometry | null = null;
  private enhetLeg: TBufferGeometry | null = null;

  constructor(private readonly THREE: ThreeModule) {}

  /** 1×1×1 box centred on the origin, shared by every box-shaped part. */
  unitBox(): TBufferGeometry {
    if (!this.box) this.box = new this.THREE.BoxGeometry(1, 1, 1);
    return this.box;
  }

  /** Soft rounded knob centred on the origin, projecting along world Z. */
  unitCylinder(): TBufferGeometry {
    if (!this.cylinder) {
      this.cylinder = this.lathe([
        [0, -0.5],
        [0.42, -0.5],
        [0.48, -0.45],
        [0.5, -0.35],
        [0.5, 0.35],
        [0.48, 0.45],
        [0.42, 0.5],
        [0, 0.5],
      ]);
    }
    return this.cylinder;
  }

  /**
   * IKEA BAGGANÄS (903.384.17): flat Ø21 mm disc, long concave trumpet neck,
   * and a Ø5 mm mounting stem. Unit space maps diameter→X/Y and projection→Z.
   */
  unitBagganas(): TBufferGeometry {
    if (!this.bagganas) {
      const stem = (5 / 21) * 0.5;
      this.bagganas = this.lathe([
        [0, -0.5],
        [stem, -0.5],
        [stem, -0.22],
        [stem * 1.05, -0.1],
        [0.18, 0.02],
        [0.28, 0.14],
        [0.4, 0.24],
        [0.48, 0.3],
        [0.5, 0.34],
        [0.5, 0.5],
        [0, 0.5],
      ], 64);
    }
    return this.bagganas;
  }

  /**
   * IKEA ENERYDA (703.475.16): bow pull with Ø feet, 96 mm centres, 30 mm
   * projection and 112 mm overall length. Built in mm, then normalized into
   * the unit box so anisotropic part scale recovers the real proportions.
   */
  unitEneryda(): TBufferGeometry {
    if (!this.eneryda) {
      const length = 112;
      const projection = 30;
      const height = 17;
      const centres = 96;
      const half = centres / 2;
      const tubeR = 5.2;
      const footR = 7;
      const footH = 2.4;

      const curve = new this.THREE.CatmullRomCurve3([
        new this.THREE.Vector3(-half, 0, tubeR * 0.6),
        new this.THREE.Vector3(-half, 0, projection * 0.38),
        new this.THREE.Vector3(-half * 0.72, 0, projection * 0.88),
        new this.THREE.Vector3(0, 0, projection - tubeR * 0.55),
        new this.THREE.Vector3(half * 0.72, 0, projection * 0.88),
        new this.THREE.Vector3(half, 0, projection * 0.38),
        new this.THREE.Vector3(half, 0, tubeR * 0.6),
      ], false, 'catmullrom', 0.35);

      const tube = new this.THREE.TubeGeometry(curve, 72, tubeR, 20, false);
      const foot = new this.THREE.CylinderGeometry(footR, footR, footH, 28);
      foot.rotateX(Math.PI / 2);

      const leftFoot = foot.clone();
      leftFoot.translate(-half, 0, footH / 2);
      const rightFoot = foot.clone();
      rightFoot.translate(half, 0, footH / 2);
      foot.dispose();

      const merged = this.mergeGeometries([tube, leftFoot, rightFoot]);
      tube.dispose();
      leftFoot.dispose();
      rightFoot.dispose();

      this.normalizeToUnitBox(merged, length, height, projection);
      this.eneryda = merged;
    }
    return this.eneryda;
  }

  /**
   * IKEA ENHET cabinet leg (104.490.18): Ø50 mm mounting plate, steel tube,
   * threaded adjuster and plastic foot. Nominal height 125 mm (adjustable
   * 110–135). Built in mm with Y up, then packed into the unit box.
   */
  unitEnhetLeg(): TBufferGeometry {
    if (!this.enhetLeg) {
      const width = 50;
      const height = 125;
      const depth = 50;
      const plateR = 25;
      const plateH = 3;
      const tubeR = 14;
      const collarH = 5;
      const footR = 16;
      const footH = 11;
      const stemR = 5.5;
      const stemH = 15;
      const tubeH = height - plateH - footH - stemH;
      const segs = 32;

      const plate = new this.THREE.CylinderGeometry(plateR, plateR, plateH, segs);
      plate.translate(0, height - plateH / 2, 0);

      const collar = new this.THREE.CylinderGeometry(tubeR + 3, tubeR, collarH, segs);
      collar.translate(0, height - plateH - collarH / 2, 0);

      const tube = new this.THREE.CylinderGeometry(tubeR, tubeR, tubeH, segs);
      tube.translate(0, footH + stemH + tubeH / 2, 0);

      const stem = new this.THREE.CylinderGeometry(stemR, stemR, stemH, segs);
      stem.translate(0, footH + stemH / 2, 0);

      const foot = new this.THREE.CylinderGeometry(footR * 0.88, footR, footH, segs);
      foot.translate(0, footH / 2, 0);

      const merged = this.mergeGeometries([plate, collar, tube, stem, foot]);
      plate.dispose();
      collar.dispose();
      tube.dispose();
      stem.dispose();
      foot.dispose();

      merged.translate(0, -height / 2, 0);
      merged.scale(1 / width, 1 / height, 1 / depth);
      merged.computeVertexNormals();
      this.enhetLeg = merged;
    }
    return this.enhetLeg;
  }

  forShape(shape: PanelShape): TBufferGeometry {
    if (shape === 'bagganas') return this.unitBagganas();
    if (shape === 'eneryda') return this.unitEneryda();
    if (shape === 'enhet-leg') return this.unitEnhetLeg();
    if (shape === 'cylinder') return this.unitCylinder();
    return this.unitBox();
  }

  private lathe(
    points: readonly (readonly [number, number])[],
    segments = 48,
  ): TBufferGeometry {
    const profile = points.map(([x, y]) => new this.THREE.Vector2(x, y));
    const geometry = new this.THREE.LatheGeometry(profile, segments);
    geometry.rotateX(Math.PI / 2);
    geometry.computeVertexNormals();
    return geometry;
  }

  /** Packs mm-space geometry into the shared unit cube centred on the origin. */
  private normalizeToUnitBox(
    geometry: TBufferGeometry,
    length: number,
    height: number,
    projection: number,
  ): void {
    geometry.translate(0, 0, -projection / 2);
    geometry.scale(1 / length, 1 / height, 1 / projection);
    geometry.computeVertexNormals();
  }

  private mergeGeometries(geometries: TBufferGeometry[]): TBufferGeometry {
    let vertexCount = 0;
    let indexCount = 0;
    for (const geometry of geometries) {
      const position = geometry.getAttribute('position');
      vertexCount += position.count;
      const index = geometry.getIndex();
      indexCount += index ? index.count : position.count;
    }

    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const indices = new Uint32Array(indexCount);
    const normal = new this.THREE.Vector3();
    let vertexOffset = 0;
    let indexOffset = 0;

    for (const geometry of geometries) {
      geometry.computeVertexNormals();
      const position = geometry.getAttribute('position');
      const normalAttr = geometry.getAttribute('normal');
      for (let i = 0; i < position.count; i++) {
        const dst = (vertexOffset + i) * 3;
        positions[dst] = position.getX(i);
        positions[dst + 1] = position.getY(i);
        positions[dst + 2] = position.getZ(i);
        if (normalAttr) {
          normals[dst] = normalAttr.getX(i);
          normals[dst + 1] = normalAttr.getY(i);
          normals[dst + 2] = normalAttr.getZ(i);
        } else {
          normal.set(0, 0, 1);
          normals[dst] = normal.x;
          normals[dst + 1] = normal.y;
          normals[dst + 2] = normal.z;
        }
      }

      const index = geometry.getIndex();
      if (index) {
        for (let i = 0; i < index.count; i++) {
          indices[indexOffset + i] = index.getX(i) + vertexOffset;
        }
        indexOffset += index.count;
      } else {
        for (let i = 0; i < position.count; i++) {
          indices[indexOffset + i] = vertexOffset + i;
        }
        indexOffset += position.count;
      }
      vertexOffset += position.count;
    }

    const merged = new this.THREE.BufferGeometry();
    merged.setAttribute('position', new this.THREE.BufferAttribute(positions, 3));
    merged.setAttribute('normal', new this.THREE.BufferAttribute(normals, 3));
    merged.setIndex(new this.THREE.BufferAttribute(indices, 1));
    return merged;
  }

  dispose(): void {
    this.box?.dispose();
    this.box = null;
    this.cylinder?.dispose();
    this.cylinder = null;
    this.bagganas?.dispose();
    this.bagganas = null;
    this.eneryda?.dispose();
    this.eneryda = null;
    this.enhetLeg?.dispose();
    this.enhetLeg = null;
  }
}

/**
 * Shared PBR materials keyed by material + color id. The prototype allocated
 * one material per mesh; these are owned here and must be exempt from any
 * traverse-and-dispose loop.
 */
export class MaterialCache {
  private readonly cache = new Map<string, TMaterial>();
  private oakMap: TTexture | null = null;

  constructor(private readonly THREE: ThreeModule) {}

  body(materialId: string | undefined, colorId: string | undefined): TMaterial {
    const appearance = resolveAppearance(materialId, colorId);
    const key = `${materialId ?? ''}:${colorId ?? ''}`;
    let m = this.cache.get(key);
    if (!m) {
      const texturedOak = materialId === 'oak' && (colorId === 'natural' || !colorId);
      m = new this.THREE.MeshStandardMaterial({
        // Texture already carries the oak color; keep white so the map reads true.
        color: texturedOak ? '#ffffff' : appearance.color,
        map: texturedOak ? this.oakTexture() : null,
        roughness: appearance.roughness,
        metalness: appearance.metalness,
      });
      this.cache.set(key, m);
    }
    return m;
  }

  private oakTexture(): TTexture {
    if (!this.oakMap) {
      const texture = new this.THREE.CanvasTexture(createOakGrainCanvas());
      texture.colorSpace = this.THREE.SRGBColorSpace;
      texture.wrapS = this.THREE.RepeatWrapping;
      texture.wrapT = this.THREE.RepeatWrapping;
      texture.anisotropy = 8;
      this.oakMap = texture;
    }
    return this.oakMap;
  }

  dispose(): void {
    for (const m of this.cache.values()) m.dispose();
    this.cache.clear();
    this.oakMap?.dispose();
    this.oakMap = null;
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
  const geometry = geometries.forShape(spec.shape);
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
