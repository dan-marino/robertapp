import { Position, Gender } from '../types';
import { PlayerWithMetadata } from './PlayerSorter';

const FIELD_POSITIONS: Position[] = [
  Position.PITCHER,
  Position.CATCHER,
  Position.FIRST_BASE,
  Position.SECOND_BASE,
  Position.THIRD_BASE,
  Position.SHORTSTOP,
  Position.LEFT_FIELD,
  Position.LEFT_CENTER,
  Position.RIGHT_CENTER,
  Position.RIGHT_FIELD,
];

interface CombinedPlayer extends PlayerWithMetadata {
  globalIdx: number;
  isGuy: boolean;
  localIdx: number; // Index within guys[] or girls[]
}

/**
 * Handles position assignment for ALL players together
 * The 10 field positions are shared between guys and girls
 */
export class PositionAssigner {
  private allPlayers: CombinedPlayer[];
  private guysPerInning: number;
  private girlsPerInning: number;
  private innings: number;
  private numGuys: number;
  private numGirls: number;

  constructor(
    guys: PlayerWithMetadata[],
    girls: PlayerWithMetadata[],
    guysPerInning: number,
    girlsPerInning: number,
    innings: number = 6
  ) {
    this.guysPerInning = guysPerInning;
    this.girlsPerInning = girlsPerInning;
    this.innings = innings;
    this.numGuys = guys.length;
    this.numGirls = girls.length;

    // Combine all players with metadata about which group they belong to
    this.allPlayers = [
      ...guys.map((p, idx) => ({ ...p, globalIdx: idx, isGuy: true, localIdx: idx })),
      ...girls.map((p, idx) => ({ ...p, globalIdx: this.numGuys + idx, isGuy: false, localIdx: idx }))
    ];
  }

  /**
   * Calculate target innings for each player based on spots available.
   *
   * In unified mode all players share a single pool of spots, so every player
   * gets the same base target (totalSpots / totalPlayers). Extra innings go to
   * the last players in the combined array (bottom-of-order), consistent with R1.
   *
   * In split mode guys and girls have separate spot pools (guysPerInning and
   * girlsPerInning), so targets are computed independently per gender.
   */
  private calculateTargets(isUnified: boolean = false): number[] {
    const totalPlayers = this.numGuys + this.numGirls;

    if (isUnified) {
      // Unified: everyone competes for the same 10 spots per inning.
      const totalSpots = (this.guysPerInning + this.girlsPerInning) * this.innings;
      const base = Math.floor(totalSpots / totalPlayers);
      const extra = totalSpots % totalPlayers;

      // Verify uniform targets are feasible: the girls' total target innings must cover
      // the mandatory minimum (girlsPerInning × innings). If girls' collective target
      // falls short of the mandatory minimum, co-ed rules can't be met in the later
      // innings once girls exhaust their target innings — fall back to gender-specific
      // targets in that case (same as split mode, just better than breaking).
      let uniformGirlTotal = 0;
      for (let i = 0; i < this.numGirls; i++) {
        const idx = this.numGuys + i;
        uniformGirlTotal += base + (extra > 0 && idx >= totalPlayers - extra ? 1 : 0);
      }
      const mandatoryGirlInnings = this.girlsPerInning * this.innings;

      if (uniformGirlTotal >= mandatoryGirlInnings) {
        // Uniform targets are achievable — extra innings go to bottom-of-order players.
        return this.allPlayers.map((_, idx) =>
          base + (extra > 0 && idx >= totalPlayers - extra ? 1 : 0)
        );
      }
      // Uniform targets infeasible for this roster — fall through to gender-specific targets.
    }

    const targets: number[] = [];

    // Guys get guysPerInning spots per inning
    const guysTotalSpots = this.guysPerInning * this.innings;
    const guysBase = Math.floor(guysTotalSpots / this.numGuys);
    const guysExtra = guysTotalSpots % this.numGuys;

    for (let i = 0; i < this.numGuys; i++) {
      targets.push(guysBase + (guysExtra > 0 && i >= this.numGuys - guysExtra ? 1 : 0));
    }

    // Girls get girlsPerInning spots per inning
    const girlsTotalSpots = this.girlsPerInning * this.innings;
    const girlsBase = Math.floor(girlsTotalSpots / this.numGirls);
    const girlsExtra = girlsTotalSpots % this.numGirls;

    for (let i = 0; i < this.numGirls; i++) {
      targets.push(girlsBase + (girlsExtra > 0 && i >= this.numGirls - girlsExtra ? 1 : 0));
    }

    return targets;
  }

