// Domain types. This module — and everything else under src/domain — must never
// import React or three.js at module scope: THREE is injected as an argument so
// the domain stays unit-testable in Node and three.js stays code-splittable.

export type Vec3Mm = { x: number; y: number; z: number };

/** The wood/substrate a part is made of — independent of any stain or paint applied to it. */
export type MaterialId = 'walnut' | 'oak' | 'ash';
/** A stain or paint applied over a material. 'natural' leaves the material's own look untouched. */
export type ColorId = 'natural' | 'ebony' | 'white';
export type PanelPresetId = 'flat' | 'shelf' | 'divider' | 'back' | 'door' | 'knob';
/** Every part renders as one of two shared unit geometries, scaled per instance. */
export type PanelShape = 'box' | 'cylinder';

export type Material = {
  id: MaterialId;
  label: string;
  /** The material's own natural appearance — used when its color is 'natural'. */
  color: string;
  roughness: number;
  metalness: number;
};

export type Color = {
  id: ColorId;
  label: string;
  /** Overrides the material's own color. null (Natural) leaves it untouched. */
  tint: string | null;
  /** A stain keeps the material's own surface finish; a paint overrides it. */
  roughness?: number;
  metalness?: number;
};

export type PanelPreset = {
  id: PanelPresetId;
  label: string;
  w: number;
  h: number;
  d: number;
  icon: string;
  shape: PanelShape;
};

/** A user-inserted library panel. Placement lives in Transforms, not here. */
export type CustomPart = {
  id: string;
  label: string;
  w: number;
  h: number;
  d: number;
  shape: PanelShape;
};

export type PartOverride = { material?: MaterialId; color?: ColorId };
export type Overrides = Record<string, PartOverride | undefined>;

/**
 * A manual gizmo transform. Positions are in metres (three.js world units)
 * because they originate from and are written back to Object3D directly.
 */
export type Transform = {
  position: [number, number, number];
  quaternion: [number, number, number, number];
  scale: [number, number, number];
};
export type Transforms = Record<string, Transform | undefined>;

/**
 * The flat description of one live part — every part is a library panel, so
 * this is a thin, uniform box description. It feeds the mesh builder, the
 * assembly tree, the BOM, the part count, Select All and the Properties
 * panel, so nothing can honour a deletion in one place and miss it in
 * another.
 */
export type PartSpec = {
  id: string;
  label: string;
  /** Millimetres — the panel's own nominal size, before any gizmo scale. */
  size: Vec3Mm;
  shape: PanelShape;
};

export type SavedVersion = {
  id: string;
  label: string;
  /** Epoch ms. Formatted relatively at render — never stored pre-formatted. */
  createdAt: number;
  doc: DocumentSnapshot;
};

/**
 * A named, persisted multi-selection. Members keep their own independent
 * transforms — a group has no transform of its own — but selecting the group
 * selects every member at once, which feeds the existing multi-select gizmo
 * pivot so the whole set moves/rotates/scales together.
 */
export type Group = {
  id: string;
  label: string;
  partIds: string[];
};

/** The undoable, persisted portion of application state. */
export type DocumentSnapshot = {
  /** Default material and color applied to newly inserted panels. */
  defaultMaterialId: MaterialId;
  defaultColorId: ColorId;
  overrides: Overrides;
  customParts: CustomPart[];
  hiddenIds: string[];
  transforms: Transforms;
  groups: Group[];
};

export type FormaDocument = DocumentSnapshot & {
  docTitle: string;
  versions: SavedVersion[];
  currentVersionId: string | null;
};

export type BomRow = {
  label: string;
  qty: number;
  material: string;
  color: string;
  w: number;
  h: number;
  d: number;
  edge: boolean;
  grain: string;
};

export type BomTotals = {
  sheetAreaM2: number;
  sheets: number;
  edgeBandM: number;
  partCount: number;
};

export type Bom = {
  rows: BomRow[];
  totals: BomTotals;
};
