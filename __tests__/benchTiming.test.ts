import { assignBenchSlots, BenchTimingPlayer } from '../src/utils/benchTiming';
import { Gender } from '../src/types';

function guy(id: string, battingOrder: number, targetInnings: number, isLate = false): BenchTimingPlayer {
  return { id, gender: Gender.MALE, battingOrder, targetInnings, isLate };
}

function girl(id: string, battingOrder: number, targetInnings: number, isLate = false): BenchTimingPlayer {
  return { id, gender: Gender.FEMALE, battingOrder, targetInnings, isLate };
}

describe('assignBenchSlots', () => {
  // ─── Thirds classification ────────────────────────────────────────────────
  // n=6: earlyCount=ceil(6/3)=2, lateCount=2, middle=2
  // battingOrder 1,2 → early; 3,4 → middle; 5,6 → late
  const SIX_GUYS = [1,2,3,4,5,6].map(i => guy(`g${i}`, i, 5));
  const SIX_GIRLS = [1,2,3,4,5,6].map(i => girl(`f${i}`, i, 5));

  describe('thirds classification (R8, R9, R10)', () => {
    test('early-third guys (1-2 of 6) bench in innings 0 or 1', () => {
      const result = assignBenchSlots([...SIX_GUYS, ...SIX_GIRLS]);
      for (const id of ['g1', 'g2']) {
        const bench = result.get(id)!;
        expect(bench).toHaveLength(1);
        expect(bench[0]).toBeLessThanOrEqual(1);
      }
    });

    test('late-third guys (5-6 of 6) bench in innings 4 or 5', () => {
      const result = assignBenchSlots([...SIX_GUYS, ...SIX_GIRLS]);
      for (const id of ['g5', 'g6']) {
        const bench = result.get(id)!;
        expect(bench).toHaveLength(1);
        expect(bench[0]).toBeGreaterThanOrEqual(4);
      }
    });

    test('girls thirds computed independently within gender group', () => {
      const result = assignBenchSlots([...SIX_GUYS, ...SIX_GIRLS]);
      // early-third girls
      for (const id of ['f1', 'f2']) {
        expect(result.get(id)![0]).toBeLessThanOrEqual(1);
      }
      // late-third girls
      for (const id of ['f5', 'f6']) {
        expect(result.get(id)![0]).toBeGreaterThanOrEqual(4);
      }
    });
  });

  // ─── Late arrivals (R10) ──────────────────────────────────────────────────
  describe('late arrivals (R10)', () => {
    test('late arrival benches inning 0 regardless of batting position', () => {
      // g6 is late-third by position but isLate=true → must bench inning 0
      const guys = [1,2,3,4,5].map(i => guy(`g${i}`, i, 5)).concat([guy('g6', 6, 5, true)]);
      const result = assignBenchSlots([...guys, ...SIX_GIRLS]);
      expect(result.get('g6')).toContain(0);
    });

    test('late arrival + pitcher block: R10 wins, still benches inning 0', () => {
      const guys = [1,2,3,4,5].map(i => guy(`g${i}`, i, 5)).concat([guy('g6', 6, 5, true)]);
      // Pitcher block covers innings 0, 1, 2 — but R10 overrides
      const pitcherBlockMap = new Map([['g6', new Set([0, 1, 2])]]);
      const result = assignBenchSlots([...guys, ...SIX_GIRLS], pitcherBlockMap);
      expect(result.get('g6')).toContain(0);
    });
  });

  // ─── R12: above-base innings take precedence over thirds ─────────────────
  describe('R12: above-base innings', () => {
    test('above-base player (benches twice) has at least one bench inning ≤ 1', () => {
      const guys = [
        guy('g1', 1, 4), // benchCount=2 → above-base (minBench=1)
        ...[2,3,4,5,6].map(i => guy(`g${i}`, i, 5)),
      ];
      const result = assignBenchSlots([...guys, ...SIX_GIRLS]);
      const bench = result.get('g1')!;
      expect(bench).toHaveLength(2);
      expect(Math.min(...bench)).toBeLessThanOrEqual(1); // R12: bench early
    });

    test('above-base player in late-third position benches early (R12 overrides R10/R11)', () => {
      const guys = [
        ...[1,2,3,4,5].map(i => guy(`g${i}`, i, 5)),
        guy('g6', 6, 4), // late-third position AND above-base
      ];
      const result = assignBenchSlots([...guys, ...SIX_GIRLS]);
      const bench = result.get('g6')!;
      expect(bench).toHaveLength(2);
      expect(Math.min(...bench)).toBeLessThanOrEqual(1); // R12 wins over late-third preference
    });
  });

  // ─── R12a: multi-bench players ────────────────────────────────────────────
  describe('R12a: multi-bench players', () => {
    test('player benching twice: first bench early, last bench late', () => {
      const guys = [
        guy('g1', 1, 4), // 2 bench slots
        ...[2,3,4,5,6].map(i => guy(`g${i}`, i, 5)),
      ];
      const result = assignBenchSlots([...guys, ...SIX_GIRLS]);
      const bench = result.get('g1')!;
      expect(bench).toHaveLength(2);
      expect(Math.min(...bench)).toBeLessThanOrEqual(1); // first bench early
      expect(Math.max(...bench)).toBeGreaterThanOrEqual(4); // last bench late
    });
  });

  // ─── R17: pitcher block constraint ───────────────────────────────────────
  describe('pitcher block constraint (R17)', () => {
    test('early-third player with pitcher block on innings 0-1 benches in inning 2+', () => {
      const pitcherBlockMap = new Map([['g1', new Set([0, 1])]]);
      const result = assignBenchSlots([...SIX_GUYS, ...SIX_GIRLS], pitcherBlockMap);
      const bench = result.get('g1')!;
      expect(bench).toHaveLength(1);
      expect(bench[0]).toBeGreaterThanOrEqual(2); // blocked innings 0 and 1 are skipped
    });
  });

  // ─── R13: co-ed minimum enforcement ──────────────────────────────────────
  describe('R13: co-ed minimum (never fewer than 3 girls on field)', () => {
    test('R13 satisfied with 4 girls each benching once', () => {
      const guys = Array.from({ length: 10 }, (_, i) => guy(`g${i+1}`, i+1, 5));
      const girls = [1,2,3,4].map(i => girl(`f${i}`, i, 5));
      const result = assignBenchSlots([...guys, ...girls]);

      const girlsBenchedPerInning = Array(6).fill(0);
      for (const g of girls) {
        for (const inning of result.get(g.id)!) {
          girlsBenchedPerInning[inning]++;
        }
      }
      for (let i = 0; i < 6; i++) {
        expect(4 - girlsBenchedPerInning[i]).toBeGreaterThanOrEqual(3);
      }
    });

    test('R13 satisfied with 3 girls having no bench slots (targetInnings=6)', () => {
      // With exactly 3 girls, maxGirlsBenchPerInning=0 — no girl can bench
      const guys = [1,2,3,4,5,6].map(i => guy(`g${i}`, i, 5));
      const girls = [1,2,3].map(i => girl(`f${i}`, i, 6)); // targetInnings=6 → benchCount=0
      const result = assignBenchSlots([...guys, ...girls]);
      // Girls should have empty bench arrays
      for (const g of girls) {
        expect(result.get(g.id)).toHaveLength(0);
      }
    });
  });

  // ─── Degenerate cases ────────────────────────────────────────────────────
  describe('degenerate cases', () => {
    test('2 guys: batting order 1 is early (bench ≤1), batting order 2 is late (bench ≥4)', () => {
      const guys = [guy('g1', 1, 5), guy('g2', 2, 5)];
      const girls = [1,2,3,4].map(i => girl(`f${i}`, i, 5)); // 4 girls for R13
      const result = assignBenchSlots([...guys, ...girls]);
      expect(result.get('g1')![0]).toBeLessThanOrEqual(1);
      expect(result.get('g2')![0]).toBeGreaterThanOrEqual(4);
    });

    test('1 guy: that player gets exactly 1 bench inning', () => {
      const guys = [guy('g1', 1, 5)];
      const girls = [1,2,3,4].map(i => girl(`f${i}`, i, 5));
      const result = assignBenchSlots([...guys, ...girls]);
      expect(result.get('g1')).toHaveLength(1);
    });

    test('gender-asymmetric (1 guy, 5 girls): no errors, all players get entries', () => {
      const guys = [guy('g1', 1, 5)];
      const girls = [1,2,3,4,5].map(i => girl(`f${i}`, i, 5));
      expect(() => assignBenchSlots([...guys, ...girls])).not.toThrow();
      const result = assignBenchSlots([...guys, ...girls]);
      expect(result.size).toBe(6);
    });
  });

  // ─── Integration ─────────────────────────────────────────────────────────
  describe('integration', () => {
    test('every player has a bench assignment with valid inning indices [0-5]', () => {
      const result = assignBenchSlots([...SIX_GUYS, ...SIX_GIRLS]);
      for (const [, bench] of result) {
        expect(bench.length).toBeGreaterThan(0);
        for (const inning of bench) {
          expect(inning).toBeGreaterThanOrEqual(0);
          expect(inning).toBeLessThanOrEqual(5);
        }
      }
    });

    test('no player is assigned the same inning twice', () => {
      const guys = [
        guy('g1', 1, 4), // benches twice
        ...[2,3,4,5,6].map(i => guy(`g${i}`, i, 5)),
      ];
      const result = assignBenchSlots([...guys, ...SIX_GIRLS]);
      for (const [, bench] of result) {
        expect(new Set(bench).size).toBe(bench.length);
      }
    });

    test('split mode: each gender group thirds computed independently', () => {
      // 10 guys + 4 girls — standard roster
      const guys = Array.from({ length: 10 }, (_, i) => guy(`g${i+1}`, i+1, 5));
      const girls = [1,2,3,4].map(i => girl(`f${i}`, i, 5));
      const result = assignBenchSlots([...guys, ...girls]);

      // n=10 guys: earlyCount=4, lateCount=4, middle=2
      // guys 1-4 early → bench ≤ 1
      for (const id of ['g1','g2','g3','g4']) {
        expect(result.get(id)![0]).toBeLessThanOrEqual(1);
      }
      // guys 7-10 late → bench ≥ 4
      for (const id of ['g7','g8','g9','g10']) {
        expect(result.get(id)![0]).toBeGreaterThanOrEqual(4);
      }
    });
  });
});
