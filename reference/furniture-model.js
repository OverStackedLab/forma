// Shared parametric math + geometry builder for the sideboard model.
// computeLayout() is the single source of truth for numbers (mm); both
// buildFurnitureModel() (3D) and computeBOM() (cut list) read from it.

export const FINISHES = [
  { id: 'walnut', label: 'Walnut', color: '#4b3327', roughness: 0.55, metalness: 0.04 },
  { id: 'oak', label: 'White Oak', color: '#c7a374', roughness: 0.6, metalness: 0.03 },
  { id: 'ash', label: 'Ash', color: '#d9cdb6', roughness: 0.62, metalness: 0.02 },
  { id: 'ebony', label: 'Ebony Stain', color: '#211c19', roughness: 0.5, metalness: 0.04 },
  { id: 'lacquer', label: 'White Lacquer', color: '#eef0ea', roughness: 0.28, metalness: 0.0 },
];

export const HARDWARE_FINISHES = [
  { id: 'brass', label: 'Brushed Brass', color: '#b6884b', roughness: 0.35, metalness: 0.85 },
  { id: 'black', label: 'Matte Black', color: '#232323', roughness: 0.55, metalness: 0.5 },
  { id: 'steel', label: 'Brushed Steel', color: '#9a9a9a', roughness: 0.38, metalness: 0.75 },
];

export const LEG_STYLES = [
  { id: 'tapered', label: 'Tapered Wood' },
  { id: 'straight', label: 'Straight Wood' },
  { id: 'hairpin', label: 'Hairpin Metal' },
];

export const HANDLE_STYLES = [
  { id: 'bar', label: 'Bar Pull' },
  { id: 'knob', label: 'Knob' },
  { id: 'recessed', label: 'Recessed' },
];

export const BASE_STYLES = [
  { id: 'legs', label: 'Legs' },
  { id: 'plinth', label: 'Plinth Base' },
];

export const PANEL_PRESETS = [
  { id: 'flat', label: 'Flat Panel', w: 600, h: 400, d: 18 },
  { id: 'shelf', label: 'Shelf', w: 800, h: 300, d: 18 },
  { id: 'divider', label: 'Divider', w: 400, h: 700, d: 18 },
  { id: 'back', label: 'Back Panel', w: 800, h: 700, d: 8 },
];

export const DEFAULT_PARAMS = {
  width: 1400, height: 780, depth: 420, legHeight: 150, thickness: 18,
  baseStyle: 'legs', legStyle: 'tapered', handleStyle: 'bar',
  bodyMaterialId: 'walnut', hardwareMaterialId: 'brass',
};

export function findFinish(id) { return FINISHES.find(f => f.id === id) || FINISHES[0]; }
export function findHardware(id) { return HARDWARE_FINISHES.find(f => f.id === id) || HARDWARE_FINISHES[0]; }
export function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

export function computeLayout(p) {
  const T = p.thickness, W = p.width, H = p.height, D = p.depth;
  const baseH = p.baseStyle === 'plinth' ? 100 : p.legHeight;
  const carcassH = H - baseH;
  const carcassY0 = baseH, carcassY1 = H;
  const cy = carcassY0 + carcassH / 2;
  const innerW = W - 2 * T;
  const gap = 3;
  const doorW = innerW * 0.32;
  const centerW = innerW - 2 * doorW - 2 * gap;
  const frontH = carcassH - 2 * gap;
  const drawerH = (frontH - gap) / 2;
  const frontZ = D / 2 + T / 2;

  const panels = {
    left: { size: { x: T, y: carcassH, z: D }, pos: { x: -(W / 2 - T / 2), y: cy, z: 0 } },
    right: { size: { x: T, y: carcassH, z: D }, pos: { x: (W / 2 - T / 2), y: cy, z: 0 } },
    top: { size: { x: W - 2 * T, y: T, z: D }, pos: { x: 0, y: carcassY1 - T / 2, z: 0 } },
    bottom: { size: { x: W - 2 * T, y: T, z: D }, pos: { x: 0, y: carcassY0 + T / 2, z: 0 } },
    back: { size: { x: W - 2 * T - 2, y: carcassH - 2 * T, z: 8 }, pos: { x: 0, y: cy, z: -(D / 2 - 4) } },
  };

  const doorX = W / 2 - T - gap - doorW / 2;
  const fronts = {
    doorLeft: { size: { x: doorW, y: frontH, z: T }, pos: { x: -doorX, y: cy, z: frontZ } },
    doorRight: { size: { x: doorW, y: frontH, z: T }, pos: { x: doorX, y: cy, z: frontZ } },
    drawerTop: { size: { x: centerW, y: drawerH, z: T }, pos: { x: 0, y: cy + (drawerH + gap) / 2, z: frontZ } },
    drawerBottom: { size: { x: centerW, y: drawerH, z: T }, pos: { x: 0, y: cy - (drawerH + gap) / 2, z: frontZ } },
  };

  const legInset = 70;
  const legPositions = [
    { id: 'fl', x: -(W / 2 - legInset), z: (D / 2 - legInset), sx: -1, sz: 1 },
    { id: 'fr', x: (W / 2 - legInset), z: (D / 2 - legInset), sx: 1, sz: 1 },
    { id: 'bl', x: -(W / 2 - legInset), z: -(D / 2 - legInset), sx: -1, sz: -1 },
    { id: 'br', x: (W / 2 - legInset), z: -(D / 2 - legInset), sx: 1, sz: -1 },
  ];

  const plinth = { size: { x: W - 40, y: baseH - 10, z: D - 40 }, pos: { x: 0, y: (baseH - 10) / 2, z: 0 } };

  const handleAnchors = {
    doorLeft: { x: -doorX + doorW / 2 - 24, y: cy, z: frontZ + T / 2, orientation: 'vertical', len: Math.min(140, frontH * 0.5) },
    doorRight: { x: doorX - doorW / 2 + 24, y: cy, z: frontZ + T / 2, orientation: 'vertical', len: Math.min(140, frontH * 0.5) },
    drawerTop: { x: 0, y: cy + (drawerH + gap) / 2, z: frontZ + T / 2, orientation: 'horizontal', len: Math.min(140, centerW * 0.45) },
    drawerBottom: { x: 0, y: cy - (drawerH + gap) / 2, z: frontZ + T / 2, orientation: 'horizontal', len: Math.min(140, centerW * 0.45) },
  };

  return { T, W, H, D, baseH, carcassH, carcassY0, carcassY1, innerW, doorW, centerW, frontH, drawerH, panels, fronts, legPositions, plinth, handleAnchors };
}

