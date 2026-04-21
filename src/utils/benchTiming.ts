import { Gender } from '../types';

export interface BenchTimingPlayer {
  id: string;
  gender: Gender;
  battingOrder: number;  // 1-indexed within their gender group
  targetInnings: number; // how many field innings this player is scheduled to play
  isLate: boolean;       // true if player arrived late (always benches inning 0 per R10)
}

/**
 * Classify a player into batting-order thirds (R8).
 *
 * @param positionIndex - 0-based index within the gender-group sorted by battingOrder
 * @param groupSize     - total players in this gender group
 * Degenerate cases: n=1 → 'early' only; n=2 → 'early'/'late'; n=3 → one each.
 * General: earlyCount = ceil(n/3), lateCount = ceil(n/3), middle fills the gap.
 */
function classifyThird(positionIndex: number, groupSize: number): 'early' | 'middle' | 'late' {
  if (groupSize === 1) return 'early';
  if (groupSize === 2) return positionIndex === 0 ? 'early' : 'late';
  if (groupSize === 3) {
    if (positionIndex === 0) return 'early';
    if (positionIndex === 2) return 'late';
    return 'middle';
  }
  const earlyCount = Math.ceil(groupSize / 3);
  const lateCount = Math.ceil(groupSize / 3);
  if (positionIndex < earlyCount) return 'early';
  if (positionIndex >= groupSize - lateCount) return 'late';
  return 'middle';
}

/**
 * Assign bench innings for every player in the game.
 *
 * Pure function: takes player metadata and optional pitcher-block constraints,
 * returns a map of playerId → bench inning indices (0-based, length = innings − targetInnings).
 *
 * Rules enforced (in priority order):
 *   R10 late arrivals → always bench inning 0.
 *   R12 above-base players → prefer inning 0 for their first bench slot.
 *   R10 late-third → prefer inning 5 (then 4).
 *   R9  early-third → prefer innings 0–1.
 *   R11 middle-third → fill remaining slots.
 *   R12a multi-bench → first slot follows thirds/R12; last slot pushed as late as possible.
 *   R17 pitcher block → bench slot never placed in a pitcher-block inning.
 *   R13 co-ed minimum → a girl's bench slot is skipped if it would leave < 3 girls on field.
 *
 * Hard constraints (R13) are never relaxed.
 * Soft preferences (thirds) are relaxed in order: middle → late → early when R13 conflicts.
 */
