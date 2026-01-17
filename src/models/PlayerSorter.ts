import { Player, RSVP, Gender } from '../types';

export interface PlayerWithMetadata {
  player: Player;
  isLate: boolean;
  inningsPlayed: number;
}

/**
 * Handles sorting and organizing players for lineup generation
 */
export class PlayerSorter {
  /**
   * Convert RSVPs into enriched player objects
   */
  static enrichPlayers(rsvps: RSVP[], allPlayers: Player[]): PlayerWithMetadata[] {
    const playersMap = new Map(allPlayers.map(p => [p.id, p]));
    
    return rsvps.map(rsvp => {
      const player = playersMap.get(rsvp.playerId);
      if (!player) {
        throw new Error(`Player ${rsvp.playerId} not found in roster`);
      }
      
      return {
        player,
        isLate: rsvp.isLate,
        inningsPlayed: 0,
      };
    });
  }

  /**
   * Split players by gender
   */
  static splitByGender(players: PlayerWithMetadata[]): {
    guys: PlayerWithMetadata[];
    girls: PlayerWithMetadata[];
  } {
    const guys = players.filter(p => p.player.gender === Gender.MALE);
    const girls = players.filter(p => p.player.gender === Gender.FEMALE);
    
    return { guys, girls };
  }

  /**
   * Sort players for batting order: on-time first, late last
   * This ensures late arrivals are in the bottom 20% of the lineup
   */
  static sortByArrivalTime(players: PlayerWithMetadata[]): PlayerWithMetadata[] {
    return [...players].sort((a, b) => {
      if (a.isLate && !b.isLate) return 1;
      if (!a.isLate && b.isLate) return -1;
      return 0;
    });
  }

  /**
   * Main orchestration: enrich, split, and sort players
   */
  static organize(rsvps: RSVP[], allPlayers: Player[]): {
    guys: PlayerWithMetadata[];
    girls: PlayerWithMetadata[];
  } {
    const enrichedPlayers = this.enrichPlayers(rsvps, allPlayers);
    const { guys, girls } = this.splitByGender(enrichedPlayers);
    
    return {
      guys: this.sortByArrivalTime(guys),
      girls: this.sortByArrivalTime(girls),
    };
  }
}
