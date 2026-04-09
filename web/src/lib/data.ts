import fs from 'fs';
import path from 'path';
import type { Player, RSVP, Season, Game } from '@cli/types';

// process.cwd() is always the web/ directory when running next dev/build/start
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

export function readRsvps(gameId: string): RSVP[] {
  const filePath = dataPath(`rsvps-${gameId}.json`);
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as RSVP[];
}

export function writeRsvps(gameId: string, rsvps: RSVP[]): void {
  fs.writeFileSync(dataPath(`rsvps-${gameId}.json`), JSON.stringify(rsvps, null, 2), 'utf-8');
}
