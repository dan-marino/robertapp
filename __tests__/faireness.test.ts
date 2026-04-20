import { generateLineup } from '../src/generator';
import {
  createRoster,
  createAllRSVPs,
  getInningsPlayed,
  assertFairPlayingTime,
  getMaxConsecutiveBench,
} from './setup';

describe('Fair Playing Time', () => {
  describe('Equal Distribution', () => {
    test('everyone plays roughly equal innings (within 1 inning)', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      assertFairPlayingTime(lineup, 1);
    });

    test('guys play equal innings with standard roster', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // 7 spots × 6 innings = 42 / 14 = 3 innings each
      const guysInnings = lineup.lineup
        .slice(0, lineup.guysCount)
        .map(p => getInningsPlayed(p.positions));

      const minGuys = Math.min(...guysInnings);
      const maxGuys = Math.max(...guysInnings);

      expect(minGuys).toBeGreaterThanOrEqual(2);
      expect(maxGuys).toBeLessThanOrEqual(4);
      expect(maxGuys - minGuys).toBeLessThanOrEqual(1);
    });

    test('girls play equal innings with standard roster', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // 3 spots × 6 innings = 18 / 4 = 4.5 innings each (4 or 5)
      const girlsInnings = lineup.lineup
        .slice(lineup.guysCount)
        .map(p => getInningsPlayed(p.positions));

      const minGirls = Math.min(...girlsInnings);
      const maxGirls = Math.max(...girlsInnings);

      expect(minGirls).toBeGreaterThanOrEqual(4);
      expect(maxGirls).toBeLessThanOrEqual(5);
      expect(maxGirls - minGirls).toBeLessThanOrEqual(1);
    });
  });

  describe('Everyone Plays', () => {
    test('no one sits entire game', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      lineup.lineup.forEach(player => {
        const inningsPlayed = getInningsPlayed(player.positions);
        expect(inningsPlayed).toBeGreaterThan(0);
      });
    });

    test('everyone plays at least 1 inning even with max roster', () => {
      const roster = createRoster(14, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      lineup.lineup.forEach(player => {
        const inningsPlayed = getInningsPlayed(player.positions);
        expect(inningsPlayed).toBeGreaterThanOrEqual(1);
      });
    });

    test('everyone plays all innings with minimum roster', () => {
      const roster = createRoster(7, 3);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      lineup.lineup.forEach(player => {
        const inningsPlayed = getInningsPlayed(player.positions);
        expect(inningsPlayed).toBe(6); // No bench needed
      });
    });
  });

  describe('Bench Time Distribution', () => {
    test('bench time is spread out (no more than 3 consecutive bench innings)', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      lineup.lineup.forEach(player => {
        const maxConsecutive = getMaxConsecutiveBench(player.positions);
        expect(maxConsecutive).toBeLessThanOrEqual(3);
      });
    });

    test('players do not sit consecutive innings when possible', () => {
      const roster = createRoster(10, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // With 14 total and 10 spots, bench rotation should be good
      lineup.lineup.forEach(player => {
        const maxConsecutive = getMaxConsecutiveBench(player.positions);
        expect(maxConsecutive).toBeLessThanOrEqual(2);
      });
    });

    test('no consecutive bench innings with small bench', () => {
      const roster = createRoster(8, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // Only 2 people bench per inning, should rotate well
      lineup.lineup.forEach(player => {
        const maxConsecutive = getMaxConsecutiveBench(player.positions);
        expect(maxConsecutive).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Extra Innings Distribution', () => {
    test('no extra innings: all guys have the same target innings', () => {
      // 9 guys, 5 girls: guysPerInning=7, 7*6=42, 42%9=6 → 6 guys get 5, 3 guys get 4
      // Use 14 guys where 42%14=0 — perfect division, no extra
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const guysInnings = lineup.lineup
        .slice(0, lineup.guysCount)
        .map(p => getInningsPlayed(p.positions));

      const first = guysInnings[0];
      const last = guysInnings[guysInnings.length - 1];
      expect(first).toBe(last);
      assertFairPlayingTime(lineup, 1);
    });

    test('extra innings go to last guys in batting order, not first', () => {
      // 10 guys, 5 girls: guysPerInning=7, 7*6=42, 42%10=2
      // So 2 guys get base+1 innings; with the fix they must be the LAST 2 in batting order
      const roster = createRoster(10, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const guysInnings = lineup.lineup
        .slice(0, lineup.guysCount)
        .map(p => getInningsPlayed(p.positions));

      const baseInnings = Math.min(...guysInnings);
      const extraInnings = baseInnings + 1;

      // Collect indices with the extra inning
      const extraIndices = guysInnings
        .map((innings, idx) => ({ innings, idx }))
        .filter(({ innings }) => innings === extraInnings)
        .map(({ idx }) => idx);

      // Collect indices with the base inning
      const baseIndices = guysInnings
        .map((innings, idx) => ({ innings, idx }))
        .filter(({ innings }) => innings === baseInnings)
        .map(({ idx }) => idx);

      if (extraIndices.length > 0 && baseIndices.length > 0) {
        // Every player with extra innings must have a higher index than every player with base innings
        const maxBaseIdx = Math.max(...baseIndices);
        const minExtraIdx = Math.min(...extraIndices);
        expect(minExtraIdx).toBeGreaterThan(maxBaseIdx);
      }
    });

    test('regression: extra innings distribution still satisfies ±1 fairness', () => {
      const roster = createRoster(10, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);
      assertFairPlayingTime(lineup, 1);
    });
  });

  describe('Edge Case Fairness', () => {
    test('fairness with uneven division (14 guys, 42 spot-innings)', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // 42 / 14 = 3 innings each (perfect division)
      const guysInnings = lineup.lineup
        .slice(0, lineup.guysCount)
        .map(p => getInningsPlayed(p.positions));

      guysInnings.forEach(innings => {
        expect(innings).toBe(3);
      });
    });

    test('fairness with uneven division (4 girls, 18 spot-innings)', () => {
      const roster = createRoster(14, 4);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // 18 / 4 = 4.5, so 2 play 4 innings, 2 play 5 innings
      const girlsInnings = lineup.lineup
        .slice(lineup.guysCount)
        .map(p => getInningsPlayed(p.positions));

      const playing4 = girlsInnings.filter(i => i === 4).length;
      const playing5 = girlsInnings.filter(i => i === 5).length;

      expect(playing4 + playing5).toBe(4); // All girls play 4 or 5
      expect(Math.abs(playing4 - playing5)).toBeLessThanOrEqual(2); // Fairly distributed
    });

    test('fairness with many players on bench', () => {
      const roster = createRoster(14, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // 19 players, 10 spots = 9 benched per inning
      assertFairPlayingTime(lineup, 1);
    });
  });
});