  /**
   * Pre-assign preferred pitchers to consecutive inning blocks.
   * Returns the filled inning indices and a map of pre-assigned player innings.
   */
  private assignPitchers(
    allPositions: Position[][],
    inningsPlayed: number[],
    lastPlayedInning: number[],
  ): {
    filledInnings: Set<number>;
    preAssignedPlayers: Map<number, Set<number>>;
    pitcherGuyInnings: Set<number>;   // innings where the pre-assigned pitcher is a guy
    pitcherGirlInnings: Set<number>;  // innings where the pre-assigned pitcher is a girl
  } {
    // Find preferred pitchers: guys first, then girls
    const preferredPitchers: CombinedPlayer[] = [];
    for (const player of this.allPlayers.filter(p => p.isGuy)) {
      if (player.player.preferredPositions?.some(group => group.includes(Position.PITCHER))) {
        preferredPitchers.push(player);
      }
    }
    for (const player of this.allPlayers.filter(p => !p.isGuy)) {
      if (player.player.preferredPositions?.some(group => group.includes(Position.PITCHER))) {
        preferredPitchers.push(player);
      }
    }

    // Select up to 3 pitchers
    const selectedPitchers = preferredPitchers.slice(0, 3);

    const filledInnings = new Set<number>();
    const preAssignedPlayers = new Map<number, Set<number>>();
    const pitcherGuyInnings = new Set<number>();
    const pitcherGirlInnings = new Set<number>();

    if (selectedPitchers.length === 0) {
      return { filledInnings, preAssignedPlayers, pitcherGuyInnings, pitcherGirlInnings };
    }

    // Compute inning blocks based on number of pitchers
    const blocks: number[][] = [];
    if (selectedPitchers.length === 3) {
      blocks.push([0, 1], [2, 3], [4, 5]);
    } else if (selectedPitchers.length === 2) {
      blocks.push([0, 1, 2], [3, 4, 5]);
    } else {
      // 1 pitcher
      blocks.push([0, 1, 2, 3, 4, 5]);
    }

    // Pre-populate positions and credit inningsPlayed for the full block upfront.
    // Pre-crediting is essential: without it, pitchers would be selected for general
    // innings before their block runs, accumulating innings beyond their target.
    // The spot count in the main loop is reduced by 1 for each pitcher inning so
    // that the total players assigned (pre-pitcher + general candidates) always
    // equals guysPerInning + girlsPerInning and no player is inadvertently dropped.
    for (let i = 0; i < selectedPitchers.length; i++) {
      const pitcher = selectedPitchers[i];
      const block = blocks[i];
      const inningsForPitcher = new Set<number>();

      for (const inning of block) {
        allPositions[pitcher.globalIdx][inning] = Position.PITCHER;
        inningsPlayed[pitcher.globalIdx]++;
        // Do NOT update lastPlayedInning here — it should only reflect general innings
        // played so that gap-based tiebreaking treats pitchers as "haven't played recently"
        // until they actually appear in the general lineup loop.
        filledInnings.add(inning);
        inningsForPitcher.add(inning);
        if (pitcher.isGuy) {
          pitcherGuyInnings.add(inning);
        } else {
          pitcherGirlInnings.add(inning);
        }
      }

      preAssignedPlayers.set(pitcher.globalIdx, inningsForPitcher);
    }

    return { filledInnings, preAssignedPlayers, pitcherGuyInnings, pitcherGirlInnings };
  }

