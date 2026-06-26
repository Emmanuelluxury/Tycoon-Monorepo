/**
 * Web Vitals monitoring hook for the Purchase Modal (SW-FE-028).
 *
 * Tracks CLS and LCP for the modal open / content-paint cycle so the
 * performance budget can be enforced in CI and dashboards.
 *
 * Budget targets (matching Stellar Wave FE standards):
 *  - Largest Contentful Paint (LCP): < 2 500 ms
 *  - Cumulative Layout Shift  (CLS): < 0.1
 */

'use client';

import { useEffect } from 'react';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
}

interface PurchaseModalWebVitalsConfig {
  /** Override reporting endpoint (defaults to /api/v1/metrics). */
  reportingEndpoint?: string;
  /** Emit debug logs in development (auto-detected). */
  debug?: boolean;
  budgets?: {
    lcp?: number;
    cls?: number;
  };
}

/**
 * Monitor CLS and LCP while the Purchase Modal is open.
 *
 * Call this hook inside PurchaseModal (or its parent) and pass `isOpen`.
 * Observers are started when `isOpen` becomes true and disconnected when
 * the modal closes or the component unmounts.
 */
export function usePurchaseModalWebVitals(
  isOpen: boolean,
  config: PurchaseModalWebVitalsConfig = {},
): void {
  const {
    debug = process.env.NODE_ENV === 'development',
    reportingEndpoint = '/api/v1/metrics',
    budgets = { lcp: 2500, cls: 0.1 },
  } = config;

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const reportMetric = async (metric: PerformanceMetric): Promise<void> => {
      if (debug) {
        // eslint-disable-next-line no-console
        console.debug('[Purchase Modal Web Vitals]', metric.name, metric.value.toFixed(3), metric.rating);
      }
      if (process.env.NODE_ENV !== 'production') return;
      try {
        await fetch(reportingEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            route: '/shop',
            component: 'purchase-modal',
            metric: { name: metric.name, value: metric.value, rating: metric.rating, delta: metric.delta },
          }),
          keepalive: true,
        }).catch(() => {
          // Silently fail — metrics are best-effort
        });
      } catch {
        // Silently fail
      }
    };

    const observers: PerformanceObserver[] = [];

    // ── LCP observer ──────────────────────────────────────────────────
    if ('PerformanceObserver' in window) {
      try {
        const lcpObs = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
          };
          const value = last.renderTime ?? last.loadTime ?? 0;
          const budget = budgets.lcp ?? 2500;
          const metric: PerformanceMetric = {
            name: 'LCP',
            value,
            rating: value <= budget ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor',
            delta: 0,
          };
          reportMetric(metric);
        });
        lcpObs.observe({ entryTypes: ['largest-contentful-paint'] });
        observers.push(lcpObs);
      } catch {
        // PerformanceObserver not supported for this entry type — skip silently
      }

      // ── CLS observer ──────────────────────────────────────────────────
      try {
        let clsValue = 0;
        let sessionValue = 0;
        let sessionEntries: PerformanceEntry[] = [];

        const clsObs = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as Array<PerformanceEntry & { hadRecentInput?: boolean; value?: number }>) {
            if (entry.hadRecentInput) continue;
            const lastSession = sessionEntries[sessionEntries.length - 1];
            const firstSession = sessionEntries[0];

            if (
              lastSession &&
              entry.startTime - lastSession.startTime < 1000 &&
              firstSession &&
              entry.startTime - firstSession.startTime < 5000
            ) {
              sessionEntries.push(entry);
              sessionValue += entry.value ?? 0;
            } else {
              sessionEntries = [entry];
              sessionValue = entry.value ?? 0;
            }
            clsValue = Math.max(clsValue, sessionValue);
          }

          const budget = budgets.cls ?? 0.1;
          if (clsValue > budget) {
            const metric: PerformanceMetric = {
              name: 'CLS',
              value: clsValue,
              rating: clsValue <= budget ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
              delta: clsValue,
            };
            reportMetric(metric);
          }
        });
        clsObs.observe({ entryTypes: ['layout-shift'] });
        observers.push(clsObs);
      } catch {
        // PerformanceObserver not supported for this entry type — skip silently
      }
    }

    return () => {
      for (const obs of observers) obs.disconnect();
    };
  }, [isOpen, debug, reportingEndpoint, budgets]);
}
