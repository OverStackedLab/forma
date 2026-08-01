import type { Transform } from '@/domain/types';
import { combinedWorldBounds } from './bounds';
import type { ModelBuilder } from './ModelBuilder';

/**
 * Moves a selection to y=0 as one rigid structure. Every root receives the
 * same delta, preserving the spacing between shelves, sides, hardware, and
 * separate groups selected together.
 */
export function computeFloorSnapTransforms(
  builder: ModelBuilder,
  ids: readonly string[],
): Record<string, Transform> | null {
  const EPSILON = 1e-6;
  const roots = ids
    .map((id) => ({ id, root: builder.getRoot(id) }))
    .filter(
      (entry): entry is { id: string; root: NonNullable<typeof entry.root> } =>
        Boolean(entry.root),
    );
  const bounds = combinedWorldBounds(roots.map(({ root }) => root));
  if (!bounds) return null;

  const dy = -bounds.min.y;
  if (Math.abs(dy) < EPSILON) return null;

  const next: Record<string, Transform> = {};
  for (const { id, root } of roots) {
    root.position.y += dy;
    next[id] = {
      position: root.position.toArray() as Transform['position'],
      quaternion: root.quaternion.toArray() as Transform['quaternion'],
      scale: root.scale.toArray() as Transform['scale'],
    };
  }
  return next;
}
