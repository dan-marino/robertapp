/**
 * Utility functions for lineup calculations
 */

export interface FieldComposition {
  guysOnField: number;
  girlsOnField: number;
  totalOnField: number;
}

export interface PlayingTimeDistribution {
  baseInnings: number;
  playersWithExtra: number;
  totalSpotInnings: number;
}

/**
 * Calculate how many guys and girls should be on the field per inning
 * Rules:
 * - Minimum 3 girls on field
 * - Maximum 7 guys on field
 * - Total 10 players on field (if possible)
 */
export function calculateFieldComposition(
  totalGuys: number,
  totalGirls: number
): FieldComposition {
  if (totalGirls < 3) {
    throw new Error(`Need at least 3 girls to field a team. Only ${totalGirls} girls RSVP'd.`);
  }

  // Girls take at least 3 spots, guys can take at most 7
  const guysOnField = Math.min(totalGuys, 7);
  const girlsOnField = Math.min(totalGirls, 10 - guysOnField);
  const totalOnField = guysOnField + girlsOnField;

  return { guysOnField, girlsOnField, totalOnField };
}

/**
 * Calculate how many innings each player should play for fair distribution
 * Some players will play baseInnings, others will play baseInnings + 1
 */
export function calculatePlayingTimeDistribution(
  numPlayers: number,
  spotsPerInning: number,
  totalInnings: number
): PlayingTimeDistribution {
  const totalSpotInnings = spotsPerInning * totalInnings;
  const baseInnings = Math.floor(totalSpotInnings / numPlayers);
  const playersWithExtra = totalSpotInnings % numPlayers;

  return {
    baseInnings,
    playersWithExtra,
    totalSpotInnings,
  };
}

/**
 * Determine target innings for each player
 * Players with lower indices get the extra inning (arbitrary but fair)
 */
export function assignTargetInnings(
  numPlayers: number,
  distribution: PlayingTimeDistribution
): number[] {
  return Array.from({ length: numPlayers }, (_, idx) =>
    distribution.baseInnings + (distribution.playersWithExtra > 0 && idx >= numPlayers - distribution.playersWithExtra ? 1 : 0)
  );
}
