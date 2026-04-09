import type { GameLineup, PlayerLineup } from '@cli/types';

export function buildCsvString(lineup: GameLineup): string {
  const lines: string[] = [];
  lines.push('Name,Inn1,Inn2,Inn3,Inn4,Inn5,Inn6');

  const guys = lineup.lineup.slice(0, lineup.guysCount);
  const girls = lineup.lineup.slice(lineup.guysCount);

  lines.push(...guys.map(buildRow));
  lines.push('');
  lines.push(...girls.map(buildRow));

  return lines.join('\n');
}

function buildRow(p: PlayerLineup): string {
  const name = `${p.battingOrder}. ${p.player.firstName} ${p.player.lastName}`;
  return `${name},${p.positions.join(',')}`;
}
