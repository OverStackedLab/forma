import * as THREE from 'three';
import { createPartNode, GeometryCache, MaterialCache, type PartNode } from '@/domain/geometry';
import { computePartSpecs } from '@/domain/parts';
import type { ColorId, CustomPart, MaterialId, Overrides, PartSpec, Transforms } from '@/domain/types';

export type SyncInput = {
  overrides: Overrides;
  customParts: readonly CustomPart[];
  transforms: Transforms;
  hiddenIds: readonly string[];
  defaultMaterialId: MaterialId;
  defaultColorId: ColorId;
};

/**
 * Keeps the scene in step with the document.
 *
 * The prototype disposed and rebuilt every mesh and material on every change —
 * including every frame of a slider drag. Here, geometry is one shared unit
 * box and every part is positioned by transform, so a dimension change is a
 * scale write with no allocation. Nodes are only created or removed when a
 * part appears or disappears.
 */
export class ModelBuilder {
  private readonly geometries = new GeometryCache(THREE);
  private readonly materials = new MaterialCache(THREE);
  private readonly nodes = new Map<string, PartNode>();
  private specs: PartSpec[] = [];

  constructor(private readonly partsGroup: THREE.Group) {}

  /** The live part specs behind the current scene contents. */
  get partSpecs(): readonly PartSpec[] {
    return this.specs;
  }

  getRoot(partId: string): THREE.Object3D | undefined {
    return this.nodes.get(partId)?.root;
  }

  getHighlightTarget(partId: string): THREE.Mesh | undefined {
    return this.nodes.get(partId)?.highlightTarget;
  }

  get pickables(): THREE.Object3D[] {
    return [this.partsGroup];
  }

  /** Visible part ids, in tree order — used by marquee hit-testing. */
  visibleIds(): string[] {
    const out: string[] = [];
    for (const [id, node] of this.nodes) if (node.root.visible) out.push(id);
    return out;
  }

  sync(input: SyncInput): void {
    const { overrides, transforms, hiddenIds, defaultMaterialId, defaultColorId } = input;
    this.specs = computePartSpecs(input.customParts);

    const hidden = new Set(hiddenIds);
    const seen = new Set<string>();

    for (const spec of this.specs) {
      seen.add(spec.id);
      let node = this.nodes.get(spec.id);
      const material = this.materials.body(
        overrides[spec.id]?.material ?? defaultMaterialId,
        overrides[spec.id]?.color ?? defaultColorId,
      );

      if (!node) {
        node = createPartNode(THREE, this.geometries, spec, material);
        this.partsGroup.add(node.root);
        this.nodes.set(spec.id, node);
      } else {
        node.update(spec);
        node.setMaterial(material);
      }

      this.applyPlacement(node, spec, transforms);
      node.root.visible = !hidden.has(spec.id);
    }

    for (const [id, node] of this.nodes) {
      if (!seen.has(id)) this.removeNode(id, node);
    }
  }

  /**
   * A manual transform replaces the placement outright. Size lives on the
   * mesh beneath the root, so a gizmo scale never clobbers a dimension.
   */
  private applyPlacement(node: PartNode, spec: PartSpec, transforms: Transforms): void {
    const t = transforms[spec.id];
    if (!t) return;
    node.root.position.fromArray(t.position);
    node.root.quaternion.fromArray(t.quaternion);
    node.root.scale.fromArray(t.scale);
  }

  private removeNode(id: string, node: PartNode): void {
    node.root.removeFromParent();
    // Geometry and materials are cache-owned and shared — disposing them here
    // would blank out every other part using them.
    this.nodes.delete(id);
  }

  dispose(): void {
    for (const [id, node] of this.nodes) this.removeNode(id, node);
    this.geometries.dispose();
    this.materials.dispose();
  }
}
