import { notFound } from 'next/navigation';
import { readRoster, readSeason, readRsvps } from '@/lib/data';
import { formatGameDate } from '@/lib/utils';
import RsvpTable from '@/components/RsvpTable';

export const dynamic = 'force-dynamic';

export default async function RsvpPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { games } = readSeason();
  const game = games.find(g => g.id === id);
  if (!game) notFound();

  const players = readRoster();
  const rsvps = readRsvps(id);

  const date = formatGameDate(game.date, 'long');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold">RSVP</h1>
        <p className="text-gray-500 text-sm mt-1">{date} · vs {game.opponent}</p>
      </div>
      <RsvpTable gameId={id} players={players} initialRsvps={rsvps} />
    </div>
  );
}
