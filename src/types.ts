// Core data types for softball lineup generator

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
  preferredPositions?: Position[]; // 1–3 positions they like to play
  antiPositions?: Position[];      // 0–2 positions they refuse to play
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
  opponent: string;
  homeScore?: number;
  awayScore?: number;
}

// RSVP for a specific game
export interface RSVP {
  playerId: string;
  isLate: boolean; // If true, sits inning 1 and placed in bottom 20% of lineup
}

// The generated lineup for one game - single array, guys first, then girls
export interface GameLineup {
  lineup: PlayerLineup[]; // Guys first, then girls (with batting order reset)
  guysCount: number; // Where to split for display
  girlsCount: number;
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
