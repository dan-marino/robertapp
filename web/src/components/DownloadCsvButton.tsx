'use client';

import { buildCsvString } from '@/lib/csv';
import type { GameLineup } from '@cli/types';

interface Props {
  gameId: string;
  lineup: GameLineup;
}

export default function DownloadCsvButton({ gameId, lineup }: Props) {
  function handleDownload() {
    const csv = buildCsvString(lineup);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineup-${gameId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