  /**
   * Main assignment algorithm
   */
  assign(isUnified: boolean = false): { guysPositions: Position[][]; girlsPositions: Position[][] } {
    const targetInnings = this.calculateTargets(isUnified);
    const inningsPlayed: number[] = Array(this.allPlayers.length).fill(0);
    const lastPlayedInning: number[] = Array(this.allPlayers.length).fill(-2);
    const lastPosition: Map<number, Position> = new Map();
    // Track how many times each player has been assigned one of their preferred positions
    const preferredPlaysCount: number[] = Array(this.allPlayers.length).fill(0);

    // Initialize position arrays
    const allPositions: Position[][] = this.allPlayers.map(() =>
      Array(this.innings).fill(Position.BENCH)
    );

    // Pre-assign preferred pitchers to their consecutive inning blocks.
    // assignPitchers() pre-credits inningsPlayed for all pitcher innings upfront so that
    // pitchers are never selected by the general loop for innings outside their block.
    const { filledInnings: pitcherFilledInnings, preAssignedPlayers, pitcherGuyInnings, pitcherGirlInnings } =
      this.assignPitchers(allPositions, inningsPlayed, lastPlayedInning);

    // For each inning, assign the 10 field positions
    for (let inning = 0; inning < this.innings; inning++) {
      // Reduce the requested candidate count by 1 for whichever gender has a pre-assigned
      // pitcher this inning, since that spot is already filled by the pitcher.
      const guysNeeded = this.guysPerInning - (pitcherGuyInnings.has(inning) ? 1 : 0);
      const girlsNeeded = this.girlsPerInning - (pitcherGirlInnings.has(inning) ? 1 : 0);

      let playersThisInning: number[];

      if (isUnified) {
        // Unified mode: select from all players together, enforcing gender constraints.
        // minGirls and maxGuys come from the per-inning composition reduced by any
        // pre-assigned pitchers for this inning.
        playersThisInning = this.selectCandidatesUnified(
          targetInnings,
          inningsPlayed,
          lastPlayedInning,
          inning,
          guysNeeded + girlsNeeded,
          girlsNeeded,
          guysNeeded,
          preAssignedPlayers
        );
      } else {
        // Split mode: select guys and girls independently against their own targets.
        const guysCandidates = this.selectCandidates(
          this.allPlayers.filter(p => p.isGuy),
          targetInnings,
          inningsPlayed,
          lastPlayedInning,
          inning,
          guysNeeded,
          preAssignedPlayers
        );

        const girlsCandidates = this.selectCandidates(
          this.allPlayers.filter(p => !p.isGuy),
          targetInnings,
          inningsPlayed,
          lastPlayedInning,
          inning,
          girlsNeeded,
          preAssignedPlayers
        );

        playersThisInning = [...guysCandidates, ...girlsCandidates];
      }

      // Exclude PITCHER from available positions for innings where it's already pre-assigned
      const availablePositions = pitcherFilledInnings.has(inning)
        ? FIELD_POSITIONS.filter(p => p !== Position.PITCHER)
        : [...FIELD_POSITIONS];

      // Sort candidates so those with unmet preferred positions get first pick
      playersThisInning.sort((aIdx, bIdx) => {
        // Anti-position players pick first — they need to avoid their anti-positions
        // before preferred-seeking players claim all the good spots.
        const aAnti = this.allPlayers[aIdx].player.antiPositions ?? [];
        const bAnti = this.allPlayers[bIdx].player.antiPositions ?? [];
        const aHasAnti = aAnti.length > 0;
        const bHasAnti = bAnti.length > 0;
        if (aHasAnti && !bHasAnti) return -1;
        if (!aHasAnti && bHasAnti) return 1;

        if (aHasAnti && bHasAnti) {
          // Both have anti-positions: most constrained player picks first.
          // Constrained = fewest non-anti options left in the available pool.
          const aNonAnti = availablePositions.filter(p => !aAnti.includes(p)).length;
          const bNonAnti = availablePositions.filter(p => !bAnti.includes(p)).length;
          if (aNonAnti !== bNonAnti) return aNonAnti - bNonAnti;
        }
        // fall through to existing preferred-position logic

        const aPlayer = this.allPlayers[aIdx];
        const bPlayer = this.allPlayers[bIdx];
        const aPreferred = aPlayer.player.preferredPositions ?? [];
        const bPreferred = bPlayer.player.preferredPositions ?? [];
        const aHasPreferred = aPreferred.some(group => group.some(p => availablePositions.includes(p)));
        const bHasPreferred = bPreferred.some(group => group.some(p => availablePositions.includes(p)));

        if (aHasPreferred && !bHasPreferred) return -1;
        if (!aHasPreferred && bHasPreferred) return 1;

        // Both have (or don't have) preferred available — whoever has played preferred less goes first
        return preferredPlaysCount[aIdx] - preferredPlaysCount[bIdx];
      });

      playersThisInning.forEach(playerIdx => {
        if (availablePositions.length === 0) return;

        const player = this.allPlayers[playerIdx];
        const preferredGroups = player.player.preferredPositions ?? [];
        const anti = player.player.antiPositions ?? [];
        const lastPos = lastPosition.get(playerIdx);

        // Find the highest-rank preference group that has available positions
        let preferredAvailable: Position[] = [];
        for (const group of preferredGroups) {
          const available = availablePositions.filter(p => group.includes(p));
          if (available.length > 0) {
            preferredAvailable = available;
            break;
          }
        }

        // All preferred positions (any rank) for filtering non-anti pool
        const allPreferred = preferredGroups.flat();
        const nonAntiAvailable = availablePositions.filter(
          p => !anti.includes(p) && !allPreferred.includes(p)
        );
        const antiOnly = availablePositions.filter(p => anti.includes(p));

        let position: Position;

        if (preferredAvailable.length > 0) {
          // Pick a preferred position, avoiding the last one played if possible
          const choices = preferredAvailable.length > 1 && lastPos
            ? preferredAvailable.filter(p => p !== lastPos)
            : preferredAvailable;
          position = choices.length > 0 ? choices[0] : preferredAvailable[0];
          preferredPlaysCount[playerIdx]++;
        } else if (nonAntiAvailable.length > 0) {
          // Pick a non-anti position, avoiding the last one played if possible
          const choices = nonAntiAvailable.length > 1 && lastPos
            ? nonAntiAvailable.filter(p => p !== lastPos)
            : nonAntiAvailable;
          position = choices.length > 0 ? choices[0] : nonAntiAvailable[0];
        } else {
          // Fallback: assign from remaining positions (may include anti-positions)
          // This only happens if all remaining positions are anti-positions
          const choices = antiOnly.length > 1 && lastPos
            ? antiOnly.filter(p => p !== lastPos)
            : antiOnly;
          position = choices.length > 0 ? choices[0] : availablePositions[0];
        }

        availablePositions.splice(availablePositions.indexOf(position), 1);
        lastPosition.set(playerIdx, position);
        allPositions[playerIdx][inning] = position;
        inningsPlayed[playerIdx]++;
        lastPlayedInning[playerIdx] = inning;
      });
    }

    // Split back into guys and girls arrays
    const guysPositions = allPositions.slice(0, this.numGuys);
    const girlsPositions = allPositions.slice(this.numGuys);

    return { guysPositions, girlsPositions };
  }

