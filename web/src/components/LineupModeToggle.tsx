'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { LineupMode } from '@cli/types';

interface Props {
  gameId: string;
  currentMode: LineupMode;
}

export default function LineupModeToggle({ gameId, currentMode }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const nextMode: LineupMode = currentMode === 'unified' ? 'split' : 'unified';
    setLoading(true);
    await fetch(`/api/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineupMode: nextMode }),
    });
    router.refresh();
    setLoading(false);
  }

  const isUnified = currentMode === 'unified';

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="text-xs px-3 py-1.5 rounded border font-medium transition-colors disabled:opacity-50"
      style={
        isUnified
          ? { borderColor: '#6366f1', color: '#6366f1', backgroundColor: '#eef2ff' }
          : { borderColor: '#d1d5db', color: '#374151', backgroundColor: '#fff' }
      }
    >
      {isUnified ? 'Unified lineup' : 'Split lineup'}
    </button>
  );
}
