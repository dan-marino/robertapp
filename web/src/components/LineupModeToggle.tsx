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

  async function select(mode: LineupMode) {
    if (mode === currentMode || loading) return;
    setLoading(true);
    await fetch(`/api/games/${gameId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lineupMode: mode }),
    });
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex rounded border border-gray-300 overflow-hidden text-xs font-medium disabled:opacity-50">
      {(['split', 'unified'] as LineupMode[]).map(mode => {
        const isActive = currentMode === mode;
        const label = mode === 'split' ? 'Split' : 'Unified';
        return (
          <button
            key={mode}
            onClick={() => select(mode)}
            disabled={loading}
            className={`px-3 py-1.5 transition-colors disabled:opacity-50 ${
              isActive
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
