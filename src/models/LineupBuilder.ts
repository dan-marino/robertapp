import { Player, RSVP, GameLineup, PlayerLineup, Position } from '../types';
import { PlayerSorter, PlayerWithMetadata } from './PlayerSorter';
import { PositionAssigner } from './PositionAssigner';
import { calculateFieldComposition } from '../utils/calculations';

/**
 * Main class that orchestrates the lineup generation process
 */
export class LineupBuilder {
  private allPlayers: Player[];
  private rsvps: RSVP[];
  private innings: number;

  constructor(allPlayers: Player[], rsvps: RSVP[], innings: number = 6) {
    this.allPlayers = allPlayers;
    this.rsvps = rsvps;
    this.innings = innings;
  }

  /**
   * Generate the complete game lineup
   */
  generate(): GameLineup {
    // Step 1: Organize players by gender and sort by arrival time
    const { guys, girls } = PlayerSorter.organize(this.rsvps, this.allPlayers);

    // Step 2: Calculate field composition
    const composition = calculateFieldComposition(guys.length, girls.length);

    // Step 3: Assign positions for both genders together (shared 10 field positions)
    const { guysPositions, girlsPositions } = this.assignPositionsForBothGenders(
      guys,
      girls,
      composition.guysOnField,
      composition.girlsOnField
    );

    // Step 4: Build final lineup objects
    const guysLineup = this.buildPlayerLineups(guys, guysPositions);
    const girlsLineup = this.buildPlayerLineups(girls, girlsPositions);

    return {
      lineup: [...guysLineup, ...girlsLineup],
      guysCount: guysLineup.length,
      girlsCount: girlsLineup.length,
    };
  }

  /**
   * Assign positions for both guys and girls together
   */
  private assignPositionsForBothGenders(
    guys: PlayerWithMetadata[],
    girls: PlayerWithMetadata[],
    guysPerInning: number,
    girlsPerInning: number
  ): { guysPositions: Position[][]; girlsPositions: Position[][] } {
    const assigner = new PositionAssigner(guys, girls, guysPerInning, girlsPerInning, this.innings);
    return assigner.assign();
  }

  /**
   * Convert players and position arrays into PlayerLineup objects
   */
  private buildPlayerLineups(
    players: PlayerWithMetadata[],
    positions: Position[][]
  ): PlayerLineup[] {
    return players.map((p, idx) => ({
      player: p.player,
      battingOrder: idx + 1,
      positions: positions[idx],
    }));
  }
}
