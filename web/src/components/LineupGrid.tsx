'use client';

import { Position, Gender } from '@cli/types';
import type { GameLineup } from '@cli/types';

const INNINGS = [1, 2, 3, 4, 5, 6];

// Color by position group
const POSITION_STYLE: Record<string, string> = {
  [Position.PITCHER]:     'bg-yellow-100 text-yellow-800',
  [Position.CATCHER]:     'bg-orange-100 text-orange-800',
  [Position.FIRST_BASE]:  'bg-purple-100 text-purple-800',
  [Position.SECOND_BASE]: 'bg-purple-100 text-purple-800',
  [Position.THIRD_BASE]:  'bg-purple-100 text-purple-800',
  [Position.SHORTSTOP]:   'bg-indigo-100 text-indigo-800',
  [Position.LEFT_FIELD]:  'bg-green-100 text-green-800',
  [Position.LEFT_CENTER]: 'bg-green-100 text-green-800',
  [Position.RIGHT_CENTER]:'bg-green-100 text-green-800',
  [Position.RIGHT_FIELD]: 'bg-green-100 text-green-800',
  [Position.BENCH]:       'bg-gray-100 text-gray-400',
};

interface Props {
  lineup: GameLineup;
}

export default function LineupGrid({ lineup }: Props) {
  const guys = lineup.lineup.slice(0, lineup.guysCount);
  const girls = lineup.lineup.slice(lineup.guysCount);

  return (
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-medium text-gray-600 min-w-36">Name</th>
            <th className="text-center px-3 py-2 font-medium text-gray-600 w-10">Bat</th>
            {INNINGS.map(i => (
              <th key={i} className="text-center px-3 py-2 font-medium text-gray-600 w-14">Inn {i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="Guys" count={guys.length} color="blue" />
          {guys.map(pl => <PlayerRow key={pl.player.id} pl={pl} />)}
          <SectionHeader label="Girls" count={girls.length} color="pink" />
          {girls.map(pl => <PlayerRow key={pl.player.id} pl={pl} />)}
        </tbody>
      </table>
    </div>
  );
}

function SectionHeader({ label, count, color }: { label: string; count: number; color: 'blue' | 'pink' }) {
  const cls = color === 'blue'
    ? 'bg-blue-50 text-blue-700'
    : 'bg-pink-50 text-pink-700';
  return (
    <tr className={cls}>
      <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">
        {label} ({count})
      </td>
    </tr>
  );
}

function PlayerRow({ pl }: { pl: GameLineup['lineup'][0] }) {
  const preferred = pl.player.preferredPositions ?? [];
  const anti = pl.player.antiPositions ?? [];

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-1.5 font-medium">
        {pl.player.firstName} {pl.player.lastName}
      </td>
      <td className="px-3 py-1.5 text-center text-gray-500">{pl.battingOrder}</td>
      {pl.positions.map((pos, i) => {
        const isBench = pos === Position.BENCH;
        const isPreferred = preferred.includes(pos as Position);
        const isAnti = anti.includes(pos as Position);

        let cellClass = POSITION_STYLE[pos] ?? 'bg-gray-50 text-gray-500';
        if (isPreferred) cellClass = 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-300';
        if (isAnti) cellClass = 'bg-red-100 text-red-800 ring-1 ring-red-400';

        return (
          <td key={i} className="px-1 py-1.5 text-center">
            <span className={`inline-block w-10 text-xs font-mono font-medium rounded px-1 py-0.5 ${cellClass} ${isBench ? 'opacity-40' : ''}`}>
              {pos}
            </span>
          </td>
        );
      })}
    </tr>
  );
}
