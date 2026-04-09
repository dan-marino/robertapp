'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gender } from '@cli/types';
import type { Player } from '@cli/types';
import PlayerForm from './PlayerForm';

interface Props {
  players: Player[];
}

export default function PlayerList({ players }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState<Player | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleDelete(id: string) {
    if (!confirm('Remove this player?')) return;
    await fetch(`/api/players/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  if (adding) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-lg">
        <PlayerForm onClose={() => setAdding(false)} />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-lg">
        <PlayerForm player={editing} onClose={() => setEditing(null)} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">Players <span className="text-gray-400 font-normal text-base">({players.length})</span></h1>
        <button
          onClick={() => setAdding(true)}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          + Add Player
        </button>
      </div>

      <div className="space-y-2">
        {players.map(p => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{p.firstName} {p.lastName}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                  p.gender === Gender.MALE
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-pink-50 text-pink-700'
                }`}>
                  {p.gender === Gender.MALE ? 'M' : 'F'}
                </span>
              </div>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {(p.preferredPositions ?? []).map(pos => (
                  <span key={pos} className="text-xs bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded">
                    {pos}
                  </span>
                ))}
                {(p.antiPositions ?? []).map(pos => (
                  <span key={pos} className="text-xs bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded line-through">
                    {pos}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setEditing(p)}
                className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(p.id)}
                className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
