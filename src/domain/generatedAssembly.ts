import type { CabinetLayoutPart } from './cabinets';
import { rotateVectorByQuaternion } from './spatial';
import type { CustomPart, DocumentSnapshot, Group, Transform, Transforms } from './types';

const IDENTITY_TRANSFORM: Transform = {
  position: [0, 0, 0],
  quaternion: [0, 0, 0, 1],
  scale: [1, 1, 1],
};

export type AssemblyPlacement = {
  origin: [number, number, number];
  quaternion: Transform['quaternion'];
};

export type AssemblyDocument = Pick<
  DocumentSnapshot,
  'customParts' | 'transforms' | 'groups' | 'overrides' | 'hiddenIds'
>;

/**
 * Bottom-centre origin of a generated group, read from its first member.
 * The member's catalog position is in millimetres; the stored transform is in
 * metres and may be rotated.
 */
export function anchorPlacement(
  partIds: readonly string[],
  firstLocalMm: readonly [number, number, number] | undefined,
  transforms: Transforms,
): AssemblyPlacement {
  const anchorId = partIds[0];
  const anchor = (anchorId ? transforms[anchorId] : undefined) ?? IDENTITY_TRANSFORM;
  const local = firstLocalMm ?? [0, 0, 0];
  const offset = rotateVectorByQuaternion(
    {
      x: (local[0] * anchor.scale[0]) / 1000,
      y: (local[1] * anchor.scale[1]) / 1000,
      z: (local[2] * anchor.scale[2]) / 1000,
    },
    anchor.quaternion,
  );
  return {
    origin: [
      anchor.position[0] - offset.x,
      anchor.position[1] - offset.y,
      anchor.position[2] - offset.z,
    ],
    quaternion: [...anchor.quaternion],
  };
}

function memberTransform(
  positionMm: readonly [number, number, number],
  placement: AssemblyPlacement,
): Transform {
  const offset = rotateVectorByQuaternion(
    {
      x: positionMm[0] / 1000,
      y: positionMm[1] / 1000,
      z: positionMm[2] / 1000,
    },
    placement.quaternion,
  );
  return {
    position: [
      placement.origin[0] + offset.x,
      placement.origin[1] + offset.y,
      placement.origin[2] + offset.z,
    ],
    quaternion: [...placement.quaternion],
    scale: [1, 1, 1],
  };
}

/**
 * Copies a generated layout's category, cut-list label, and thickness onto the
 * stored parts. A legacy file also takes the layout grain and edge banding.
 * A current file keeps the grain and edge banding the user saved.
 */
export function withGeneratedMemberFields(
  parts: readonly CustomPart[],
  partIds: readonly string[],
  layout: readonly CabinetLayoutPart[],
  legacyAxes: boolean,
): CustomPart[] {
  const indexById = new Map(partIds.map((id, index) => [id, index]));
  return parts.map((part) => {
    const index = indexById.get(part.id);
    const generated = index === undefined ? undefined : layout[index];
    if (!generated) return part;
    const next: CustomPart = {
      ...part,
      category: generated.category,
      bomLabel: generated.bomLabel,
      thicknessAxis: generated.thicknessAxis,
    };
    if (legacyAxes) {
      next.grainAxis = generated.grainAxis;
      next.edgeBanding = [...generated.edgeBanding];
    }
    return next;
  });
}

function partFromLayout(id: string, item: CabinetLayoutPart): CustomPart {
  return {
    id,
    label: item.label,
    w: item.w,
    h: item.h,
    d: item.d,
    shape: item.shape,
    category: item.category,
    bomLabel: item.bomLabel,
    thicknessAxis: item.thicknessAxis,
    grainAxis: item.grainAxis,
    edgeBanding: [...item.edgeBanding],
  };
}

/**
 * Writes a generated layout back onto a group. Existing members keep their
 * grain and edge banding. New members take the layout defaults. Removed roles
 * drop out of the document.
 */
export function applyGeneratedLayout(
  document: AssemblyDocument,
  group: Group,
  layout: readonly CabinetLayoutPart[],
  nextIds: readonly string[],
  placement: AssemblyPlacement,
  groupFields: { label: string } & Partial<Pick<Group, 'cabinet' | 'drawer'>>,
): AssemblyDocument {
  const ids = [...nextIds];
  const nextIdSet = new Set(ids);
  const removedIds = group.partIds.filter((id) => !nextIdSet.has(id));
  const indexById = new Map(ids.map((id, index) => [id, index]));
  const transforms = { ...document.transforms };
  const overrides = { ...document.overrides };
  for (const [index, id] of ids.entries()) {
    const item = layout[index];
    if (!item) continue;
    transforms[id] = memberTransform(item.positionMm, placement);
  }
  for (const id of removedIds) {
    delete transforms[id];
    delete overrides[id];
  }

  const existing = new Set(group.partIds);
  const addedParts = ids
    .map((id, index) => ({ id, item: layout[index] }))
    .filter((entry): entry is { id: string; item: CabinetLayoutPart } => !existing.has(entry.id) && Boolean(entry.item))
    .map(({ id, item }) => partFromLayout(id, item));

  return {
    customParts: [
      ...document.customParts
        .filter((part) => !removedIds.includes(part.id))
        .map((part) => {
          const index = indexById.get(part.id);
          const item = index === undefined ? undefined : layout[index];
          if (!item) return part;
          return {
            ...part,
            label: item.label,
            bomLabel: item.bomLabel,
            w: item.w,
            h: item.h,
            d: item.d,
            category: item.category,
            thicknessAxis: item.thicknessAxis,
          };
        }),
      ...addedParts,
    ],
    hiddenIds: document.hiddenIds.filter((id) => !removedIds.includes(id)),
    transforms,
    overrides,
    groups: document.groups.map((candidate) =>
      candidate.id === group.id ? { ...candidate, ...groupFields, partIds: ids } : candidate,
    ),
  };
}
