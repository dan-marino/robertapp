// Core data types for softball lineup generator

export type LineupMode = 'split' | 'unified';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE'
}

export enum Position {
  PITCHER = 'P',
  CATCHER = 'C',
  FIRST_BASE = '1B',
  SECOND_BASE = '2B',
  THIRD_BASE = '3B',
  SHORTSTOP = 'SS',
  LEFT_FIELD = 'LF',
  LEFT_CENTER = 'LCF',
  RIGHT_CENTER = 'RCF',
  RIGHT_FIELD = 'RF',
  BENCH = '-'
}

// Player in the roster
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  preferredPositions?: Position[][]; // ranked preference groups (up to 3); each group is a set of equally-acceptable positions
  antiPositions?: Position[];      // positions they refuse to play
}

// Season contains roster and games
export interface Season {
  id: string;
  name: string;
  year: number;
  rosterIds: string[]; // Player IDs in this season's roster
}

// Game within a season
export interface Game {
  id: string;
  seasonId: string;
  date: string; // ISO date string
  time?: string; // e.g. "6:30pm"
  location?: string; // e.g. "Queensbridge"
  opponent: string;
  homeScore?: number;
  awayScore?: number;
  lineupMode?: LineupMode; // 'split' (default) | 'unified'
}

// RSVP for a specific game
export interface RSVP {
  playerId: string;
  isLate: boolean; // If true, sits inning 1 and placed in bottom 20% of lineup
}

// The generated lineup for one game - single array, guys first, then girls (split) or interleaved (unified)
export interface GameLineup {
  lineup: PlayerLineup[];
  guysCount: number;
  girlsCount: number;
  lineupMode: LineupMode;
}

// One player's full game assignment
export interface PlayerLineup {
  player: Player;
  battingOrder: number; // 1-indexed position within their gender group
  positions: Position[]; // Index 0 = Inning 1, Index 5 = Inning 6
}

// Input to the generator
export interface LineupGeneratorInput {
  gameId: string;
  rsvps: RSVP[];
  allPlayers: Player[]; // Full roster to lookup from
}
