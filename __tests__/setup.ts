import { Player, RSVP, Gender, Position, GameLineup } from '../src/types';

/**
 * Shared test utilities and helpers
 */

// ============================================================================
// Player & RSVP Factories
// ============================================================================

export function createPlayer(
  id: string,
  firstName: string,
  lastName: string,
  gender: Gender,
  preferredPositions?: Position[][],
  antiPositions?: Position[]
): Player {
  return { id, firstName, lastName, gender, preferredPositions, antiPositions };
}

export function createRSVP(playerId: string, isLate: boolean = false): RSVP {
  return { playerId, isLate };
}

export function createRoster(numGuys: number, numGirls: number): Player[] {
  return [
    ...Array.from({ length: numGuys }, (_, i) =>
      createPlayer(`g${i}`, `Guy${i}`, 'Test', Gender.MALE)
    ),
    ...Array.from({ length: numGirls }, (_, i) =>
      createPlayer(`f${i}`, `Girl${i}`, 'Test', Gender.FEMALE)
    ),
  ];
}

export function createAllRSVPs(roster: Player[], allLate: boolean = false): RSVP[] {
  return roster.map(p => createRSVP(p.id, allLate));
}

// ============================================================================
// Lineup Analysis Helpers
// ============================================================================

export function getPositionsInInning(lineup: GameLineup, inning: number): Position[] {
  const positions: Position[] = [];

  lineup.lineup.forEach(player => {
    const pos = player.positions[inning];
    if (pos !== Position.BENCH) {
      positions.push(pos);
    }
  });

  return positions;
}

export function countPositionInInning(
  lineup: GameLineup,
  inning: number,
  position: Position
): number {
  const positions = getPositionsInInning(lineup, inning);
  return positions.filter(p => p === position).length;
}

export function getInningsPlayed(positions: Position[]): number {
  return positions.filter(p => p !== Position.BENCH).length;
}

export function getGuysOnField(lineup: GameLineup, inning: number): number {
  return lineup.lineup
    .slice(0, lineup.guysCount)
    .filter(p => p.positions[inning] !== Position.BENCH).length;
}

export function getGirlsOnField(lineup: GameLineup, inning: number): number {
  return lineup.lineup
    .slice(lineup.guysCount)
    .filter(p => p.positions[inning] !== Position.BENCH).length;
}

export function getMaxConsecutiveBench(positions: Position[]): number {
  let consecutiveBench = 0;
  let maxConsecutiveBench = 0;

  positions.forEach(pos => {
    if (pos === Position.BENCH) {
      consecutiveBench++;
      maxConsecutiveBench = Math.max(maxConsecutiveBench, consecutiveBench);
    } else {
      consecutiveBench = 0;
    }
  });

  return maxConsecutiveBench;
}

export function getUniquePositionsPlayed(positions: Position[]): Set<Position> {
  const fieldPositions = positions.filter(p => p !== Position.BENCH);
  return new Set(fieldPositions);
}

// ============================================================================
// Common Test Scenarios
// ============================================================================

export const TEST_SCENARIOS = {
  standard: {
    guys: 14,
    girls: 4,
    description: 'Standard game (14 guys, 4 girls)',
  },
  minimal: {
    guys: 7,
    girls: 3,
    description: 'Minimum viable team (7 guys, 3 girls)',
  },
  noBench: {
    guys: 7,
    girls: 3,
    description: 'No bench needed (exactly 10 players)',
  },
  maxPlayers: {
    guys: 14,
    girls: 5,
    description: 'Large roster (19 players)',
  },
  manyGirls: {
    guys: 10,
    girls: 6,
    description: 'More girls than minimum (6 girls)',
  },
  balanced: {
    guys: 10,
    girls: 4,
    description: 'Balanced roster (10 guys, 4 girls)',
  },
};

// ============================================================================
// Assertion Helpers
// ============================================================================

export function assertNoDuplicatePositions(lineup: GameLineup, inning: number): void {
  const positions = getPositionsInInning(lineup, inning);
  const uniquePositions = new Set(positions);

  if (positions.length !== uniquePositions.size) {
    const duplicates = positions.filter(
      (pos, idx) => positions.indexOf(pos) !== idx
    );
    throw new Error(
      `Duplicate positions found in inning ${inning + 1}: ${duplicates.join(', ')}`
    );
  }
}

export function assertCoedRules(lineup: GameLineup, inning: number): void {
  const guysOnField = getGuysOnField(lineup, inning);
  const girlsOnField = getGirlsOnField(lineup, inning);

  if (girlsOnField < 3) {
    throw new Error(`Only ${girlsOnField} girls on field in inning ${inning + 1}`);
  }

  if (guysOnField > 7) {
    throw new Error(`${guysOnField} guys on field in inning ${inning + 1} (max 7)`);
  }
}

export function assertFairPlayingTime(
  lineup: GameLineup,
  maxDifference: number = 1
): void {
  // Check guys
  const guysInnings = lineup.lineup
    .slice(0, lineup.guysCount)
    .map(p => getInningsPlayed(p.positions));
  const minGuys = Math.min(...guysInnings);
  const maxGuys = Math.max(...guysInnings);

  if (maxGuys - minGuys > maxDifference) {
    throw new Error(
      `Guys playing time unfair: ${minGuys}-${maxGuys} innings (diff: ${maxGuys - minGuys})`
    );
  }

  // Check girls
  const girlsInnings = lineup.lineup
    .slice(lineup.guysCount)
    .map(p => getInningsPlayed(p.positions));
  const minGirls = Math.min(...girlsInnings);
  const maxGirls = Math.max(...girlsInnings);

  if (maxGirls - minGirls > maxDifference) {
    throw new Error(
      `Girls playing time unfair: ${minGirls}-${maxGirls} innings (diff: ${maxGirls - minGirls})`
    );
  }
}