export function assignBenchSlots(
  players: BenchTimingPlayer[],
  pitcherBlockMap: Map<string, Set<number>> = new Map(),
  innings: number = 6
): Map<string, number[]> {
  // ── Setup ─────────────────────────────────────────────────────────────────

  const guys = players
    .filter(p => p.gender === Gender.MALE)
    .sort((a, b) => a.battingOrder - b.battingOrder);
  const girls = players
    .filter(p => p.gender === Gender.FEMALE)
    .sort((a, b) => a.battingOrder - b.battingOrder);

  const numGirls = girls.length;
  // R13: at most (numGirls − 3) girls can bench in any single inning.
  const maxGirlsBenchPerInning = Math.max(0, numGirls - 3);

  // Bench count per player (innings − targetInnings).
  const benchCountMap = new Map<string, number>(
    players.map(p => [p.id, Math.max(0, innings - p.targetInnings)])
  );

  // ── Per-player classification ─────────────────────────────────────────────

  type PlayerClass = {
    third: 'early' | 'middle' | 'late';
    aboveBase: boolean;
    benchCount: number;
  };
  const classMap = new Map<string, PlayerClass>();

  // Minimum bench count across ALL players — used for R12 above-base detection.
  const minBench = Math.min(...[...benchCountMap.values()]);

  for (const group of [guys, girls]) {
    for (let i = 0; i < group.length; i++) {
      const p = group[i];
      const benchCount = benchCountMap.get(p.id)!;
      classMap.set(p.id, {
        third: classifyThird(i, group.length),
        aboveBase: benchCount > minBench,
        benchCount,
      });
    }
  }

  // ── Priority ordering ─────────────────────────────────────────────────────
  // Lower number = higher priority (assigned bench slots first).

  function priority(p: BenchTimingPlayer): number {
    if (p.isLate) return 0;
    const cls = classMap.get(p.id)!;
    if (cls.aboveBase) return 1;
    if (cls.third === 'late') return 2;
    if (cls.third === 'early') return 3;
    return 4; // middle
  }

  // ── Preferred inning order per bench slot ─────────────────────────────────

  function getPreferredOrder(p: BenchTimingPlayer, slotIndex: number): number[] {
    // R10: late arrivals always bench inning 0 (ignore pitcher block for R10).
    if (p.isLate) return [0];

    const cls = classMap.get(p.id)!;
    const blocked = pitcherBlockMap.get(p.id) ?? new Set<number>();
    const allInnings = Array.from({ length: innings }, (_, i) => i);
    const available = allInnings.filter(i => !blocked.has(i));

    // R12a: the last bench slot is pushed as late as possible.
    if (cls.benchCount > 1 && slotIndex === cls.benchCount - 1) {
      return [...available].reverse();
    }

    // R12: above-base players prefer early innings for their first bench slot.
    if (cls.aboveBase && slotIndex === 0) {
      return available; // already ascending (early first)
    }

    // R9 / R10 / R11: thirds-based preference.
    switch (cls.third) {
      case 'early':
        // Prefer innings 0–1, then ascending.
        return available.slice().sort((a, b) => {
          const aScore = a <= 1 ? a : a + 10;
          const bScore = b <= 1 ? b : b + 10;
          return aScore - bScore;
        });
      case 'late':
        // Prefer innings 4–5, then descending.
        return [...available].reverse();
      default:
        return available;
    }
  }

  // ── Assignment loop ───────────────────────────────────────────────────────

  const girlsBenchedPerInning = Array(innings).fill(0);
  const assignedPerPlayer = new Map<string, Set<number>>(
    players.map(p => [p.id, new Set<number>()])
  );
  const result = new Map<string, number[]>(players.map(p => [p.id, []]));

  // Sort by priority; within equal priority, alternate gender (guys then girls per pair)
  // for natural gender-group tiebreaking.
  const sortedPlayers = [...players].sort((a, b) => priority(a) - priority(b));

  const maxSlots = Math.max(0, ...players.map(p => benchCountMap.get(p.id) ?? 0));

  // Process one bench slot at a time for all players, then the next slot.
  // This ensures slot-0 preferences for high-priority players are satisfied before
  // lower-priority players claim those innings, and before R12a (last-slot late push)
  // competes for late innings.
  for (let slot = 0; slot < maxSlots; slot++) {
    for (const player of sortedPlayers) {
      const benchCount = benchCountMap.get(player.id) ?? 0;
      if (slot >= benchCount) continue;

      const alreadyAssigned = assignedPerPlayer.get(player.id)!;
      const preferred = getPreferredOrder(player, slot).filter(i => !alreadyAssigned.has(i));
      const isGirl = player.gender === Gender.FEMALE;

      let found = false;
      for (const inning of preferred) {
        // R13: skip this inning for a girl if it would leave fewer than 3 girls on field.
        if (isGirl && girlsBenchedPerInning[inning] >= maxGirlsBenchPerInning) continue;

        result.get(player.id)!.push(inning);
        alreadyAssigned.add(inning);
        if (isGirl) girlsBenchedPerInning[inning]++;
        found = true;
        break;
      }

      // Fallback: soft preferences exhausted — pick any valid inning.
      // (Occurs when preferred innings are all blocked by R13 or pitcher constraints.)
      if (!found) {
        for (let i = 0; i < innings; i++) {
          if (alreadyAssigned.has(i)) continue;
          if (isGirl && girlsBenchedPerInning[i] >= maxGirlsBenchPerInning) continue;
          result.get(player.id)!.push(i);
          alreadyAssigned.add(i);
          if (isGirl) girlsBenchedPerInning[i]++;
          break;
        }
        // If no valid inning exists (e.g., numGirls ≤ 3 and girls need bench),
        // the slot remains unassigned — this indicates an invalid input roster
        // where R13 cannot be satisfied. The function still returns a best-effort result.
      }
    }
  }

  return result;
}
