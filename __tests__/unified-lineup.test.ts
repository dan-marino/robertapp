import { Gender } from '../src/types';
import { PlayerWithMetadata } from '../src/models/PlayerSorter';
import { intersperseBattingOrder } from '../src/utils/intersperse';

// ============================================================================
// Helpers
// ============================================================================

function makeGuys(n: number): PlayerWithMetadata[] {
  return Array.from({ length: n }, (_, i) => ({
    player: { id: `g${i}`, firstName: `Guy${i}`, lastName: 'Test', gender: Gender.MALE },
    isLate: false,
    inningsPlayed: 0,
  }));
}

function makeGirls(n: number): PlayerWithMetadata[] {
  return Array.from({ length: n }, (_, i) => ({
    player: { id: `f${i}`, firstName: `Girl${i}`, lastName: 'Test', gender: Gender.FEMALE },
    isLate: false,
    inningsPlayed: 0,
  }));
}

function genders(result: PlayerWithMetadata[]): string {
  return result.map(p => (p.player.gender === Gender.MALE ? 'G' : 'F')).join('');
}

function maxConsecutiveGuys(result: PlayerWithMetadata[]): number {
  let max = 0;
  let run = 0;
  for (const p of result) {
    if (p.player.gender === Gender.MALE) {
      run++;
      max = Math.max(max, run);
    } else {
      run = 0;
    }
  }
  return max;
}

// ============================================================================
// Happy path
// ============================================================================

describe('intersperseBattingOrder — happy path', () => {
  test('9 guys / 3 girls — exactly 3:1, ends with girl', () => {
    const result = intersperseBattingOrder(makeGuys(9), makeGirls(3));
    expect(genders(result)).toBe('GGGFGGGFGGGF');
    expect(result[0].player.gender).toBe(Gender.MALE);
    expect(result[result.length - 1].player.gender).toBe(Gender.FEMALE);
    expect(maxConsecutiveGuys(result)).toBe(3);
  });

  test('6 guys / 3 girls — 2:1, ends with girl', () => {
    const result = intersperseBattingOrder(makeGuys(6), makeGirls(3));
    expect(genders(result)).toBe('GGFGGFGGF');
    expect(result[0].player.gender).toBe(Gender.MALE);
    expect(result[result.length - 1].player.gender).toBe(Gender.FEMALE);
    expect(maxConsecutiveGuys(result)).toBe(2);
  });

  test('8 guys / 4 girls — 2:1, ends with girl', () => {
    const result = intersperseBattingOrder(makeGuys(8), makeGirls(4));
    expect(result[0].player.gender).toBe(Gender.MALE);
    expect(result[result.length - 1].player.gender).toBe(Gender.FEMALE);
    expect(maxConsecutiveGuys(result)).toBeLessThanOrEqual(3);
    expect(result).toHaveLength(12);
  });

  test('10 guys / 3 girls — cannot end with girl, ends with guys', () => {
    const result = intersperseBattingOrder(makeGuys(10), makeGirls(3));
    expect(result[0].player.gender).toBe(Gender.MALE);
    expect(result[result.length - 1].player.gender).toBe(Gender.MALE);
    expect(maxConsecutiveGuys(result)).toBeLessThanOrEqual(3);
    expect(result).toHaveLength(13);
  });

  test('all players are present in result', () => {
    const guys = makeGuys(9);
    const girls = makeGirls(3);
    const result = intersperseBattingOrder(guys, girls);
    expect(result).toHaveLength(12);
    const guyIds = result.filter(p => p.player.gender === Gender.MALE).map(p => p.player.id);
    const girlIds = result.filter(p => p.player.gender === Gender.FEMALE).map(p => p.player.id);
    expect(guyIds).toEqual(guys.map(g => g.player.id));
    expect(girlIds).toEqual(girls.map(g => g.player.id));
  });
});

// ============================================================================
// Edge cases
// ============================================================================

describe('intersperseBattingOrder — edge cases', () => {
  test('1 guy / 3 girls — guy leads, ends with girl', () => {
    const result = intersperseBattingOrder(makeGuys(1), makeGirls(3));
    expect(result[0].player.gender).toBe(Gender.MALE);
    expect(result[result.length - 1].player.gender).toBe(Gender.FEMALE);
    expect(maxConsecutiveGuys(result)).toBe(1);
    expect(result).toHaveLength(4);
  });

  test('3 guys / 1 girl — ends with girl (3 ≤ 3·1)', () => {
    const result = intersperseBattingOrder(makeGuys(3), makeGirls(1));
    expect(genders(result)).toBe('GGGF');
    expect(result[0].player.gender).toBe(Gender.MALE);
    expect(result[result.length - 1].player.gender).toBe(Gender.FEMALE);
    expect(maxConsecutiveGuys(result)).toBe(3);
  });

  test('4 guys / 1 girl — cannot end with girl (4 > 3·1), girl in middle', () => {
    const result = intersperseBattingOrder(makeGuys(4), makeGirls(1));
    expect(result[0].player.gender).toBe(Gender.MALE);
    expect(result[result.length - 1].player.gender).toBe(Gender.MALE);
    expect(result.some(p => p.player.gender === Gender.FEMALE)).toBe(true);
    expect(result).toHaveLength(5);
  });

  test('0 girls — returns guys unchanged', () => {
    const guys = makeGuys(5);
    const result = intersperseBattingOrder(guys, []);
    expect(result).toHaveLength(5);
    expect(result.every(p => p.player.gender === Gender.MALE)).toBe(true);
  });

  test('0 guys — returns girls unchanged', () => {
    const girls = makeGirls(3);
    const result = intersperseBattingOrder([], girls);
    expect(result).toHaveLength(3);
    expect(result.every(p => p.player.gender === Gender.FEMALE)).toBe(true);
  });

  test('equal guys and girls — ends with girl, alternating roughly', () => {
    const result = intersperseBattingOrder(makeGuys(4), makeGirls(4));
    expect(result[0].player.gender).toBe(Gender.MALE);
    expect(result[result.length - 1].player.gender).toBe(Gender.FEMALE);
    expect(maxConsecutiveGuys(result)).toBeLessThanOrEqual(3);
    expect(result).toHaveLength(8);
  });
});

// ============================================================================
// Rule invariants across all configurations
// ============================================================================

describe('intersperseBattingOrder — rule invariants', () => {
  const configs = [
    { G: 9, R: 3 },
    { G: 6, R: 3 },
    { G: 8, R: 4 },
    { G: 10, R: 3 },
    { G: 12, R: 5 },
    { G: 7, R: 4 },
    { G: 4, R: 4 },
    { G: 1, R: 3 },
    { G: 3, R: 1 },
  ];

  configs.forEach(({ G, R }) => {
    test(`${G} guys / ${R} girls — no girl leadoff, max 3 consecutive guys`, () => {
      const result = intersperseBattingOrder(makeGuys(G), makeGirls(R));
      expect(result).toHaveLength(G + R);
      // Rule 1: no girl leadoff
      expect(result[0].player.gender).toBe(Gender.MALE);
      // Rule 2: no more than 3 consecutive guys
      expect(maxConsecutiveGuys(result)).toBeLessThanOrEqual(3);
    });
  });
});
