import { generateLineup } from '../src/generator';
import {
  createRoster,
  createAllRSVPs,
  getGuysOnField,
  getGirlsOnField,
  assertCoedRules,
} from './setup';

describe('Co-ed League Rules', () => {
  describe('Minimum Girls Requirement', () => {
    test('at least 3 girls on field each inning', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        const girlsOnField = getGirlsOnField(lineup, inning);
        expect(girlsOnField).toBeGreaterThanOrEqual(3);
      }
    });

    test('throws error with fewer than 3 girls', () => {
      const roster = createRoster(10, 2);
      const rsvps = createAllRSVPs(roster);

      expect(() => generateLineup(rsvps, roster)).toThrow('Need at least 3 girls');
    });

    test('throws error with no girls', () => {
      const roster = createRoster(10, 0);
      const rsvps = createAllRSVPs(roster);

      expect(() => generateLineup(rsvps, roster)).toThrow('Need at least 3 girls');
    });

    test('exactly 3 girls works (minimum viable)', () => {
      const roster = createRoster(7, 3);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        const girlsOnField = getGirlsOnField(lineup, inning);
        expect(girlsOnField).toBe(3); // All 3 play every inning
      }
    });
  });

  describe('Maximum Guys Limit', () => {
    test('at most 7 guys on field each inning', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        const guysOnField = getGuysOnField(lineup, inning);
        expect(guysOnField).toBeLessThanOrEqual(7);
      }
    });

    test('exactly 7 guys maximum even with large roster', () => {
      const roster = createRoster(20, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        const guysOnField = getGuysOnField(lineup, inning);
        expect(guysOnField).toBeLessThanOrEqual(7);
      }
    });

    test('fewer than 7 guys when roster is small', () => {
      const roster = createRoster(5, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        const guysOnField = getGuysOnField(lineup, inning);
        expect(guysOnField).toBeLessThanOrEqual(5); // Only 5 guys total
      }
    });
  });

  describe('Gender Balance Scenarios', () => {
    test('handles more girls than minimum (6 girls)', () => {
      const roster = createRoster(10, 6);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        assertCoedRules(lineup, inning);
      }
    });

    test('handles balanced gender ratio (10 guys, 4 girls)', () => {
      const roster = createRoster(10, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        assertCoedRules(lineup, inning);
      }
    });

    test('handles many guys, few girls (14 guys, 4 girls)', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        assertCoedRules(lineup, inning);
      }
    });
  });

  describe('Field Totals', () => {
    test('guys + girls = 10 players on field', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 0; inning < 6; inning++) {
        const guysOnField = getGuysOnField(lineup, inning);
        const girlsOnField = getGirlsOnField(lineup, inning);
        expect(guysOnField + girlsOnField).toBe(10);
      }
    });

    test('field composition stays consistent across all innings', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const firstInningGuys = getGuysOnField(lineup, 0);
      const firstInningGirls = getGirlsOnField(lineup, 0);

      for (let inning = 1; inning < 6; inning++) {
        const guysOnField = getGuysOnField(lineup, inning);
        const girlsOnField = getGirlsOnField(lineup, inning);

        // Should be same composition each inning (7 guys, 3 girls)
        expect(guysOnField).toBe(firstInningGuys);
        expect(girlsOnField).toBe(firstInningGirls);
      }
    });
  });
});
