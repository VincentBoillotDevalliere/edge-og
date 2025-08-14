"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type UsageResponse = {
  used: number;
  limit: number;
  resetAt: string; // ISO date string (UTC)
};

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

export default function UsageWidget() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // UI skeleton control separate from network state to guarantee a minimum display time
  const [showSkeleton, setShowSkeleton] = useState(true);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  // Fetch usage with optional skeleton UX on demand (initial load + manual retry)
  const fetchUsage = async (opts?: { withSkeleton?: boolean; signal?: AbortSignal }) => {
    const { withSkeleton = false, signal } = opts || {};
    let started = 0;
    try {
      setError(null);
      if (withSkeleton) {
        // Show skeleton immediately; we'll ensure a minimum 300ms display below
        setShowSkeleton(true);
      }

      started = performance.now();
      const res = await fetch("/dashboard/usage", {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!res.ok) {
        // Try to extract structured error for logging
        let requestId: string | undefined;
        try {
          const maybeJson = await res.clone().json();
          requestId = (maybeJson && maybeJson.request_id) || undefined;
        } catch {}
        // Emit structured client-side log (JSON) for observability
        try {
          console.log(
            JSON.stringify({
              event: "dashboard_usage_error",
              status: res.status,
              request_id: requestId,
            })
          );
        } catch {}
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as UsageResponse;
      // Basic validation
      if (
        typeof json.used !== "number" ||
        typeof json.limit !== "number" ||
        typeof json.resetAt !== "string"
      ) {
        throw new Error("Malformed usage payload");
      }
      setData(json);
    } catch (e) {
      if ((e as any)?.name === "AbortError") return; // ignore abort
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      if (withSkeleton) {
  // Ensure skeleton visible at least 300ms from fetch start
  const since = performance.now() - started;
        const delay = Math.max(0, 300 - since);
        if (delay > 0) {
          setTimeout(() => setShowSkeleton(false), delay);
        } else {
          setShowSkeleton(false);
        }
      }
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    inFlightRef.current = ac;
    fetchUsage({ withSkeleton: true, signal: ac.signal });

    // Auto-refresh every 60s
    timerRef.current = window.setInterval(() => {
      const r = new AbortController();
      inFlightRef.current = r;
      // Do not show skeleton on background refresh to avoid UI flicker
      fetchUsage({ withSkeleton: false, signal: r.signal });
    }, 60_000);

    return () => {
      ac.abort();
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = useMemo(() => {
    if (!data) return 0;
    if (data.limit <= 0) return 0;
    return clamp(data.used / data.limit) * 100;
  }, [data]);

  const severity = useMemo<"normal" | "high" | "critical">(() => {
    if (pct > 95) return "critical";
    if (pct > 80) return "high";
    return "normal";
  }, [pct]);

  const badge = useMemo(() => {
    if (!data) return null;
    if (severity === "normal") return null;
    const pctLabel = Math.round(pct);
    const isCritical = severity === "critical";
    const bg = isCritical ? "bg-[#ef4444]" : "bg-[#f59e0b]"; // red-500 / amber-500
    const text = isCritical ? "Critique" : "Élevé";
    const aria = `Alerte consommation ${isCritical ? "critique" : "élevée"}: ${pctLabel}%`;
    return (
      <span
        role="status"
        aria-live="polite"
        aria-label={aria}
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] sm:text-xs font-medium text-white ${bg}`}
      >
        {text}
      </span>
    );
  }, [data, pct, severity]);

  return (
    <section
      aria-label="Consommation"
      className="w-full max-w-xl rounded-2xl border border-black/10 dark:border-white/15 p-5 sm:p-6 shadow-sm bg-white dark:bg-black"
    >
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-base sm:text-lg font-semibold">Consommation</h2>
          {badge}
        </div>
        {data && (
          <span className="text-xs sm:text-sm text-black/60 dark:text-white/60 whitespace-nowrap">
            {new Intl.NumberFormat().format(data.used)} / {new Intl.NumberFormat().format(data.limit)}
          </span>
        )}
      </header>

      {/* Progress content */}
      {showSkeleton ? (
        <div className="animate-pulse" aria-live="polite" aria-busy="true">
          <div className="h-3 w-full rounded-full bg-black/[.06] dark:bg-white/[.08]" />
          <div className="mt-3 h-4 w-40 rounded bg-black/[.06] dark:bg-white/[.08]" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400 flex items-center justify-between gap-3">
          <span>Une erreur est survenue. Veuillez réessayer.</span>
          <button
            type="button"
            onClick={() => {
              // Abort any in-flight request before retry
              inFlightRef.current?.abort();
              const r = new AbortController();
              inFlightRef.current = r;
              // On manual retry, show skeleton with minimum display
              void fetchUsage({ withSkeleton: true, signal: r.signal });
            }}
            className="inline-flex items-center rounded-md bg-black/80 dark:bg-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black dark:focus:ring-white/40"
            aria-label="Réessayer de charger la consommation"
          >
            Réessayer
          </button>
        </div>
      ) : data ? (
        <div className="space-y-2.5">
          <div
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Barre de progression de consommation"
            className="h-3 w-full rounded-full bg-black/[.06] dark:bg-white/[.08] overflow-hidden"
          >
            <div
              className="h-full bg-[#6366f1] dark:bg-[#8b5cf6] transition-[width] duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm text-black/70 dark:text-white/70">
            <span>
              {new Intl.NumberFormat().format(data.used)} / {new Intl.NumberFormat().format(data.limit)}
            </span>
            <span>Reset le 1ᵉʳ du mois (UTC)</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
