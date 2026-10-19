import { buildCabinetLayout, type CabinetLayoutPart } from './cabinets';
import {
  CABINET_PRESETS,
  DEFAULT_COLOR_ID,
  DEFAULT_HARDWARE_FINISH_ID,
  DEFAULT_MATERIAL_ID,
  PANEL_PRESETS,
} from './catalog';
import { buildDrawerLayout, DRAWER_PRESETS } from './drawers';
import type {
  CabinetConfig,
  CabinetPreset,
  CabinetPresetId,
  CustomPart,
  DrawerConfig,
  DrawerPresetId,
  FormaDocument,
  Group,
  PanelPreset,
  PanelPresetId,
  Transform,
  Transforms,
} from './types';

/** Shared back plane so bases, walls, the pantry and the fridge sit on one wall. */
const WALL_BACK_MM = -300;
const CARCASS_PANEL_MM = 18;
/** Drawer box stops just behind the overlay front. */
const DRAWER_SETBACK_MM = 2;
/** Gap between a handle's end and the door edge it sits beside. */
const HANDLE_EDGE_GAP_MM = 30;

type VecMm = [number, number, number];

type PlacedCabinet = {
  centreXmm: number;
  originYmm: number;
  width: number;
  height: number;
  /** Outer front face, in millimetres. Overlay fronts start here. */
  frontZmm: number;
};

type PlacedFront = {
  centreXmm: number;
  centreYmm: number;
  centreZmm: number;
  w: number;
  h: number;
  d: number;
};

/**
 * A 4 m METOD run for visual QA: pantry, drawer base, solid and glass bases,
 * a hob base, and a fridge, with wall cabinets whose tops line up with the
 * pantry. Fronts, handles and the hob stay loose parts, so the carcasses
 * remain parametric cabinets.
 */
export function createDemoKitchen(): FormaDocument {
  const scene = createScene();
  const run = placeRun(scene);
  placeFronts(scene, run);
  return scene.toDocument();
}

type Run = {
  pantry: PlacedCabinet;
  drawers: PlacedCabinet;
  solidBase: PlacedCabinet;
  glassBase: PlacedCabinet;
  hobBase: PlacedCabinet;
  wallLeft: PlacedCabinet;
  glassWall: PlacedCabinet;
  solidWall: PlacedCabinet;
  glassPairWall: PlacedCabinet;
};

function placeRun(scene: Scene): Run {
  // 600 + 800 + 600 + 600 + 800 + 600, centred on the origin.
  const left = -2000;
  const pantry = scene.placeCabinet('high-600', 'Pantry', left + 300);
  const drawers = scene.placeCabinet('base-800', 'Drawer base', left + 600 + 400, 0);
  const solidBase = scene.placeCabinet('base-600', 'Base cabinet', left + 1400 + 300);
  const glassBase = scene.placeCabinet('base-600', 'Glass base', left + 2000 + 300);
  const hobBase = scene.placeCabinet('base-800', 'Hob base', left + 2600 + 400);
  scene.placePreset('fridge-600', 'Fridge', [left + 3400 + 300, 1840 / 2, WALL_BACK_MM + 330]);
  const wallLeft = scene.placeCabinet('wall-800', 'Wall cabinet', drawers.centreXmm);
  const glassWall = scene.placeCabinet('wall-600', 'Glass wall', solidBase.centreXmm);
  const solidWall = scene.placeCabinet('wall-600', 'Wall cabinet', glassBase.centreXmm);
  const glassPairWall = scene.placeCabinet('wall-800', 'Glass wall', hobBase.centreXmm);
  return { pantry, drawers, solidBase, glassBase, hobBase, wallLeft, glassWall, solidWall, glassPairWall };
}

