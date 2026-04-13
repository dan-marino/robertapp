'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gender, Position } from '@cli/types';
import type { Player } from '@cli/types';

const ALL_POSITIONS = Object.values(Position).filter(p => p !== Position.BENCH);
const SLOT_LABELS = ['1st', '2nd', '3rd'];

interface Props {
  player?: Player;
  onClose: () => void;
}

function initPreferences(prefs?: Position[][]): Position[][] {
  const result: Position[][] = [[], [], []];
  if (prefs) prefs.forEach((group, i) => { if (i < 3) result[i] = [...group]; });
  return result;
}

export default function PlayerForm({ player, onClose }: Props) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(player?.firstName ?? '');
  const [lastName, setLastName] = useState(player?.lastName ?? '');
  const [gender, setGender] = useState<Gender>(player?.gender ?? Gender.MALE);
  const [preferences, setPreferences] = useState<Position[][]>(() => initPreferences(player?.preferredPositions));
  const [anti, setAnti] = useState<Position[]>(player?.antiPositions ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function togglePreference(pos: Position, slotIdx: number) {
    const next = preferences.map(g => [...g]);
    if (next[slotIdx].includes(pos)) {
      next[slotIdx] = next[slotIdx].filter(p => p !== pos);
    } else {
      next[slotIdx] = [...next[slotIdx], pos];
    }
    setPreferences(next);
  }

  function toggleAnti(pos: Position) {
    setAnti(prev => prev.includes(pos) ? prev.filter(p => p !== pos) : [...prev, pos]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Trim trailing empty groups
    let lastNonEmpty = -1;
    preferences.forEach((g, i) => { if (g.length > 0) lastNonEmpty = i; });
    const preferredPositions = lastNonEmpty >= 0 ? preferences.slice(0, lastNonEmpty + 1) : [];

    const payload = { firstName, lastName, gender, preferredPositions, antiPositions: anti };
    const url = player ? `/api/players/${player.id}` : '/api/players';
    const method = player ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        setError(body.error ?? 'Something went wrong');
        return;
      }

      router.refresh();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  // All positions claimed by any preference slot
  const allClaimed = new Set(preferences.flat());

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">{player ? 'Edit Player' : 'Add Player'}</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={e => setFirstName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
          <input
            type="text"
            value={lastName}
            onChange={e => setLastName(e.target.value)}
            required
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
        <div className="flex gap-4">
          {[Gender.MALE, Gender.FEMALE].map(g => (
            <label key={g} className="flex items-center gap-1.5 text-sm cursor-pointer">
              <input
                type="radio"
                name="gender"
                value={g}
                checked={gender === g}
                onChange={() => setGender(g)}
              />
              {g === Gender.MALE ? 'Male' : 'Female'}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Preferred Positions <span className="text-gray-400 font-normal">(ranked — positions in the same slot are equally preferred)</span>
        </label>
        <div className="space-y-2">
          {SLOT_LABELS.map((label, slotIdx) => {
            const selected = preferences[slotIdx];
            return (
              <div key={slotIdx} className="flex items-start gap-2">
                <span className="text-xs font-semibold text-gray-500 w-7 pt-1.5 shrink-0">{label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_POSITIONS.map(pos => {
                    const active = selected.includes(pos);
                    const taken = !active && allClaimed.has(pos);
                    return (
                      <button
                        key={pos}
                        type="button"
                        disabled={taken}
                        onClick={() => togglePreference(pos, slotIdx)}
                        className={`px-2.5 py-1 text-xs rounded border font-medium transition-colors
                          ${active ? 'bg-green-100 border-green-400 text-green-800' : 'bg-white border-gray-300 text-gray-600'}
                          ${taken ? 'opacity-30 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}`}
                      >
                        {pos}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Anti-Positions <span className="text-gray-400 font-normal">(never assigned here)</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_POSITIONS.map(pos => {
            const active = anti.includes(pos);
            return (
              <button
                key={pos}
                type="button"
                onClick={() => toggleAnti(pos)}
                className={`px-2.5 py-1 text-xs rounded border font-medium transition-colors
                  ${active ? 'bg-red-100 border-red-400 text-red-800' : 'bg-white border-gray-300 text-gray-600'}
                  hover:border-gray-400 cursor-pointer`}
              >
                {pos}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-1.5 bg-white text-sm text-gray-700 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
