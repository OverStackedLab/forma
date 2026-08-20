import type { Box3 } from 'three';
import type { Transform } from '@/domain/types';
import { combinedWorldBounds } from './bounds';
import type { ModelBuilder } from './ModelBuilder';
import type { AlignEdge } from './viewportApi';

const AXES = ['x', 'y', 'z'] as const;
type Axis = (typeof AXES)[number];

const ALIGN_EDGE: Record<AlignEdge, { axis: Axis; from: 'min' | 'max' | 'center'; to: 'min' | 'max' | 'center' }> = {
  left: { axis: 'x', from: 'min', to: 'min' },
  right: { axis: 'x', from: 'max', to: 'max' },
  'center-x': { axis: 'x', from: 'center', to: 'center' },
  front: { axis: 'z', from: 'max', to: 'max' },
  back: { axis: 'z', from: 'min', to: 'min' },
  top: { axis: 'y', from: 'max', to: 'max' },
  bottom: { axis: 'y', from: 'min', to: 'min' },
};

function boundOnAxis(box: Box3, axis: Axis, which: 'min' | 'max' | 'center'): number {
  if (which === 'min') return box.min[axis];
  if (which === 'max') return box.max[axis];
  return (box.min[axis] + box.max[axis]) / 2;
}

/**
 * Translates one piece or rigid group so a chosen bound matches the target's
 * on a single axis. Other axes are left alone so a hanging wall cabinet can
 * share a floor cabinet's left edge without dropping to the worktop.
 */
export function computeAlignTransforms(
  builder: ModelBuilder,
  targetIds: readonly string[],
  movingIds: readonly string[],
  edge: AlignEdge,
): Record<string, Transform> | null {
  const targetSet = new Set(targetIds);
  const targetRoots = targetIds.map((id) => builder.getRoot(id));
  const movingRoots = movingIds
    .filter((id) => !targetSet.has(id))
    .map((id) => ({ id, root: builder.getRoot(id) }))
    .filter(
      (entry): entry is { id: string; root: NonNullable<typeof entry.root> } =>
        Boolean(entry.root),
    );
  const targetBox = combinedWorldBounds(targetRoots);
  const movingBox = combinedWorldBounds(movingRoots.map(({ root }) => root));
  if (!targetBox || !movingBox || !movingRoots.length) return null;

  const match = ALIGN_EDGE[edge];
  const delta = boundOnAxis(targetBox, match.axis, match.to) - boundOnAxis(movingBox, match.axis, match.from);
  if (Math.abs(delta) < 1e-12) return null;

  const next: Record<string, Transform> = {};
  for (const { id, root } of movingRoots) {
    root.position[match.axis] += delta;
    const position: Transform['position'] = [root.position.x, root.position.y, root.position.z];
    const quaternion: Transform['quaternion'] = [
      root.quaternion.x,
      root.quaternion.y,
      root.quaternion.z,
      root.quaternion.w,
    ];
    const scale: Transform['scale'] = [root.scale.x, root.scale.y, root.scale.z];
    next[id] = { position, quaternion, scale };
  }
  return next;
}
