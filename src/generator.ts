import { Player, RSVP, GameLineup } from './types';
import { LineupBuilder } from './models/LineupBuilder';

/**
 * Main entry point for lineup generation
 * 
 * @param rsvps - List of player RSVPs for the game
 * @param allPlayers - Full roster of players
 * @returns Generated lineup with batting order and position assignments
 */
export function generateLineup(rsvps: RSVP[], allPlayers: Player[]): GameLineup {
  const builder = new LineupBuilder(allPlayers, rsvps);
  return builder.generate();
}