  /**
   * Unified-mode candidate selection: select totalSpots players from the full
   * combined pool while enforcing gender constraints (at least minGirls girls,
   * at most maxGuys guys). Players are sorted by the same slack/deficit/gap
   * priority as the split-mode selector.
   *
   * Phase 1 guarantees the minimum girl count by taking the top minGirls female
   * candidates unconditionally. Phase 2 fills the remaining spots from the
   * combined remaining pool in priority order, skipping any guy that would
   * exceed maxGuys.
   */
  private selectCandidatesUnified(
    targetInnings: number[],
    inningsPlayed: number[],
    lastPlayedInning: number[],
    currentInning: number,
    totalSpots: number,
    minGirls: number,
    maxGuys: number,
    preAssignedPlayers: Map<number, Set<number>>
  ): number[] {
    const totalRemainingInnings = this.innings - currentInning;

    const computeSlack = (idx: number): number => {
      const remainingTarget = targetInnings[idx] - inningsPlayed[idx];
      const preAssigned = preAssignedPlayers.get(idx);
      const futureCommitted = preAssigned
        ? [...preAssigned].filter(inn => inn > currentInning).length
        : 0;
      return (totalRemainingInnings - futureCommitted) - remainingTarget;
    };

    const sortByPriority = (a: number, b: number): number => {
      const aSlack = computeSlack(a);
      const bSlack = computeSlack(b);
      if (aSlack !== bSlack) return aSlack - bSlack;
      const aDeficit = targetInnings[a] - inningsPlayed[a];
      const bDeficit = targetInnings[b] - inningsPlayed[b];
      if (aDeficit !== bDeficit) return bDeficit - aDeficit;
      return (currentInning - lastPlayedInning[b]) - (currentInning - lastPlayedInning[a]);
    };

    const guyCandidates: number[] = [];
    const girlCandidates: number[] = [];

    for (const player of this.allPlayers) {
      if (preAssignedPlayers.get(player.globalIdx)?.has(currentInning)) continue;
      if (inningsPlayed[player.globalIdx] >= targetInnings[player.globalIdx]) continue;
      if (currentInning === 0 && player.isLate) continue;
      if (player.isGuy) {
        guyCandidates.push(player.globalIdx);
      } else {
        girlCandidates.push(player.globalIdx);
      }
    }

    guyCandidates.sort(sortByPriority);
    girlCandidates.sort(sortByPriority);

    const selected: number[] = [];
    let guyCount = 0;
    let girlCount = 0;

    // Phase 1: guarantee the minimum number of girls
    const mandatoryGirls = Math.min(minGirls, girlCandidates.length);
    for (let i = 0; i < mandatoryGirls; i++) {
      selected.push(girlCandidates[i]);
      girlCount++;
    }

    // Phase 2: fill remaining spots from the combined remaining pool in priority order
    const remainingPool = [
      ...guyCandidates,
      ...girlCandidates.slice(mandatoryGirls),
    ].sort(sortByPriority);

    for (const idx of remainingPool) {
      if (selected.length >= totalSpots) break;
      const isGuy = this.allPlayers[idx].isGuy;
      if (isGuy && guyCount >= maxGuys) continue;
      selected.push(idx);
      if (isGuy) guyCount++;
      else girlCount++;
    }

    return selected;
  }

