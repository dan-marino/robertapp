import { generateLineup } from '../src/generator';
import { Position, Gender, RSVP } from '../src/types';
import {
  createRoster,
  createAllRSVPs,
  createRSVP,
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

  describe('Early Bench Scheduling (slack-based)', () => {
    // Roster: 8 guys, 5 girls.
    // calculateFieldComposition(8, 5) → guysOnField=7, girlsOnField=3
    // guysTotalSpots = 7 * 6 = 42; base = floor(42/8) = 5; extra = 42 % 8 = 2
    // With R1: first 6 guys get target 5, last 2 guys get target 6.
    // slack = totalRemainingInnings - remainingTarget.
    // In inning 0: target-6 guys have slack=0 (must play), target-5 guys have slack=1.
    // Since 7 spots are needed and 8 guys are eligible, exactly 1 target-5 guy sits in inning 0.
    // That guy is the last one in the candidate list (highest-index target-5 player).

    test('at least one target-5 player sits in inning 1 (index 0)', () => {
      // In inning 0, target-6 guys have slack=0 (must play) and fill 2 spots.
      // The 5 remaining spots go to the first 5 target-5 guys; the 6th target-5 guy sits.
      const roster = createRoster(8, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const target5Players = lineup.lineup
        .slice(0, lineup.guysCount)
        .filter(p => getInningsPlayed(p.positions) === 5);

      expect(target5Players.length).toBeGreaterThan(0);

      // At least one target-5 player should have their bench in inning 1 (index 0)
      const anyBenchInInning0 = target5Players.some(p => p.positions[0] === Position.BENCH);
      expect(anyBenchInInning0).toBe(true);
    });

    test('must-play players (slack=0) never sit when there are enough spots', () => {
      // Target-6 guys have slack=0 every inning and must always play.
      // With 8 guys, 5 girls: last 2 guys get target-6.
      const roster = createRoster(8, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const target6Players = lineup.lineup
        .slice(0, lineup.guysCount)
        .filter(p => getInningsPlayed(p.positions) === 6);

      expect(target6Players.length).toBeGreaterThan(0);

      target6Players.forEach(p => {
        const hasBench = p.positions.some(pos => pos === Position.BENCH);
        expect(hasBench).toBe(false);
      });
    });

    test('target-5 players sit before the game is half over (bench not all in last innings)', () => {
      // In a 6-inning game with 8 guys (6 have target-5), bench slots happen throughout.
      // The slack sort ensures that in each inning, the player with the highest slack
      // (most room to sit) gets deprioritized. Over 6 innings, bench slots are spread
      // across all innings rather than piling up at the end.
      const roster = createRoster(8, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const target5Players = lineup.lineup
        .slice(0, lineup.guysCount)
        .filter(p => getInningsPlayed(p.positions) === 5);

      expect(target5Players.length).toBeGreaterThan(0);

      // Verify bench slots are distributed: not all target-5 players sit in the last 2 innings
      const benchInLast2Innings = target5Players.filter(
        p => p.positions[4] === Position.BENCH || p.positions[5] === Position.BENCH
      );
      // At most 2 players should be sitting in the last 2 innings (fair distribution)
      expect(benchInLast2Innings.length).toBeLessThanOrEqual(2);
    });

    test('target-4 players sit in early innings', () => {
      // Roster: 10 guys, 5 girls.
      // guysOnField=7; guysTotalSpots=42; base=4; extra=2
      // With R1: first 8 guys get target-4 (need to sit twice), last 2 get target-5 (sit once).
      // Target-4 guys have higher slack (2) in inning 0 vs target-5 guys (slack=1).
      // So target-4 guys are deprioritized first — they sit earliest.
      const roster = createRoster(10, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const target4Players = lineup.lineup
        .slice(0, lineup.guysCount)
        .filter(p => getInningsPlayed(p.positions) === 4);

      expect(target4Players.length).toBeGreaterThan(0);

      // Each target-4 player needs to sit twice. At least one of their bench innings
      // should be in the first half of the game (innings 1-3, indices 0-2).
      target4Players.forEach(p => {
        const benchInnings = p.positions.reduce<number[]>(
          (acc, pos, idx) => (pos === Position.BENCH ? [...acc, idx] : acc),
          []
        );
        expect(benchInnings.length).toBe(2);
        // At least one bench inning must be in innings 1-3 (indices 0-2)
        const anyBenchInFirstHalf = benchInnings.some(idx => idx <= 2);
        expect(anyBenchInFirstHalf).toBe(true);
      });
    });

    test('regression: assertFairPlayingTime() still passes with slack-based scheduling (8 guys, 5 girls)', () => {
      const roster = createRoster(8, 5);
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);
      assertFairPlayingTime(lineup, 1);
    });

    test('regression: assertFairPlayingTime() still passes with slack-based scheduling (10 guys, 5 girls)', () => {
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

describe('Unified Mode Fairness', () => {
  // Helper: check that ALL players (across genders) play within maxDiff innings of each other
  function assertUnifiedFairness(guysCount: number, girlsCount: number, maxDiff: number = 1): void {
    const roster = createRoster(guysCount, girlsCount);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster, 'unified');

    const allInnings = lineup.lineup.map(p => getInningsPlayed(p.positions));
    const min = Math.min(...allInnings);
    const max = Math.max(...allInnings);

    if (max - min > maxDiff) {
      throw new Error(
        `Unified mode playing time unfair: ${min}-${max} innings ` +
        `(diff: ${max - min}, max allowed: ${maxDiff}). ` +
        `Counts: ${JSON.stringify(
          lineup.lineup.map(p => ({
            name: p.player.firstName,
            gender: p.player.gender === Gender.MALE ? 'M' : 'F',
            innings: getInningsPlayed(p.positions),
          }))
        )}`
      );
    }
  }

  test('10 guys / 5 girls — all players within 1 inning of each other', () => {
    // Total spots = 10*6 = 60; total players = 15; 60/15 = 4 each.
    // In split mode guys would get 4-5 and girls 3-4 (2-inning gap).
    // In unified mode every player should play exactly 4.
    assertUnifiedFairness(10, 5);
  });

  test('9 guys / 5 girls — all players within 1 inning of each other', () => {
    // Total spots = 60; total players = 14; 60/14 = 4 r4 → 10 get 4, 4 get 5.
    assertUnifiedFairness(9, 5);
  });

  test('8 guys / 4 girls — all players within 1 inning of each other', () => {
    // Total spots = 60; total players = 12; 60/12 = 5 each.
    assertUnifiedFairness(8, 4);
  });

  test('7 guys / 3 girls — all players within 1 inning (minimum roster)', () => {
    // Total = 10 players, 10 spots per inning → everyone plays all 6 innings.
    assertUnifiedFairness(7, 3);
  });

  test('co-ed rules still respected in unified mode (min 3 girls, max 7 guys per inning)', () => {
    const roster = createRoster(10, 5);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster, 'unified');

    for (let inning = 0; inning < 6; inning++) {
      const guysOnField = lineup.lineup.filter(
        p => p.player.gender === Gender.MALE && p.positions[inning] !== Position.BENCH
      ).length;
      const girlsOnField = lineup.lineup.filter(
        p => p.player.gender === Gender.FEMALE && p.positions[inning] !== Position.BENCH
      ).length;

      expect(girlsOnField).toBeGreaterThanOrEqual(3);
      expect(guysOnField).toBeLessThanOrEqual(7);
    }
  });
});

describe('Bench Timing (R8-R12)', () => {
  // Roster: 10 guys, 5 girls (split mode).
  // guysPerInning=7 → 3 guys bench per inning.
  // Targets: 8 guys get target-4 (bench 2 innings), 2 guys get target-5 (bench 1 inning).
  // Early-third = ceil(10/3) = 4 guys (batting positions 1-4).
  // Late-third  = 4 guys (batting positions 7-10).
  // Middle      = 2 guys (batting positions 5-6).

  function getBenchInnings(positions: Position[]): number[] {
    return positions.reduce<number[]>((acc, pos, idx) => (pos === Position.BENCH ? [...acc, idx] : acc), []);
  }

  test('early-third guys have at least one bench inning in innings 1-2 (indices 0-1)', () => {
    const roster = createRoster(10, 5);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    const guysLineup = lineup.lineup.slice(0, lineup.guysCount);
    const earlyCount = Math.ceil(guysLineup.length / 3);
    const earlyThird = guysLineup.slice(0, earlyCount);

    earlyThird.forEach(p => {
      const benchInnings = getBenchInnings(p.positions);
      const hasEarlyBench = benchInnings.some(i => i <= 1);
      expect(hasEarlyBench).toBe(true);
    });
  });

  test('late-third guys have at least one bench inning in innings 5-6 (indices 4-5)', () => {
    const roster = createRoster(10, 5);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    const guysLineup = lineup.lineup.slice(0, lineup.guysCount);
    const lateCount = Math.ceil(guysLineup.length / 3);
    const lateThird = guysLineup.slice(guysLineup.length - lateCount);

    lateThird.forEach(p => {
      const benchInnings = getBenchInnings(p.positions);
      const hasLateBench = benchInnings.some(i => i >= 4);
      expect(hasLateBench).toBe(true);
    });
  });

  test('late arrival player benches in inning 1 (index 0)', () => {
    const roster = createRoster(10, 5);
    // Make guy[0] (batting pos 1) arrive late
    const rsvps: RSVP[] = roster.map(p =>
      createRSVP(p.id, p.id === 'g0')
    );
    const lineup = generateLineup(rsvps, roster);

    const latePlayer = lineup.lineup.find(p => p.player.id === 'g0')!;
    expect(latePlayer.isLate).toBe(true);
    expect(latePlayer.positions[0]).toBe(Position.BENCH);
  });

  test('bench timing does not break R14 fairness (max-min ≤ 1)', () => {
    const roster = createRoster(10, 5);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);
    assertFairPlayingTime(lineup, 1);
  });

  test('bench timing does not break R13 co-ed rules', () => {
    const roster = createRoster(10, 5);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    for (let inning = 0; inning < 6; inning++) {
      const girlsOnField = lineup.lineup.filter(
        p => p.player.gender === Gender.FEMALE && p.positions[inning] !== Position.BENCH
      ).length;
      expect(girlsOnField).toBeGreaterThanOrEqual(3);
    }
  });
});
