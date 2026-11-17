import { beforeEach, describe, expect, it } from 'vitest';
import { MEASURE_HINT, useUiStore } from './uiStore';

describe('toggleMeasure guidance toast', () => {
  beforeEach(() => {
    useUiStore.setState({ measureActive: false, measurePoints: [], toast: null, viewMode: 'model' });
  });

  it('shows the hint when Measure turns on', () => {
    useUiStore.getState().toggleMeasure();
    expect(useUiStore.getState().measureActive).toBe(true);
    expect(useUiStore.getState().toast?.message).toBe(MEASURE_HINT);
    expect(useUiStore.getState().toast?.dismissible).toBe(true);
  });

  it('shows nothing when Measure turns off', () => {
    useUiStore.getState().toggleMeasure();
    useUiStore.setState({ toast: null });
    useUiStore.getState().toggleMeasure();
    expect(useUiStore.getState().measureActive).toBe(false);
    expect(useUiStore.getState().toast).toBeNull();
  });

  it('shows nothing outside Model mode', () => {
    useUiStore.setState({ viewMode: 'cutlist' });
    useUiStore.getState().toggleMeasure();
    expect(useUiStore.getState().toast).toBeNull();
  });

  it('keeps ordinary toasts non-dismissible', () => {
    useUiStore.getState().showToast('Cut list exported');
    expect(useUiStore.getState().toast?.dismissible).toBeUndefined();
  });
});