function makeMat(THREE, f) {
  return new THREE.MeshStandardMaterial({ color: f.color, roughness: f.roughness, metalness: f.metalness });
}

function box(THREE, size, pos, mat, name, partId) {
  const g = new THREE.BoxGeometry(size.x / 1000, size.y / 1000, size.z / 1000);
  const m = new THREE.Mesh(g, mat);
  m.position.set(pos.x / 1000, pos.y / 1000, pos.z / 1000);
  m.name = name; m.userData.partId = partId;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function buildLeg(THREE, style, anchor, baseH, mat) {
  const group = new THREE.Group();
  group.position.set(anchor.x / 1000, baseH / 1000, anchor.z / 1000);
  const h = baseH / 1000;
  if (style === 'hairpin') {
    const dLen = Math.sqrt(2);
    const perp = new THREE.Vector3(anchor.sz / dLen, 0, -anchor.sx / dLen);
    [1, -1].forEach((dir) => {
      const sub = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, h, 8), mat);
      rod.position.y = -h / 2;
      rod.castShadow = true;
      sub.add(rod);
      sub.rotateOnAxis(perp, dir * 0.26);
      group.add(sub);
    });
  } else {
    const topR = style === 'tapered' ? 0.016 : 0.015;
    const botR = style === 'tapered' ? 0.009 : 0.015;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(topR, botR, h, 16), mat);
    rod.position.y = -h / 2;
    rod.castShadow = true;
    group.add(rod);
  }
  return group;
}

function buildHandle(THREE, style, anchor, mat) {
  if (style === 'recessed') return null;
  const group = new THREE.Group();
  group.position.set(anchor.x / 1000, anchor.y / 1000, anchor.z / 1000);
  if (style === 'knob') {
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 16), mat);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 8), mat);
    stem.rotation.x = Math.PI / 2; stem.position.z = 0.009;
    knob.position.z = 0.02;
    knob.castShadow = true; stem.castShadow = true;
    group.add(stem, knob);
  } else {
    const len = anchor.len / 1000;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len, 12), mat);
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.018, 8), mat);
    const s2 = s1.clone();
    if (anchor.orientation === 'vertical') {
      bar.position.z = 0.02;
      s1.rotation.x = Math.PI / 2; s1.position.set(0, len / 2 - 0.012, 0.009);
      s2.rotation.x = Math.PI / 2; s2.position.set(0, -len / 2 + 0.012, 0.009);
    } else {
      bar.rotation.z = Math.PI / 2; bar.position.z = 0.02;
      s1.rotation.x = Math.PI / 2; s1.position.set(len / 2 - 0.012, 0, 0.009);
      s2.rotation.x = Math.PI / 2; s2.position.set(-len / 2 + 0.012, 0, 0.009);
    }
    bar.castShadow = true; s1.castShadow = true; s2.castShadow = true;
    group.add(bar, s1, s2);
  }
  return group;
}

