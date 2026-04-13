'use client';

import { buildCsvString } from '@/lib/csv';
import type { GameLineup, Game } from '@cli/types';

interface Props {
  game: Game;
  lineup: GameLineup;
}

export default function DownloadCsvButton({ game, lineup }: Props) {
  function handleDownload() {
    const csv = buildCsvString(lineup, game);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineup-${game.id}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  }

  return (
    <button
      onClick={handleDownload}
      className="px-4 py-1.5 bg-white text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
    >
      Download CSV
    </button>
  );
}
