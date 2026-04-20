import fs from 'fs';
import path from 'path';
import type { Player, RSVP, Season, Game } from '@cli/types';

const DATA_DIR = path.join(process.cwd(), '../src/data');

function dataPath(filename: string): string {
  return path.join(DATA_DIR, filename);
}

export function readRoster(): Player[] {
  const raw = fs.readFileSync(dataPath('roster.json'), 'utf-8');
  return JSON.parse(raw).players as Player[];
}

export function writeRoster(players: Player[]): void {
  fs.writeFileSync(dataPath('roster.json'), JSON.stringify({ players }, null, 2), 'utf-8');
}

export function readSeason(): { season: Season; games: Game[] } {
  const raw = fs.readFileSync(dataPath('season.json'), 'utf-8');
  return JSON.parse(raw) as { season: Season; games: Game[] };
}

export function updateGame(gameId: string, patch: Partial<Game>): void {
  const data = readSeason();
  const idx = data.games.findIndex(g => g.id === gameId);
  if (idx === -1) throw new Error(`Game ${gameId} not found`);
  data.games[idx] = { ...data.games[idx], ...patch };
  fs.writeFileSync(dataPath('season.json'), JSON.stringify(data, null, 2), 'utf-8');
}

export function readRsvps(gameId: string): RSVP[] {
  try {
    const raw = fs.readFileSync(dataPath(`rsvps-${gameId}.json`), 'utf-8');
    return JSON.parse(raw) as RSVP[];
  } catch {
    return [];
  }
}

export function writeRsvps(gameId: string, rsvps: RSVP[]): void {
  fs.writeFileSync(dataPath(`rsvps-${gameId}.json`), JSON.stringify(rsvps, null, 2), 'utf-8');
}
