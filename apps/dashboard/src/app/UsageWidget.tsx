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
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<number | null>(null);

  const fetchUsage = async (signal?: AbortSignal) => {
    try {
      setError(null);
      const res = await fetch("/dashboard/usage", {
        credentials: "include",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!res.ok) {
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
      setLoading(false);
    }
  };

  useEffect(() => {
    const ac = new AbortController();
    fetchUsage(ac.signal);

    // Auto-refresh every 60s
    timerRef.current = window.setInterval(() => {
      const r = new AbortController();
      fetchUsage(r.signal);
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

  return (
    <section
      aria-label="Consommation"
      className="w-full max-w-xl rounded-2xl border border-black/10 dark:border-white/15 p-5 sm:p-6 shadow-sm bg-white dark:bg-black"
    >
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold">Consommation</h2>
        {data && (
          <span className="text-xs sm:text-sm text-black/60 dark:text-white/60">
            {new Intl.NumberFormat().format(data.used)} / {new Intl.NumberFormat().format(data.limit)}
          </span>
        )}
      </header>

      {/* Progress content */}
      {loading ? (
        <div className="animate-pulse">
          <div className="h-3 w-full rounded-full bg-black/[.06] dark:bg-white/[.08]" />
          <div className="mt-3 h-4 w-40 rounded bg-black/[.06] dark:bg-white/[.08]" />
        </div>
      ) : error ? (
        <div className="text-sm text-red-600 dark:text-red-400">
          Impossible de récupérer la consommation. Réessayer plus tard.
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
