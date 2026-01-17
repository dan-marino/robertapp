import { Player } from './types';
import { sampleRSVPs, gameId } from './rsvp';
import { generateLineup } from './generator';
import { writeLineupToCSV, printLineup } from './csv-writer';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load roster from JSON file
 */
function loadRoster(): Player[] {
  const rosterPath = path.join(__dirname, 'data', 'roster.json');
  const rosterData = fs.readFileSync(rosterPath, 'utf-8');
  const parsed = JSON.parse(rosterData);
  return parsed.players;
}

/**
 * Main function - generates lineup and outputs to CSV
 */
function main() {
  console.log('🥎 Softball Lineup Generator');
  console.log('================================\n');

  try {
    // Load data
    console.log('📂 Loading roster...');
    const roster = loadRoster();
    console.log(`✅ Loaded ${roster.length} players\n`);

    // Show RSVP summary
    const guysRSVPs = sampleRSVPs.filter(rsvp => {
      const player = roster.find(p => p.id === rsvp.playerId);
      return player?.gender === 'MALE';
    });
    const girlsRSVPs = sampleRSVPs.filter(rsvp => {
      const player = roster.find(p => p.id === rsvp.playerId);
      return player?.gender === 'FEMALE';
    });
    const lateCount = sampleRSVPs.filter(r => r.isLate).length;

    console.log('📊 RSVP Summary:');
    console.log(`   Guys: ${guysRSVPs.length}`);
    console.log(`   Girls: ${girlsRSVPs.length}`);
    console.log(`   Late arrivals: ${lateCount}`);
    console.log(`   Total: ${sampleRSVPs.length}\n`);

    // Generate lineup
    console.log('⚙️  Generating lineup...');
    const lineup = generateLineup(sampleRSVPs, roster);
    console.log('✅ Lineup generated!\n');

    // Output to console
    printLineup(lineup);

    // Write to CSV file
    const filename = `game-${gameId}-lineup.csv`;
    writeLineupToCSV(lineup, filename);

    console.log('🎉 Done! Copy the CSV to Google Sheets.\n');

  } catch (error) {
    console.error('❌ Error generating lineup:', error);
    process.exit(1);
  }
}

// Run the CLI
main();