export function buildFurnitureModel(THREE, params, overrides) {
  overrides = overrides || {};
  const L = computeLayout(params);
  const group = new THREE.Group();
  group.name = 'sideboard';
  const partsById = {};

  const matFor = (partId, materialClass) => {
    const ov = overrides[partId];
    if (materialClass === 'hardware') return makeMat(THREE, findHardware(ov?.hardware || params.hardwareMaterialId));
    return makeMat(THREE, findFinish(ov?.body || params.bodyMaterialId));
  };
  const reg = (mesh, partId) => { partsById[partId] = mesh; group.add(mesh); };

  reg(box(THREE, L.panels.left.size, L.panels.left.pos, matFor('panel-left', 'body'), 'panel-left', 'panel-left'), 'panel-left');
  reg(box(THREE, L.panels.right.size, L.panels.right.pos, matFor('panel-right', 'body'), 'panel-right', 'panel-right'), 'panel-right');
  reg(box(THREE, L.panels.top.size, L.panels.top.pos, matFor('panel-top', 'body'), 'panel-top', 'panel-top'), 'panel-top');
  reg(box(THREE, L.panels.bottom.size, L.panels.bottom.pos, matFor('panel-bottom', 'body'), 'panel-bottom', 'panel-bottom'), 'panel-bottom');
  reg(box(THREE, L.panels.back.size, L.panels.back.pos, matFor('panel-back', 'body'), 'panel-back', 'panel-back'), 'panel-back');

  reg(box(THREE, L.fronts.doorLeft.size, L.fronts.doorLeft.pos, matFor('door-left', 'body'), 'door-left', 'door-left'), 'door-left');
  reg(box(THREE, L.fronts.doorRight.size, L.fronts.doorRight.pos, matFor('door-right', 'body'), 'door-right', 'door-right'), 'door-right');
  reg(box(THREE, L.fronts.drawerTop.size, L.fronts.drawerTop.pos, matFor('drawer-top', 'body'), 'drawer-top', 'drawer-top'), 'drawer-top');
  reg(box(THREE, L.fronts.drawerBottom.size, L.fronts.drawerBottom.pos, matFor('drawer-bottom', 'body'), 'drawer-bottom', 'drawer-bottom'), 'drawer-bottom');

  if (params.baseStyle === 'legs') {
    const legMatClass = params.legStyle === 'hairpin' ? 'hardware' : 'body';
    L.legPositions.forEach((lp) => {
      const partId = 'leg-' + lp.id;
      const leg = buildLeg(THREE, params.legStyle, lp, L.baseH, matFor(partId, legMatClass));
      leg.name = partId;
      leg.traverse((c) => { c.userData.partId = partId; });
      reg(leg, partId);
    });
  } else {
    reg(box(THREE, L.plinth.size, L.plinth.pos, matFor('base-plinth', 'body'), 'base-plinth', 'base-plinth'), 'base-plinth');
  }

  if (params.handleStyle !== 'recessed') {
    const anchors = [['handle-door-left', L.handleAnchors.doorLeft], ['handle-door-right', L.handleAnchors.doorRight],
      ['handle-drawer-top', L.handleAnchors.drawerTop], ['handle-drawer-bottom', L.handleAnchors.drawerBottom]];
    anchors.forEach(([partId, anchor]) => {
      const h = buildHandle(THREE, params.handleStyle, anchor, matFor(partId, 'hardware'));
      if (!h) return;
      h.name = partId;
      h.traverse((c) => { c.userData.partId = partId; });
      reg(h, partId);
    });
  }

  return { group, partsById, layout: L };
}

