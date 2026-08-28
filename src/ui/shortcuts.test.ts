import { describe, expect, it } from 'vitest';
import { formatShortcut, MOD_KEY } from './shortcuts';

describe('formatShortcut', () => {
  it('writes the Apple accelerator as joined glyphs', () => {
    expect(formatShortcut('mod+D', '⌘')).toBe('⌘D');
    expect(formatShortcut('mod+A', '⌘')).toBe('⌘A');
  });

  it('writes every other platform with a plus', () => {
    // BUG-041: the hint strip used to claim ⌘ on Windows and Linux.
    expect(formatShortcut('mod+D', 'Ctrl')).toBe('Ctrl+D');
    expect(formatShortcut('mod+A', 'Ctrl')).toBe('Ctrl+A');
  });

  it('passes through shortcuts that have no platform modifier', () => {
    expect(formatShortcut('Shift+F', 'Ctrl')).toBe('Shift+F');
    expect(formatShortcut('Del', '⌘')).toBe('Del');
  });

  it('is case-insensitive about the mod token', () => {
    expect(formatShortcut('MOD+Z', 'Ctrl')).toBe('Ctrl+Z');
  });

  it('defaults to the detected platform modifier', () => {
    expect(formatShortcut('mod+D')).toBe(MOD_KEY === '⌘' ? '⌘D' : `${MOD_KEY}+D`);
  });
});
