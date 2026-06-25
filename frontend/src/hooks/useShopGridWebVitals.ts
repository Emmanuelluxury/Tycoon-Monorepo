/**
 * Web Vitals monitoring for the Shop Grid (SW-FE-020).
 *
 * Tracks CLS and LCP for the shop grid to ensure it meets performance budgets.
 *
 * Budget targets:
 *  - Largest Contentful Paint (LCP): < 2.5 s
 *  - Cumulative Layout Shift (CLS): < 0.1
 */

"use client";

import { useEffect } from "react";

interface PerformanceMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  delta: number;
}

interface ShopGridWebVitalsConfig {
  reportingEndpoint?: string;
  debug?: boolean;
  budgets?: {
    lcp?: number;
    cls?: number;
  };
}

/**
 * Hook to monitor CLS and LCP for the Shop Grid.
 * Wire it at the component level; it self-cleans on unmount.
 */
export function useShopGridWebVitals(config: ShopGridWebVitalsConfig = {}): void {
  const {
    debug = process.env.NODE_ENV === "development",
    reportingEndpoint = "/api/v1/metrics",
    budgets = {
      lcp: 2500, // ms
      cls: 0.1,  // unitless
    },
  } = config;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const metrics: Record<string, PerformanceMetric> = {};

    const reportMetric = async (metric: PerformanceMetric): Promise<void> => {
      if (debug) {
        console.debug("[ShopGrid Web Vitals]", metric.name, metric.value.toFixed(3), metric.rating);
      }
      if (process.env.NODE_ENV === "production") {
        await fetch(reportingEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timestamp: new Date().toISOString(),
            route: "/shop",
            metric: { name: metric.name, value: metric.value, rating: metric.rating, delta: metric.delta },
          }),
          keepalive: true,
        }).catch(() => {
          // Silently fail — metrics must never break the UI
        });
      }
    };

    const observeLCP = (): PerformanceObserver | undefined => {
      if (!("PerformanceObserver" in window)) return;
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
          };
          const value = last.renderTime ?? last.loadTime ?? 0;
          const metric: PerformanceMetric = {
            name: "LCP",
            value,
            rating: value <= (budgets.lcp ?? 2500) ? "good" : value <= 4000 ? "needs-improvement" : "poor",
            delta: 0,
          };
          metrics.lcp = metric;
          reportMetric(metric);
        });
        observer.observe({ entryTypes: ["largest-contentful-paint"] });
        return observer;
      } catch {
        if (debug) console.error("[ShopGrid LCP] Observation failed");
      }
    };

    const observeCLS = (): PerformanceObserver | undefined => {
      if (!("PerformanceObserver" in window)) return;
      try {
        let clsValue = 0;
        let sessionValue = 0;
        let sessionEntries: (PerformanceEntry & { startTime: number; value: number; hadRecentInput: boolean })[] = [];

        const observer = new PerformanceObserver((list) => {
          for (const raw of list.getEntries()) {
            const entry = raw as typeof raw & { value: number; hadRecentInput: boolean };
            if (!entry.hadRecentInput) {
              const first = sessionEntries[0];
              const last = sessionEntries[sessionEntries.length - 1];
              if (
                entry.startTime - (last?.startTime ?? 0) < 1000 &&
                entry.startTime - (first?.startTime ?? 0) < 5000
              ) {
                sessionEntries.push(entry as typeof sessionEntries[number]);
                sessionValue += entry.value;
              } else {
                sessionEntries = [entry as typeof sessionEntries[number]];
                sessionValue = entry.value;
              }
              clsValue = Math.max(clsValue, sessionValue);
            }
          }

          const budget = budgets.cls ?? 0.1;
          const metric: PerformanceMetric = {
            name: "CLS",
            value: clsValue,
            rating: clsValue <= budget ? "good" : clsValue <= 0.25 ? "needs-improvement" : "poor",
            delta: clsValue,
          };
          metrics.cls = metric;
          if (clsValue > budget) {
            reportMetric(metric);
          }
        });

        observer.observe({ entryTypes: ["layout-shift"] });
        return observer;
      } catch {
        if (debug) console.error("[ShopGrid CLS] Observation failed");
      }
    };

    const lcpObserver = observeLCP();
    const clsObserver = observeCLS();

    const handleBeforeUnload = (): void => {
      if (metrics.lcp) reportMetric(metrics.lcp);
      if (metrics.cls && metrics.cls.value > 0) reportMetric(metrics.cls);
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      lcpObserver?.disconnect();
      clsObserver?.disconnect();
    };
  }, [debug, reportingEndpoint, budgets]);
}