function placeFronts(scene: Scene, run: Run): void {
  const pantryDoor = scene.placeFront('bodbyn-600-1400', run.pantry, 700);
  scene.placeHandle(pantryDoor, 'right', 1050);
  const pantryGlass = scene.placeFront('axstad-glass-600', run.pantry, 1800);
  scene.placeHandle(pantryGlass, 'right', 1800);

  placeDrawerStack(scene, run.drawers, [
    ['drawer-800-400', 'bodbyn-drawer-800-400', 200],
    ['drawer-800-200', 'bodbyn-drawer-800-200', 500],
    ['drawer-800-200', 'bodbyn-drawer-800-200', 700],
  ]);

  const solidDoor = scene.placeFront('bodbyn-600', run.solidBase, 400);
  scene.placeHandle(solidDoor, 'right', 700);
  const glassDoor = scene.placeFront('axstad-glass-600', run.glassBase, 400);
  scene.placeHandle(glassDoor, 'right', 700);

  const hobLeft = scene.placeFront('bodbyn-400', run.hobBase, 400, run.hobBase.centreXmm - 200);
  const hobRight = scene.placeFront('bodbyn-400', run.hobBase, 400, run.hobBase.centreXmm + 200);
  scene.placeHandle(hobLeft, 'right', 700);
  scene.placeHandle(hobRight, 'left', 700);
  scene.placePreset('matmassig-590', 'MATMÄSSIG hob', [
    run.hobBase.centreXmm,
    run.hobBase.originYmm + run.hobBase.height + 49 / 2,
    0,
  ]);

  const wallDoorLeft = scene.placeFront('bodbyn-400', run.wallLeft, 1800, run.wallLeft.centreXmm - 200);
  const wallDoorRight = scene.placeFront('bodbyn-400', run.wallLeft, 1800, run.wallLeft.centreXmm + 200);
  scene.placeHandle(wallDoorLeft, 'right', 1800);
  scene.placeHandle(wallDoorRight, 'left', 1800);

  const wallGlass = scene.placeFront('axstad-glass-600', run.glassWall, 1800);
  scene.placeHandle(wallGlass, 'right', 1800);
  const wallSolid = scene.placeFront('bodbyn-600', run.solidWall, 1800);
  scene.placeHandle(wallSolid, 'right', 1800);

  const lowerGlass = scene.placeFront(
    'bodbyn-glass-400-400',
    run.glassPairWall,
    1600,
    run.glassPairWall.centreXmm - 200,
  );
  const upperGlass = scene.placeFront(
    'bodbyn-glass-400-400',
    run.glassPairWall,
    2000,
    run.glassPairWall.centreXmm - 200,
  );
  const pairSolid = scene.placeFront('bodbyn-400', run.glassPairWall, 1800, run.glassPairWall.centreXmm + 200);
  scene.placeHandle(lowerGlass, 'right', 1600);
  scene.placeHandle(upperGlass, 'right', 2000);
  scene.placeHandle(pairSolid, 'left', 1800);
}

function placeDrawerStack(
  scene: Scene,
  cabinet: PlacedCabinet,
  stack: readonly [DrawerPresetId, PanelPresetId, number][],
): void {
  for (const [drawerId, frontId, centreY] of stack) {
    const front = scene.placeFront(frontId, cabinet, centreY);
    scene.placeDrawer(drawerId, cabinet, centreY);
    scene.placeHandle(front, 'centre', centreY);
  }
}

type Scene = {
  placeCabinet: (
    presetId: CabinetPresetId,
    label: string,
    centreXmm: number,
    shelfCount?: number,
  ) => PlacedCabinet;
  placeDrawer: (presetId: DrawerPresetId, cabinet: PlacedCabinet, frontCentreYmm: number) => void;
  placeFront: (
    presetId: PanelPresetId,
    cabinet: PlacedCabinet,
    centreYmm: number,
    centreXmm?: number,
  ) => PlacedFront;
  placeHandle: (front: PlacedFront, edge: 'left' | 'right' | 'centre', centreYmm: number) => void;
  placePreset: (presetId: PanelPresetId, label: string, centreMm: VecMm) => void;
  toDocument: () => FormaDocument;
};

