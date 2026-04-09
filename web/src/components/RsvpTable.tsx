'use client';

import { useState } from 'react';
import { Gender } from '@cli/types';
import type { Player, RSVP } from '@cli/types';

interface Props {
  gameId: string;
  players: Player[];
  initialRsvps: RSVP[];
}

export default function RsvpTable({ gameId, players, initialRsvps }: Props) {
  // Build a map: playerId → { attending, isLate }
  const initialMap = Object.fromEntries(
    players.map(p => {
      const existing = initialRsvps.find(r => r.playerId === p.id);
      return [p.id, { attending: !!existing, isLate: existing?.isLate ?? false }];
    })
  );

  const [state, setState] = useState<Record<string, { attending: boolean; isLate: boolean }>>(initialMap);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(playerId: string, field: 'attending' | 'isLate') {
    setState(prev => {
      const current = prev[playerId];
      if (field === 'attending') {
        return { ...prev, [playerId]: { attending: !current.attending, isLate: !current.attending ? current.isLate : false } };
      }
      return { ...prev, [playerId]: { ...current, isLate: !current.isLate } };
    });
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const rsvps: RSVP[] = players
      .filter(p => state[p.id].attending)
      .map(p => ({ playerId: p.id, isLate: state[p.id].isLate }));

    await fetch(`/api/games/${gameId}/rsvps`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rsvps),
    });

    setSaving(false);
    setSaved(true);
  }

  const guys = players.filter(p => p.gender === Gender.MALE);
  const girls = players.filter(p => p.gender === Gender.FEMALE);
  const attendingCount = Object.values(state).filter(s => s.attending).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{attendingCount} attending</p>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">Saved</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save RSVPs'}
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-2 font-medium text-gray-600">Player</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">Attending</th>
              <th className="text-center px-4 py-2 font-medium text-gray-600">Late</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-blue-50">
              <td colSpan={3} className="px-4 py-1.5 text-xs font-semibold text-blue-700 uppercase tracking-wide">
                Guys ({guys.length})
              </td>
            </tr>
            {guys.map(p => (
              <PlayerRow key={p.id} player={p} state={state[p.id]} onToggle={toggle} />
            ))}
            <tr className="bg-pink-50">
              <td colSpan={3} className="px-4 py-1.5 text-xs font-semibold text-pink-700 uppercase tracking-wide">
                Girls ({girls.length})
              </td>
            </tr>
            {girls.map(p => (
              <PlayerRow key={p.id} player={p} state={state[p.id]} onToggle={toggle} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  state,
  onToggle,
}: {
  player: Player;
  state: { attending: boolean; isLate: boolean };
  onToggle: (id: string, field: 'attending' | 'isLate') => void;
}) {
  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-4 py-2">
        {player.firstName} {player.lastName}
      </td>
      <td className="px-4 py-2 text-center">
        <input
          type="checkbox"
          checked={state.attending}
          onChange={() => onToggle(player.id, 'attending')}
          className="w-4 h-4 cursor-pointer"
        />
      </td>
      <td className="px-4 py-2 text-center">
        <input
          type="checkbox"
          checked={state.isLate}
          disabled={!state.attending}
          onChange={() => onToggle(player.id, 'isLate')}
          className="w-4 h-4 cursor-pointer disabled:opacity-30"
        />
      </td>
    </tr>
  );
}
