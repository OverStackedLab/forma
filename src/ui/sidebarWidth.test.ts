import { describe, expect, it } from 'vitest';
import {
  coerceLeftSidebarWidth,
  DEFAULT_LEFT_SIDEBAR_WIDTH,
  isLeftSidebarWidth,
  LEFT_SIDEBAR_WIDTH_LIMITS,
} from './sidebarWidth';

describe('coerceLeftSidebarWidth', () => {
  it('accepts the numeric string localStorage hands back', () => {
    expect(coerceLeftSidebarWidth('320')).toBe(320);
  });

  it('keeps the shipped default for anything else', () => {
    expect(coerceLeftSidebarWidth(null)).toBe(DEFAULT_LEFT_SIDEBAR_WIDTH);
    expect(coerceLeftSidebarWidth(undefined)).toBe(DEFAULT_LEFT_SIDEBAR_WIDTH);
    expect(coerceLeftSidebarWidth(Number.NaN)).toBe(DEFAULT_LEFT_SIDEBAR_WIDTH);
    expect(coerceLeftSidebarWidth('wide')).toBe(DEFAULT_LEFT_SIDEBAR_WIDTH);
  });

  it('clamps and rounds typed values to whole pixels', () => {
    expect(coerceLeftSidebarWidth(120)).toBe(LEFT_SIDEBAR_WIDTH_LIMITS.min);
    expect(coerceLeftSidebarWidth(900)).toBe(LEFT_SIDEBAR_WIDTH_LIMITS.max);
    expect(coerceLeftSidebarWidth(321.4)).toBe(321);
    expect(coerceLeftSidebarWidth(321.6)).toBe(322);
  });
});

describe('isLeftSidebarWidth', () => {
  it('accepts only whole pixels inside the limits', () => {
    expect(isLeftSidebarWidth(240)).toBe(true);
    expect(isLeftSidebarWidth(200)).toBe(true);
    expect(isLeftSidebarWidth(480)).toBe(true);
    expect(isLeftSidebarWidth(240.5)).toBe(false);
    expect(isLeftSidebarWidth('240')).toBe(false);
    expect(isLeftSidebarWidth(199)).toBe(false);
    expect(isLeftSidebarWidth(481)).toBe(false);
  });
});
