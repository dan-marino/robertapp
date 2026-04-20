import { Player, RSVP, GameLineup, PlayerLineup, LineupMode, Position } from '../types';
import { PlayerSorter, PlayerWithMetadata } from './PlayerSorter';
import { PositionAssigner } from './PositionAssigner';
import { calculateFieldComposition } from '../utils/calculations';
import { intersperseBattingOrder } from '../utils/intersperse';

/**
 * Main class that orchestrates the lineup generation process
 */
export class LineupBuilder {
  private allPlayers: Player[];
  private rsvps: RSVP[];
  private innings: number;
  private lineupMode: LineupMode;

  constructor(allPlayers: Player[], rsvps: RSVP[], innings: number = 6, lineupMode: LineupMode = 'split') {
    this.allPlayers = allPlayers;
    this.rsvps = rsvps;
    this.innings = innings;
    this.lineupMode = lineupMode;
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

    if (this.lineupMode === 'unified') {
      // Determine interleaved batting order using original PlayerWithMetadata arrays
      const merged = intersperseBattingOrder(guys, girls);

      // Build a position lookup by player id
      const guyPositionsById = new Map(guys.map((p, i) => [p.player.id, guysPositions[i]]));
      const girlPositionsById = new Map(girls.map((p, i) => [p.player.id, girlsPositions[i]]));

      const unifiedLineup: PlayerLineup[] = merged.map((p, idx) => ({
        player: p.player,
        battingOrder: idx + 1,
        positions: (guyPositionsById.get(p.player.id) ?? girlPositionsById.get(p.player.id))!,
      }));

      return {
        lineup: unifiedLineup,
        guysCount: guysLineup.length,
        girlsCount: girlsLineup.length,
        lineupMode: 'unified',
      };
    }

    return {
      lineup: [...guysLineup, ...girlsLineup],
      guysCount: guysLineup.length,
      girlsCount: girlsLineup.length,
      lineupMode: 'split',
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
    return assigner.assign(this.lineupMode === 'unified');
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
