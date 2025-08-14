import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UsageWidget from './UsageWidget';

describe('UsageWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('shows skeleton for at least 300ms, then renders X/Y and reset note', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ used: 500, limit: 1000, resetAt: new Date().toISOString() }),
      text: async () => '',
    });

    render(<UsageWidget />);

    // Skeleton initially
    expect(document.querySelector('.animate-pulse')).toBeTruthy();

    // Before 300ms, skeleton should still be visible
    vi.advanceTimersByTime(299);
    expect(document.querySelector('.animate-pulse')).toBeTruthy();

    // After >=300ms, skeleton can disappear and data should be shown
    vi.advanceTimersByTime(2);

    await waitFor(() => {
      expect(screen.getAllByText(/500\s*\/\s*1000/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Reset le 1ᵉʳ du mois/)).toBeInTheDocument();
    });
  });

  it('shows generic error with retry, logs error event, and recovers on retry', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    (fetch as any)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        // Provide clone().json() so the widget can extract request_id
        clone: () => ({ json: async () => ({ error: 'Failed to fetch usage', request_id: 'req-123' }) }),
        json: async () => ({ error: 'Failed to fetch usage', request_id: 'req-123' }),
        text: async () => 'Failed to fetch usage',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ used: 42, limit: 100, resetAt: new Date().toISOString() }),
        text: async () => '',
      });

    render(<UsageWidget />);

    // After first (failed) request, a generic error message and retry button should appear
    await waitFor(() => {
      expect(screen.getByText(/Une erreur est survenue\. Veuillez réessayer\./i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Réessayer/i })).toBeInTheDocument();
    });

    // Structured error log emitted
    const logged = logSpy.mock.calls.map((c) => c[0]);
    expect(logged.some((entry) => {
      try {
        const obj = JSON.parse(entry);
        return obj.event === 'dashboard_usage_error' && obj.status === 500 && obj.request_id === 'req-123';
      } catch {
        return false;
      }
    })).toBe(true);

    // Click retry: skeleton should appear for >=300ms, then data shows
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));

    // Skeleton shown immediately on retry
    expect(document.querySelector('.animate-pulse')).toBeTruthy();
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(screen.getAllByText(/42\s*\/\s*100/).length).toBeGreaterThan(0);
    });

    logSpy.mockRestore();
  });

  it('auto-refreshes every 60s', async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ used: 1, limit: 10, resetAt: new Date().toISOString() }), text: async () => '' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ used: 2, limit: 10, resetAt: new Date().toISOString() }), text: async () => '' });

    render(<UsageWidget />);
    await waitFor(() => {
      // First fetch
      expect(screen.getAllByText(/1\s*\/\s*10/).length).toBeGreaterThan(0);
    });

    // Advance 60 seconds to trigger refresh
    vi.advanceTimersByTime(60_000);

    await waitFor(() => {
      expect(screen.getAllByText(/2\s*\/\s*10/).length).toBeGreaterThan(0);
    });
  });
});
