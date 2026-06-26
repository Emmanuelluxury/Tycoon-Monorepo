/**
 * usePurchaseModalWebVitals unit tests (SW-FE-028)
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { usePurchaseModalWebVitals } from '@/hooks/usePurchaseModalWebVitals';

// jsdom has no PerformanceObserver — ensure the hook is safe when absent
describe('usePurchaseModalWebVitals', () => {
  afterEach(() => vi.restoreAllMocks());

  it('mounts without errors when isOpen is false', () => {
    expect(() => {
      renderHook(() => usePurchaseModalWebVitals(false));
    }).not.toThrow();
  });

  it('mounts without errors when isOpen is true (no PerformanceObserver in jsdom)', () => {
    expect(() => {
      renderHook(() => usePurchaseModalWebVitals(true));
    }).not.toThrow();
  });

  it('does not throw when PerformanceObserver is absent', () => {
    const original = (globalThis as unknown as Record<string, unknown>).PerformanceObserver;
    delete (globalThis as unknown as Record<string, unknown>).PerformanceObserver;
    expect(() => {
      renderHook(() => usePurchaseModalWebVitals(true));
    }).not.toThrow();
    (globalThis as unknown as Record<string, unknown>).PerformanceObserver = original;
  });

  it('returns undefined (void hook)', () => {
    const { result } = renderHook(() => usePurchaseModalWebVitals(false));
    expect(result.current).toBeUndefined();
  });

  it('accepts custom budget config without error', () => {
    expect(() => {
      renderHook(() =>
        usePurchaseModalWebVitals(true, { budgets: { lcp: 3000, cls: 0.05 } }),
      );
    }).not.toThrow();
  });
});
