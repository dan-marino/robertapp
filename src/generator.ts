import { Player, RSVP, GameLineup, LineupMode } from './types';
import { LineupBuilder } from './models/LineupBuilder';

/**
 * Main entry point for lineup generation
 *
 * @param rsvps - List of player RSVPs for the game
 * @param allPlayers - Full roster of players
 * @param lineupMode - 'split' (default) or 'unified'
 * @returns Generated lineup with batting order and position assignments
 */
export function generateLineup(
  rsvps: RSVP[],
  allPlayers: Player[],
  lineupMode: LineupMode = 'split'
): GameLineup {
  const builder = new LineupBuilder(allPlayers, rsvps, 6, lineupMode);
  return builder.generate();
}