  /**
   * Select which players from a group should play this inning
   */
  private selectCandidates(
    players: CombinedPlayer[],
    targetInnings: number[],
    inningsPlayed: number[],
    lastPlayedInning: number[],
    currentInning: number,
    spotsNeeded: number,
    preAssignedPlayers: Map<number, Set<number>> = new Map()
  ): number[] {
    const candidates: number[] = [];

    for (const player of players) {
      // Skip if this player is already pre-assigned for this inning (e.g., pre-assigned pitcher)
      if (preAssignedPlayers.get(player.globalIdx)?.has(currentInning)) continue;

      const target = targetInnings[player.globalIdx];
      const played = inningsPlayed[player.globalIdx];

      // Skip if played enough
      if (played >= target) continue;

      // Late players sit inning 1
      if (currentInning === 0 && player.isLate) continue;

      candidates.push(player.globalIdx);
    }

    // Compute slack per candidate: how many more innings can this player afford to sit?
    // For pitchers with future committed innings, we subtract those from the available
    // innings so the slack reflects only innings available for general selection.
    // slack === 0 means the player MUST play this inning or they can't reach their target.
    const totalRemainingInnings = this.innings - currentInning;
    const slackMap = new Map<number, number>();
    for (const idx of candidates) {
      const remainingTarget = targetInnings[idx] - inningsPlayed[idx];
      const preAssigned = preAssignedPlayers.get(idx);
      const futureCommitted = preAssigned
        ? [...preAssigned].filter(inn => inn > currentInning).length
        : 0;
      const generalRemainingInnings = totalRemainingInnings - futureCommitted;
      slackMap.set(idx, generalRemainingInnings - remainingTarget);
    }

    // Sort by priority
    candidates.sort((a, b) => {
      const aSlack = slackMap.get(a)!;
      const bSlack = slackMap.get(b)!;

      // Primary tier: slack ascending (must-play players first)
      if (aSlack !== bSlack) {
        return aSlack - bSlack;
      }

      const aDeficit = targetInnings[a] - inningsPlayed[a];
      const bDeficit = targetInnings[b] - inningsPlayed[b];

      if (aDeficit !== bDeficit) {
        return bDeficit - aDeficit; // More behind = higher priority
      }

      const aGap = currentInning - lastPlayedInning[a];
      const bGap = currentInning - lastPlayedInning[b];
      return bGap - aGap; // Longer gap = higher priority
    });

    return candidates.slice(0, spotsNeeded);
  }
}
