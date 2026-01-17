import { GameLineup, PlayerLineup } from './types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Formats and writes lineup to CSV file
 */
export class CSVWriter {
  private lineup: GameLineup;

  constructor(lineup: GameLineup) {
    this.lineup = lineup;
  }

  /**
   * Generate CSV content as a string
   */
  generate(): string {
    const lines: string[] = [];

    // Header row
    lines.push(this.buildHeader());

    // Guys lineup
    const guysLineup = this.lineup.lineup.slice(0, this.lineup.guysCount);
    lines.push(...this.buildPlayerRows(guysLineup));

    // Empty row separator
    lines.push('');

    // Girls lineup
    const girlsLineup = this.lineup.lineup.slice(this.lineup.guysCount);
    lines.push(...this.buildPlayerRows(girlsLineup));

    return lines.join('\n');
  }

  /**
   * Build the header row: Name,Inn1,Inn2,Inn3,Inn4,Inn5,Inn6
   */
  private buildHeader(): string {
    const columns = ['Name', 'Inn1', 'Inn2', 'Inn3', 'Inn4', 'Inn5', 'Inn6'];
    return columns.join(',');
  }

  /**
   * Build rows for a group of players
   */
  private buildPlayerRows(players: PlayerLineup[]): string[] {
    return players.map(p => this.buildPlayerRow(p));
  }

  /**
   * Build a single player row
   * Format: "1. John Smith,P,1B,-,SS,-,2B"
   */
  private buildPlayerRow(player: PlayerLineup): string {
    const name = `${player.battingOrder}. ${player.player.firstName} ${player.player.lastName}`;
    const positions = player.positions.join(',');
    return `${name},${positions}`;
  }

  /**
   * Write CSV to file
   */
  writeToFile(filename: string): void {
    const outputDir = path.join(process.cwd(), 'output');
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, filename);
    const content = this.generate();
    
    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`✅ Lineup written to: ${filepath}`);
  }

  /**
   * Print CSV to console (useful for debugging)
   */
  printToConsole(): void {
    console.log('\n📋 Generated Lineup:\n');
    console.log(this.generate());
    console.log('');
  }
}

/**
 * Helper function to quickly write a lineup to CSV
 */
export function writeLineupToCSV(lineup: GameLineup, filename: string): void {
  const writer = new CSVWriter(lineup);
  writer.writeToFile(filename);
}

/**
 * Helper function to print lineup to console
 */
export function printLineup(lineup: GameLineup): void {
  const writer = new CSVWriter(lineup);
  writer.printToConsole();
}
