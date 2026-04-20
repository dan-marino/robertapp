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
   * Calculate target innings for each player based on spots available
   */
  private calculateTargets(): number[] {
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
    targetInnings: number[]
  ): { filledInnings: Set<number>; preAssignedPlayers: Map<number, Set<number>> } {
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

    if (selectedPitchers.length === 0) {
      return { filledInnings, preAssignedPlayers };
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

    // Pre-populate positions and track played innings
    for (let i = 0; i < selectedPitchers.length; i++) {
      const pitcher = selectedPitchers[i];
      const block = blocks[i];
      const inningsForPitcher = new Set<number>();

      for (const inning of block) {
        allPositions[pitcher.globalIdx][inning] = Position.PITCHER;
        inningsPlayed[pitcher.globalIdx]++;
        lastPlayedInning[pitcher.globalIdx] = inning;
        filledInnings.add(inning);
        inningsForPitcher.add(inning);
      }

      preAssignedPlayers.set(pitcher.globalIdx, inningsForPitcher);
    }

    return { filledInnings, preAssignedPlayers };
  }

  /**
   * Main assignment algorithm
   */
  assign(): { guysPositions: Position[][]; girlsPositions: Position[][] } {
    const targetInnings = this.calculateTargets();
    const inningsPlayed: number[] = Array(this.allPlayers.length).fill(0);
    const lastPlayedInning: number[] = Array(this.allPlayers.length).fill(-2);
    const lastPosition: Map<number, Position> = new Map();
    // Track how many times each player has been assigned one of their preferred positions
    const preferredPlaysCount: number[] = Array(this.allPlayers.length).fill(0);

    // Initialize position arrays
    const allPositions: Position[][] = this.allPlayers.map(() =>
      Array(this.innings).fill(Position.BENCH)
    );

    // Pre-assign preferred pitchers to their consecutive inning blocks
    const { filledInnings: pitcherFilledInnings, preAssignedPlayers } = this.assignPitchers(
      allPositions,
      inningsPlayed,
      lastPlayedInning,
      targetInnings
    );

    // For each inning, assign the 10 field positions
    for (let inning = 0; inning < this.innings; inning++) {
      // Select guys for this inning
      const guysCandidates = this.selectCandidates(
        this.allPlayers.filter(p => p.isGuy),
        targetInnings,
        inningsPlayed,
        lastPlayedInning,
        inning,
        this.guysPerInning,
        preAssignedPlayers
      );

      // Select girls for this inning
      const girlsCandidates = this.selectCandidates(
        this.allPlayers.filter(p => !p.isGuy),
        targetInnings,
        inningsPlayed,
        lastPlayedInning,
        inning,
        this.girlsPerInning,
        preAssignedPlayers
      );

      // Combine candidates and sort: players who can get a preferred position go first
      // so they have the widest pool to pick from
      const playersThisInning = [...guysCandidates, ...girlsCandidates];

      // Exclude PITCHER from available positions for innings where it's already pre-assigned
      const availablePositions = pitcherFilledInnings.has(inning)
        ? FIELD_POSITIONS.filter(p => p !== Position.PITCHER)
        : [...FIELD_POSITIONS];

      // Sort candidates so those with unmet preferred positions get first pick
      playersThisInning.sort((aIdx, bIdx) => {
        // Anti-position players pick first — they need to avoid their anti-positions
        // before preferred-seeking players claim all the good spots.
        const aHasAnti = (this.allPlayers[aIdx].player.antiPositions?.length ?? 0) > 0;
        const bHasAnti = (this.allPlayers[bIdx].player.antiPositions?.length ?? 0) > 0;
        if (aHasAnti && !bHasAnti) return -1;
        if (!aHasAnti && bHasAnti) return 1;
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
    // totalRemainingInnings includes the current inning as a play opportunity.
    // slack === 0 means the player MUST play this inning or they can't reach their target.
    const totalRemainingInnings = this.innings - currentInning;
    const slackMap = new Map<number, number>();
    for (const idx of candidates) {
      const remainingTarget = targetInnings[idx] - inningsPlayed[idx];
      slackMap.set(idx, totalRemainingInnings - remainingTarget);
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
