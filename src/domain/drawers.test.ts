import { describe, expect, it } from 'vitest';
import { buildDrawerLayout, DRAWER_MEMBER_COUNT, DRAWER_PRESETS } from './drawers';

describe('DRAWER_PRESETS', () => {
  it('sizes the 60×20 box inside a 600 mm carcass with overlay room', () => {
    const preset = DRAWER_PRESETS.find((item) => item.id === 'drawer-600-200');
    expect(preset).toMatchObject({ width: 562, height: 180, depth: 550 });
  });

  it('covers the BODBYN drawer-front widths', () => {
    expect(DRAWER_PRESETS.map((preset) => preset.id)).toEqual([
      'drawer-400-200',
      'drawer-400-400',
      'drawer-600-100',
      'drawer-600-200',
      'drawer-800-200',
      'drawer-800-400',
    ]);
  });
});

describe('buildDrawerLayout', () => {
  it('builds four panels with 18 mm sides and an 8 mm bottom and back', () => {
    const parts = buildDrawerLayout({ label: 'Drawer 60×20', width: 562, height: 180, depth: 550 });
    expect(parts).toHaveLength(DRAWER_MEMBER_COUNT);
    expect(parts[0]).toMatchObject({ label: 'Drawer 60×20 Left Side', w: 18, h: 180, d: 550 });
    expect(parts[1]).toMatchObject({ label: 'Drawer 60×20 Right Side', w: 18, h: 180, d: 550 });
    expect(parts[2]).toMatchObject({ label: 'Drawer 60×20 Bottom', w: 526, h: 8, d: 542 });
    expect(parts[3]).toMatchObject({ label: 'Drawer 60×20 Back', w: 526, h: 172, d: 8 });
  });

  it('keeps the bottom-centre origin so the underside sits at y = 0', () => {
    const parts = buildDrawerLayout({ label: 'Drawer', width: 562, height: 180, depth: 550 });
    const bottom = parts[2]!;
    expect(bottom.positionMm[1]).toBe(4);
    const left = parts[0]!;
    expect(left.positionMm[1]).toBe(90);
  });
});
