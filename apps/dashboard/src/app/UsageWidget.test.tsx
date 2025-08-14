import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import UsageWidget from './UsageWidget';

describe('UsageWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('renders skeleton then data with X/Y text and reset note', async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ used: 500, limit: 1000, resetAt: new Date().toISOString() }),
      text: async () => '',
    });

    render(<UsageWidget />);

    // Skeleton initially
    expect(document.querySelector('.animate-pulse')).toBeTruthy();

    // Resolve
    await waitFor(() => {
      expect(screen.getAllByText(/500/).length).toBeGreaterThan(0);
      expect(screen.getByText(/Reset le 1ᵉʳ du mois/)).toBeInTheDocument();
    });
  });

  it('shows error message on fetch failure', async () => {
    (fetch as any).mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'boom' });

    render(<UsageWidget />);

    await waitFor(() => {
      expect(screen.getByText(/Impossible de récupérer la consommation/i)).toBeInTheDocument();
    });
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
