import type { GameLineup, PlayerLineup, Game } from '@cli/types';

export function buildCsvString(lineup: GameLineup, game: Game): string {
  const lines: string[] = [];

  // Game number from id (e.g. "g1" → 1)
  const gameNum = game.id.replace(/\D/g, '');

  // Date parts
  const date = new Date(game.date + 'T12:00:00');
  const dayShort = date.toLocaleDateString('en-US', { weekday: 'short' }); // "Mon"
  const dateShort = `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear()).slice(2)}`;
  const timePart = game.time ? ` ${game.time}` : '';

  // Row 1: game title
  lines.push(`Game ${gameNum} ${dayShort}${timePart} ${dateShort} ${game.opponent},,,,,,,,FINAL`);
  // Rows 2-3: scores
  lines.push(',Home');
  lines.push(',Away');
  // Row 4: empty separator
  lines.push('');
  // Row 5: column headers
  lines.push('Order,Name,ABs,1,2,3,4,5,6');

  const guys = lineup.lineup.slice(0, lineup.guysCount);
  const girls = lineup.lineup.slice(lineup.guysCount);

  lines.push(...guys.map(buildRow));
  lines.push('');
  lines.push(...girls.map(buildRow));

  return lines.join('\n');
}

function buildRow(p: PlayerLineup): string {
  const name = `${p.player.firstName} ${p.player.lastName}`;
  return `${p.battingOrder},${name},,${p.positions.join(',')}`;
}
