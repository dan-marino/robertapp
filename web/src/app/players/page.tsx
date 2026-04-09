import { readRoster } from '@/lib/data';
import PlayerList from '@/components/PlayerList';

export const dynamic = 'force-dynamic';

export default function PlayersPage() {
  const players = readRoster();
  return <PlayerList players={players} />;
}
