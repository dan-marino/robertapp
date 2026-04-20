'use client';

import { useState } from 'react';
import { Position, Gender } from '@cli/types';
import type { GameLineup } from '@cli/types';
import { intersperseBattingOrder } from '@cli/utils/intersperse';

const INNINGS = [1, 2, 3, 4, 5, 6];

const FIELD_POSITIONS: Position[] = [
  Position.PITCHER,
  Position.CATCHER,
  Position.FIRST_BASE,
  Position.SECOND_BASE,
  Position.THIRD_BASE,
  Position.SHORTSTOP,
  Position.LEFT_FIELD,
  Position.LEFT_CENTER,
  Position.RIGHT_CENTER,
  Position.RIGHT_FIELD,
];

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
  const [players, setPlayers] = useState(lineup.lineup);

  const isUnified = lineup.lineupMode === 'unified';

  // For split mode: guys are first guysCount entries, girls are the rest
  const guys = isUnified
    ? players.filter(pl => pl.player.gender === Gender.MALE)
    : players.slice(0, lineup.guysCount);
  const girls = isUnified
    ? players.filter(pl => pl.player.gender === Gender.FEMALE)
    : players.slice(lineup.guysCount);

  function shuffleOrder() {
    const guysShuffled = shuffleArray(guys);
    const girlsShuffled = shuffleArray(girls);

    if (isUnified) {
      // Re-run intersperse to maintain placement rules, then assign unified batting order
      const merged = intersperseBattingOrder(
        guysShuffled.map(pl => ({ player: pl.player, isLate: false, inningsPlayed: 0 })),
        girlsShuffled.map(pl => ({ player: pl.player, isLate: false, inningsPlayed: 0 }))
      );
      // Restore positions from the current players array
      const positionsById = new Map(players.map(pl => [pl.player.id, pl.positions]));
      setPlayers(
        merged.map((p, i) => ({
          player: p.player,
          battingOrder: i + 1,
          positions: positionsById.get(p.player.id)!,
        }))
      );
    } else {
      setPlayers([
        ...guysShuffled.map((pl, i) => ({ ...pl, battingOrder: i + 1 })),
        ...girlsShuffled.map((pl, i) => ({ ...pl, battingOrder: i + 1 })),
      ]);
    }
  }

  function shufflePositions() {
    const updated = players.map(pl => ({ ...pl, positions: [...pl.positions] }));

    // ── Phase 1: Assign preferred pitchers to consecutive inning blocks ─────────
    //
    // Mirror the PositionAssigner logic: up to 3 preferred pitchers each receive a
    // consecutive 2-inning block (or 3 if only 2 pitchers, or 6 if only 1).
    // Shuffle the candidate list so different shuffles produce different pitcher rotations.

    const preferredPitcherIdxs: number[] = [];
    updated.forEach((pl, idx) => {
      if (pl.player.preferredPositions?.some(group => group.includes(Position.PITCHER))) {
        preferredPitcherIdxs.push(idx);
      }
    });

    const selectedPitchers = shuffleArray(preferredPitcherIdxs).slice(0, 3);

    const pitcherBlocks: number[][] =
      selectedPitchers.length >= 3 ? [[0, 1], [2, 3], [4, 5]] :
      selectedPitchers.length === 2 ? [[0, 1, 2], [3, 4, 5]] :
      selectedPitchers.length === 1 ? [[0, 1, 2, 3, 4, 5]] : [];

    // Track pre-assigned pitcher slots so Phase 2 skips them
    const pitcherSlots = new Set<string>();   // "playerIdx-inning"
    const inningsWithPitcher = new Set<number>();

    for (let p = 0; p < selectedPitchers.length; p++) {
      const playerIdx = selectedPitchers[p];
      for (const inning of pitcherBlocks[p]) {
        if (updated[playerIdx].positions[inning] !== Position.BENCH) {
          updated[playerIdx].positions[inning] = Position.PITCHER;
          pitcherSlots.add(`${playerIdx}-${inning}`);
          inningsWithPitcher.add(inning);
        }
      }
    }

    // ── Phase 2: Assign all remaining positions with cross-inning variety ────────
    //
    // We track how many times each player has been assigned each position so far.
    // When multiple positions are equally valid (preferred / non-anti), we prefer
    // the one the player has played least often — giving a richer rotation
    // across the six innings instead of the same position every time.

    const positionCounts = new Map<number, Map<Position, number>>();

    const getCount = (idx: number, pos: Position) =>
      positionCounts.get(idx)?.get(pos) ?? 0;

    const recordAssignment = (idx: number, pos: Position) => {
      if (!positionCounts.has(idx)) positionCounts.set(idx, new Map());
      const m = positionCounts.get(idx)!;
      m.set(pos, (m.get(pos) ?? 0) + 1);
    };

    // Seed history with pitcher assignments from Phase 1
    for (const slot of pitcherSlots) {
      recordAssignment(Number(slot.split('-')[0]), Position.PITCHER);
    }

    for (let inning = 0; inning < INNINGS.length; inning++) {
      // Players who need a position this inning (not benched, not pre-assigned pitcher)
      const playersThisInning = updated
        .map((pl, idx) => ({ pl, idx }))
        .filter(({ pl, idx }) =>
          pl.positions[inning] !== Position.BENCH &&
          !pitcherSlots.has(`${idx}-${inning}`)
        );

      if (playersThisInning.length === 0) continue;

      // Available positions: all field positions, minus PITCHER if a pitcher is already
      // covering it this inning.
      const available: Position[] = inningsWithPitcher.has(inning)
        ? FIELD_POSITIONS.filter(p => p !== Position.PITCHER)
        : [...FIELD_POSITIONS];

      // Sort players so the most-constrained pick first (same logic as PositionAssigner):
      //   1. Players with anti-positions (most-constrained among them go first)
      //   2. Players with preferred positions available
      //   3. Everyone else
      const shuffled = shuffleArray(playersThisInning);
      shuffled.sort((a, b) => {
        const aAnti = a.pl.player.antiPositions ?? [];
        const bAnti = b.pl.player.antiPositions ?? [];
        const aHasAnti = aAnti.length > 0;
        const bHasAnti = bAnti.length > 0;
        if (aHasAnti && !bHasAnti) return -1;
        if (!aHasAnti && bHasAnti) return 1;
        if (aHasAnti && bHasAnti) {
          const aNonAnti = available.filter(p => !aAnti.includes(p)).length;
          const bNonAnti = available.filter(p => !bAnti.includes(p)).length;
          if (aNonAnti !== bNonAnti) return aNonAnti - bNonAnti;
        }
        const aPrefs = (a.pl.player.preferredPositions ?? []).flat();
        const bPrefs = (b.pl.player.preferredPositions ?? []).flat();
        const aHasPref = aPrefs.some(p => available.includes(p));
        const bHasPref = bPrefs.some(p => available.includes(p));
        if (aHasPref && !bHasPref) return -1;
        if (!aHasPref && bHasPref) return 1;
        return 0;
      });

      for (const { idx, pl } of shuffled) {
        if (available.length === 0) break;

        const anti = pl.player.antiPositions ?? [];
        const preferredGroups = pl.player.preferredPositions ?? [];
        const allPreferred = preferredGroups.flat();

        let position: Position;

        // 1. Try each preferred group in priority order; within a group prefer
        //    positions played fewest times this game (variety).
        let preferredPick: Position | null = null;
        for (const group of preferredGroups) {
          const opts = available.filter(p => group.includes(p));
          if (opts.length > 0) {
            opts.sort((a, b) => getCount(idx, a) - getCount(idx, b));
            preferredPick = opts[0];
            break;
          }
        }

        if (preferredPick !== null) {
          position = preferredPick;
        } else {
          // 2. Non-anti, non-preferred positions; prefer least-played.
          const nonAnti = available.filter(p => !anti.includes(p) && !allPreferred.includes(p));
          if (nonAnti.length > 0) {
            nonAnti.sort((a, b) => getCount(idx, a) - getCount(idx, b));
            position = nonAnti[0];
          } else {
            // 3. Last resort: an anti-position (only when nothing better remains).
            const antiOpts = [...available.filter(p => anti.includes(p))];
            const fallback = antiOpts.length > 0 ? antiOpts : [...available];
            fallback.sort((a, b) => getCount(idx, a) - getCount(idx, b));
            position = fallback[0];
          }
        }

        available.splice(available.indexOf(position), 1);
        updated[idx].positions[inning] = position;
        recordAssignment(idx, position);
      }
    }

    setPlayers(updated);
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <button
          onClick={shuffleOrder}
          className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium"
        >
          Shuffle Order
        </button>
        <button
          onClick={shufflePositions}
          className="text-xs px-3 py-1.5 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium"
        >
          Shuffle Positions
        </button>
      </div>
    <div className="overflow-x-auto">
      <table className="text-sm border-collapse w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-medium text-gray-600 min-w-36">Name</th>
            <th className="text-center px-3 py-2 font-medium text-gray-600 w-10">Bat</th>
            {INNINGS.map(i => (
              <th key={i} className="text-center px-3 py-2 font-medium text-gray-600 w-14">{i}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isUnified ? (
            // Unified mode: single section, female rows tinted pink
            players.map(pl => (
              <PlayerRow
                key={pl.player.id}
                pl={pl}
                rowClass={pl.player.gender === Gender.FEMALE ? 'bg-pink-50' : undefined}
              />
            ))
          ) : (
            // Split mode: two sections with headers
            <>
              <SectionHeader label="Guys" count={guys.length} color="blue" />
              {guys.map(pl => <PlayerRow key={pl.player.id} pl={pl} />)}
              <SectionHeader label="Girls" count={girls.length} color="pink" />
              {girls.map(pl => <PlayerRow key={pl.player.id} pl={pl} />)}
            </>
          )}
        </tbody>
      </table>
    </div>
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

function PlayerRow({ pl, rowClass }: { pl: GameLineup['lineup'][0]; rowClass?: string }) {
  const preferredGroups = pl.player.preferredPositions ?? [];
  const anti = pl.player.antiPositions ?? [];

  return (
    <tr className={`border-t border-gray-100 hover:bg-gray-50 ${rowClass ?? ''}`}>
      <td className="px-3 py-1.5 font-medium">
        {pl.player.firstName} {pl.player.lastName}
      </td>
      <td className="px-3 py-1.5 text-center text-gray-500">{pl.battingOrder}</td>
      {pl.positions.map((pos, i) => {
        const isBench = pos === Position.BENCH;
        const isPreferred = preferredGroups.some(group => group.includes(pos as Position));
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
