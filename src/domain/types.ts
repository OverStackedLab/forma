// Domain types. This module — and everything else under src/domain — must never
// import React or three.js at module scope: THREE is injected as an argument so
// the domain stays unit-testable in Node and three.js stays code-splittable.

export type Vec3Mm = { x: number; y: number; z: number };
export type DimensionAxis = 'w' | 'h' | 'd';
export type PartCategory = 'panel' | 'front' | 'hardware';
export type EdgeBandSide =
  | 'w-min'
  | 'w-max'
  | 'h-min'
  | 'h-max'
  | 'd-min'
  | 'd-max';

/** The wood/substrate a part is made of — independent of any stain or paint applied to it. */
export type MaterialId = 'walnut' | 'oak' | 'ash' | 'metal';
/** A stain or paint applied over a material. 'natural' leaves the material's own look untouched. */
export type ColorId = 'natural' | 'ebony' | 'white' | 'brass' | 'matte-black' | 'steel';
export type FinishId = 'walnut' | 'white-oak' | 'ash' | 'ebony' | 'white-lacquer';
export type HardwareFinishId = 'brushed-brass' | 'matte-black' | 'brushed-steel';
export type AppearanceFinishId = FinishId | HardwareFinishId;
export type PanelPresetId = 'flat' | 'shelf' | 'divider' | 'back' | 'door' | 'knob';
export type CabinetPresetId =
  | 'base-450'
  | 'base-600'
  | 'base-900'
  | 'wall-600'
  | 'wall-900'
  | 'tall-600';
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

/** One user-facing appearance choice; its implementation details stay internal. */
export type Finish = {
  id: AppearanceFinishId;
  label: string;
  materialId: MaterialId;
  colorId: ColorId;
};

export type PanelPreset = {
  id: PanelPresetId;
  label: string;
  w: number;
  h: number;
  d: number;
  icon: string;
  shape: PanelShape;
  category: PartCategory;
  description: string;
  /** World dimension that represents sheet thickness; null for purchased hardware. */
  thicknessAxis: DimensionAxis | null;
  grainAxis: DimensionAxis | null;
  edgeBanding: readonly EdgeBandSide[];
  /** Orientation used when the preset first enters the scene. */
  defaultQuaternion: [number, number, number, number];
};

/** External carcass dimensions for a standard open-front cabinet. */
export type CabinetPreset = {
  id: CabinetPresetId;
  label: string;
  width: number;
  height: number;
  depth: number;
  shelfCount: number;
  icon: string;
};

export type CabinetConfig = {
  presetId?: CabinetPresetId;
  width: number;
  height: number;
  depth: number;
  shelfCount: number;
};

/** A user-inserted or cabinet-generated part. Placement lives in Transforms. */
export type CustomPart = {
  id: string;
  label: string;
  w: number;
  h: number;
  d: number;
  shape: PanelShape;
  category: PartCategory;
  presetId?: PanelPresetId;
  /** Optional display label used to combine matching cut-list rows. */
  bomLabel?: string;
  /** Optional for backward compatibility; old files infer the smallest dimension. */
  thicknessAxis?: DimensionAxis | null;
  grainAxis: DimensionAxis | null;
  edgeBanding: EdgeBandSide[];
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
 * The flat render description of one live part. It feeds the mesh builder, the
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
  category: PartCategory;
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
  /** Present only for a generated cabinet whose carcass can be rebuilt parametrically. */
  cabinet?: CabinetConfig;
};

/** The undoable, persisted portion of application state. */
export type DocumentSnapshot = {
  /** Piece-wide defaults used by every panel without a per-part override. */
  defaultMaterialId: MaterialId;
  defaultColorId: ColorId;
  defaultHardwareFinishId: HardwareFinishId;
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
  source: 'sheet' | 'hardware';
  label: string;
  qty: number;
  finish: string;
  w: number;
  h: number;
  d: number;
  thickness: number | null;
  /** Face area for one piece; zero for purchased hardware. */
  sheetAreaM2: number;
  edgeBand: string;
  edgeBandLengthMm: number;
  grain: string;
};

export type SheetRequirement = {
  finish: string;
  thickness: number;
  areaM2: number;
  sheets: number;
};

export type BomTotals = {
  sheetAreaM2: number;
  sheets: number;
  edgeBandM: number;
  partCount: number;
};

export type Bom = {
  rows: BomRow[];
  sheetRows: BomRow[];
  hardwareRows: BomRow[];
  sheetRequirements: SheetRequirement[];
  totals: BomTotals;
};