export function buildPanelMesh(THREE, panel, finish) {
  const mat = makeMat(THREE, finish);
  const geo = new THREE.BoxGeometry(panel.w / 1000, panel.h / 1000, panel.d / 1000);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = panel.id;
  mesh.userData.partId = panel.id;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

const PART_META = {
  'panel-left': { group: 'carcass', label: 'Side Panel (Left)' },
  'panel-right': { group: 'carcass', label: 'Side Panel (Right)' },
  'panel-top': { group: 'carcass', label: 'Top Panel' },
  'panel-bottom': { group: 'carcass', label: 'Bottom Panel' },
  'panel-back': { group: 'carcass', label: 'Back Panel' },
  'door-left': { group: 'fronts', label: 'Left Door' },
  'door-right': { group: 'fronts', label: 'Right Door' },
  'drawer-top': { group: 'fronts', label: 'Upper Drawer' },
  'drawer-bottom': { group: 'fronts', label: 'Lower Drawer' },
  'leg-fl': { group: 'base', label: 'Leg (Front Left)' },
  'leg-fr': { group: 'base', label: 'Leg (Front Right)' },
  'leg-bl': { group: 'base', label: 'Leg (Back Left)' },
  'leg-br': { group: 'base', label: 'Leg (Back Right)' },
  'base-plinth': { group: 'base', label: 'Plinth Base' },
  'handle-door-left': { group: 'hardware', label: 'Left Door Pull' },
  'handle-door-right': { group: 'hardware', label: 'Right Door Pull' },
  'handle-drawer-top': { group: 'hardware', label: 'Upper Drawer Pull' },
  'handle-drawer-bottom': { group: 'hardware', label: 'Lower Drawer Pull' },
};
export function partMeta(partId) { return PART_META[partId] || { group: 'other', label: partId }; }
export function allPartIds(params) {
  const ids = ['panel-left', 'panel-right', 'panel-top', 'panel-bottom', 'panel-back', 'door-left', 'door-right', 'drawer-top', 'drawer-bottom'];
  if (params.baseStyle === 'legs') ids.push('leg-fl', 'leg-fr', 'leg-bl', 'leg-br');
  else ids.push('base-plinth');
  if (params.handleStyle !== 'recessed') ids.push('handle-door-left', 'handle-door-right', 'handle-drawer-top', 'handle-drawer-bottom');
  return ids;
}

export function computeBOM(params) {
  const L = computeLayout(params);
  const bodyLabel = findFinish(params.bodyMaterialId).label;
  const hwLabel = findHardware(params.hardwareMaterialId).label;
  const legIsHardware = params.legStyle === 'hairpin';
  const rows = [
    { label: 'Side Panel', qty: 2, material: bodyLabel, w: L.T, h: L.panels.left.size.y, d: L.panels.left.size.z, edge: true, grain: 'Vertical', partIds: ['panel-left', 'panel-right'] },
    { label: 'Top / Bottom Panel', qty: 2, material: bodyLabel, w: L.panels.top.size.x, h: L.T, d: L.panels.top.size.z, edge: true, grain: 'Horizontal', partIds: ['panel-top', 'panel-bottom'] },
    { label: 'Back Panel', qty: 1, material: bodyLabel, w: L.panels.back.size.x, h: L.panels.back.size.y, d: L.panels.back.size.z, edge: false, grain: 'Horizontal', partIds: ['panel-back'] },
    { label: 'Door Front', qty: 2, material: bodyLabel, w: L.doorW, h: L.frontH, d: L.T, edge: true, grain: 'Vertical', partIds: ['door-left', 'door-right'] },
    { label: 'Drawer Front', qty: 2, material: bodyLabel, w: L.centerW, h: L.drawerH, d: L.T, edge: true, grain: 'Horizontal', partIds: ['drawer-top', 'drawer-bottom'] },
  ];
  if (params.baseStyle === 'legs') {
    rows.push({ label: 'Leg (' + LEG_STYLES.find(s => s.id === params.legStyle).label + ')', qty: 4, material: legIsHardware ? hwLabel : bodyLabel, w: 32, h: L.baseH, d: 32, edge: false, grain: '—', sheet: false, partIds: ['leg-fl', 'leg-fr', 'leg-bl', 'leg-br'] });
  } else {
    rows.push({ label: 'Plinth Base', qty: 1, material: bodyLabel, w: L.plinth.size.x, h: L.plinth.size.y, d: L.plinth.size.z, edge: true, grain: 'Horizontal', partIds: ['base-plinth'] });
  }
  if (params.handleStyle !== 'recessed') {
    const hs = HANDLE_STYLES.find(s => s.id === params.handleStyle).label;
    rows.push({ label: 'Door Pull (' + hs + ')', qty: 2, material: hwLabel, w: 14, h: L.handleAnchors.doorLeft.len, d: 14, edge: false, grain: '—', sheet: false, partIds: ['handle-door-left', 'handle-door-right'] });
    rows.push({ label: 'Drawer Pull (' + hs + ')', qty: 2, material: hwLabel, w: L.handleAnchors.drawerTop.len, h: 14, d: 14, edge: false, grain: '—', sheet: false, partIds: ['handle-drawer-top', 'handle-drawer-bottom'] });
  }

  let sheetAreaM2 = 0, edgeBandM = 0;
  rows.forEach((r) => {
    if (r.sheet !== false) sheetAreaM2 += (r.w * r.h / 1e6) * r.qty;
    if (r.edge) edgeBandM += (2 * (r.w + r.h) / 1000) * r.qty;
  });
  const sheets = Math.ceil(sheetAreaM2 / (2.44 * 1.22 * 0.82));
  const doorCount = 2, drawerCount = 2;
  const hardware = {
    hinges: doorCount * 2,
    slides: drawerCount,
    handles: params.handleStyle !== 'recessed' ? (doorCount + drawerCount) : 0,
    levelers: params.baseStyle === 'legs' ? 4 : 0,
  };
  return { rows, totals: { sheetAreaM2, sheets, edgeBandM, partCount: rows.reduce((s, r) => s + r.qty, 0) }, hardware };
}