function createScene(): Scene {
  const customParts: CustomPart[] = [];
  const transforms: Transforms = {};
  const groups: Group[] = [];
  let seq = 0;

  function nextId(prefix: string): string {
    seq += 1;
    return `demo-${prefix}-${seq}`;
  }

  function placeLayout(
    label: string,
    originMm: VecMm,
    layout: readonly CabinetLayoutPart[],
    config: { cabinet?: CabinetConfig; drawer?: DrawerConfig },
  ): void {
    const partIds = layout.map(() => nextId('part'));
    layout.forEach((item, index) => {
      const id = partIds[index];
      if (!id) return;
      customParts.push({
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
      });
      transforms[id] = {
        position: [
          (originMm[0] + item.positionMm[0]) / 1000,
          (originMm[1] + item.positionMm[1]) / 1000,
          (originMm[2] + item.positionMm[2]) / 1000,
        ],
        quaternion: [...item.quaternion],
        scale: [1, 1, 1],
      };
    });
    groups.push({ id: nextId('group'), label, partIds, ...config });
  }

  function placeCabinet(
    presetId: CabinetPresetId,
    label: string,
    centreXmm: number,
    shelfCount?: number,
  ): PlacedCabinet {
    const preset = requirePreset(CABINET_PRESETS, presetId);
    const count = shelfCount ?? preset.shelfCount;
    const layoutPreset: CabinetPreset & { shelfCount: number } = { ...preset, label, shelfCount: count };
    const originYmm = preset.bottomMm ?? 0;
    const originZmm = WALL_BACK_MM + preset.depth / 2;
    placeLayout(label, [centreXmm, originYmm, originZmm], buildCabinetLayout(layoutPreset), {
      cabinet: {
        presetId,
        width: preset.width,
        height: preset.height,
        depth: preset.depth,
        shelfCount: count,
      },
    });
    return {
      centreXmm,
      originYmm,
      width: preset.width,
      height: preset.height,
      frontZmm: originZmm + preset.depth / 2,
    };
  }

  function placeDrawer(presetId: DrawerPresetId, cabinet: PlacedCabinet, frontCentreYmm: number): void {
    const preset = requirePreset(DRAWER_PRESETS, presetId);
    const interiorBottom = cabinet.originYmm + CARCASS_PANEL_MM + DRAWER_SETBACK_MM;
    const interiorTop = cabinet.originYmm + cabinet.height - CARCASS_PANEL_MM - DRAWER_SETBACK_MM;
    let bottom = frontCentreYmm - preset.height / 2;
    if (bottom < interiorBottom) bottom = interiorBottom;
    if (bottom + preset.height > interiorTop) bottom = interiorTop - preset.height;
    const originZmm = cabinet.frontZmm - DRAWER_SETBACK_MM - preset.depth / 2;
    placeLayout(
      preset.label,
      [cabinet.centreXmm, bottom, originZmm],
      buildDrawerLayout(preset),
      {
        drawer: {
          presetId,
          width: preset.width,
          height: preset.height,
          depth: preset.depth,
        },
      },
    );
  }

  function placeFront(
    presetId: PanelPresetId,
    cabinet: PlacedCabinet,
    centreYmm: number,
    centreXmm = cabinet.centreXmm,
  ): PlacedFront {
    const preset = requirePreset(PANEL_PRESETS, presetId);
    const centreZmm = cabinet.frontZmm + preset.d / 2;
    placePreset(presetId, preset.label, [centreXmm, centreYmm, centreZmm]);
    return { centreXmm, centreYmm, centreZmm, w: preset.w, h: preset.h, d: preset.d };
  }

  function placeHandle(front: PlacedFront, edge: 'left' | 'right' | 'centre', centreYmm: number): void {
    const handle = requirePreset(PANEL_PRESETS, 'borghamn');
    const inset = handle.w / 2 + HANDLE_EDGE_GAP_MM;
    const centreXmm = edge === 'centre'
      ? front.centreXmm
      : edge === 'left'
        ? front.centreXmm - front.w / 2 + inset
        : front.centreXmm + front.w / 2 - inset;
    const centreZmm = front.centreZmm + front.d / 2 + handle.d / 2;
    placePreset('borghamn', handle.label, [centreXmm, centreYmm, centreZmm]);
  }

  function placePreset(presetId: PanelPresetId, label: string, centreMm: VecMm): void {
    const preset = requirePreset(PANEL_PRESETS, presetId);
    const id = nextId('part');
    customParts.push(partFromPreset(id, label, preset));
    transforms[id] = transformAt(centreMm, preset.defaultQuaternion);
  }

  return {
    placeCabinet,
    placeDrawer,
    placeFront,
    placeHandle,
    placePreset,
    toDocument: () => ({
      defaultMaterialId: DEFAULT_MATERIAL_ID,
      defaultColorId: DEFAULT_COLOR_ID,
      defaultHardwareFinishId: DEFAULT_HARDWARE_FINISH_ID,
      overrides: {},
      customParts,
      hiddenIds: [],
      transforms,
      groups,
      docTitle: 'Demo kitchen',
      versions: [],
      currentVersionId: null,
    }),
  };
}

function partFromPreset(id: string, label: string, preset: PanelPreset): CustomPart {
  return {
    id,
    label,
    w: preset.w,
    h: preset.h,
    d: preset.d,
    shape: preset.shape,
    category: preset.category,
    presetId: preset.id,
    thicknessAxis: preset.thicknessAxis,
    grainAxis: preset.grainAxis,
    edgeBanding: [...preset.edgeBanding],
  };
}

function transformAt(centreMm: VecMm, quaternion: Transform['quaternion']): Transform {
  return {
    position: [centreMm[0] / 1000, centreMm[1] / 1000, centreMm[2] / 1000],
    quaternion: [...quaternion],
    scale: [1, 1, 1],
  };
}

function requirePreset<T extends { id: string }>(list: readonly T[], id: string): T {
  const preset = list.find((candidate) => candidate.id === id);
  if (!preset) throw new Error(`Missing preset ${id}`);
  return preset;
}
