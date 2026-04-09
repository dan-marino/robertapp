import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readRoster, readSeason, readRsvps } from '@/lib/data';
import { formatGameDate } from '@/lib/utils';
import { generateLineup } from '@cli/generator';
import LineupGrid from '@/components/LineupGrid';
import DownloadCsvButton from '@/components/DownloadCsvButton';

export const dynamic = 'force-dynamic';

export default async function LineupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { games } = readSeason();
  const game = games.find(g => g.id === id);
  if (!game) notFound();

  const date = formatGameDate(game.date, 'long');

  const rsvps = readRsvps(id);

  if (rsvps.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold mb-1">Lineup</h1>
        <p className="text-gray-500 text-sm mb-6">{date} · vs {game.opponent}</p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
          No RSVPs recorded yet.{' '}
          <Link href={`/games/${id}/rsvp`} className="underline font-medium">
            Enter RSVPs first
          </Link>
          .
        </div>
      </div>
    );
  }

  const players = readRoster();
  let lineup;

  try {
    lineup = generateLineup(rsvps, players);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return (
      <div>
        <h1 className="text-xl font-semibold mb-1">Lineup</h1>
        <p className="text-gray-500 text-sm mb-6">{date} · vs {game.opponent}</p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
          Could not generate lineup: {message}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Lineup</h1>
          <p className="text-gray-500 text-sm mt-1">{date} · vs {game.opponent}</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {lineup.guysCount} guys · {lineup.girlsCount} girls
          </p>
        </div>
        <DownloadCsvButton gameId={id} lineup={lineup} />
      </div>
      <LineupGrid lineup={lineup} />
    </div>
  );
}
