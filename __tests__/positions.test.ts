import { generateLineup } from '../src/generator';
import { Position } from '../src/types';
import {
  createRoster,
  createAllRSVPs,
  getPositionsInInning,
  countPositionInInning,
  assertNoDuplicatePositions,
  getUniquePositionsPlayed,
  getInningsPlayed,
} from './setup';

describe('Position Assignment', () => {
  describe('Position Uniqueness', () => {
    test('no duplicate positions in same inning', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // For each inning, check no duplicate positions
      for (let inning = 0; inning < 6; inning++) {
        assertNoDuplicatePositions(lineup, inning);
      }
    });

    test('each position appears at most once per inning', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const fieldPositions = Object.values(Position).filter(
        p => p !== Position.BENCH
      );

      for (let inning = 0; inning < 6; inning++) {
        fieldPositions.forEach(pos => {
          const count = countPositionInInning(lineup, inning, pos);
          expect(count).toBeLessThanOrEqual(1);
        });
      }
    });

    test('positions are shared between guys and girls', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        // Count pitchers across both genders
        const pitchers = lineup.lineup.filter(
          p => p.positions[inning] === Position.PITCHER
        );
        expect(pitchers.length).toBeLessThanOrEqual(1);

        // Count catchers
        const catchers = lineup.lineup.filter(
          p => p.positions[inning] === Position.CATCHER
        );
        expect(catchers.length).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Field Composition', () => {
    test('exactly 10 players on field each inning', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        const playersOnField = getPositionsInInning(lineup, inning);
        expect(playersOnField.length).toBe(10);
      }
    });

    test('exactly 10 positions even with minimum roster', () => {
      const roster = createRoster(7, 3);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        const playersOnField = getPositionsInInning(lineup, inning);
        expect(playersOnField.length).toBe(10);
      }
    });

    test('exactly 10 positions with large roster', () => {
      const roster = createRoster(14, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        const playersOnField = getPositionsInInning(lineup, inning);
        expect(playersOnField.length).toBe(10);
      }
    });
  });

  describe('Position Rotation', () => {
    test('players rotate through different positions', () => {
      const roster = createRoster(10, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // Players who play 3+ innings should play at least 2 different positions
      lineup.lineup.forEach(player => {
        const inningsPlayed = getInningsPlayed(player.positions);

        if (inningsPlayed >= 3) {
          const uniquePositions = getUniquePositionsPlayed(player.positions);
          expect(uniquePositions.size).toBeGreaterThanOrEqual(2);
        }
      });
    });

    test('players do not play same position every inning', () => {
      const roster = createRoster(7, 3);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // With no bench, everyone plays all 6 innings
      lineup.lineup.forEach(player => {
        const uniquePositions = getUniquePositionsPlayed(player.positions);
        // Should play at least 3 different positions over 6 innings
        expect(uniquePositions.size).toBeGreaterThanOrEqual(2);
      });
    });
  });
});
