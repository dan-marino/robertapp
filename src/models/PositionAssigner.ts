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
      targets.push(guysBase + (i < guysExtra ? 1 : 0));
    }

    // Girls get girlsPerInning spots per inning
    const girlsTotalSpots = this.girlsPerInning * this.innings;
    const girlsBase = Math.floor(girlsTotalSpots / this.numGirls);
    const girlsExtra = girlsTotalSpots % this.numGirls;

    for (let i = 0; i < this.numGirls; i++) {
      targets.push(girlsBase + (i < girlsExtra ? 1 : 0));
    }

    return targets;
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

    // For each inning, assign the 10 field positions
    for (let inning = 0; inning < this.innings; inning++) {
      // Select guys for this inning
      const guysCandidates = this.selectCandidates(
        this.allPlayers.filter(p => p.isGuy),
        targetInnings,
        inningsPlayed,
        lastPlayedInning,
        inning,
        this.guysPerInning
      );

      // Select girls for this inning
      const girlsCandidates = this.selectCandidates(
        this.allPlayers.filter(p => !p.isGuy),
        targetInnings,
        inningsPlayed,
        lastPlayedInning,
        inning,
        this.girlsPerInning
      );

      // Combine candidates and sort: players who can get a preferred position go first
      // so they have the widest pool to pick from
      const playersThisInning = [...guysCandidates, ...girlsCandidates];
      const availablePositions = [...FIELD_POSITIONS];

      // Sort candidates so those with unmet preferred positions get first pick
      playersThisInning.sort((aIdx, bIdx) => {
        const aPlayer = this.allPlayers[aIdx];
        const bPlayer = this.allPlayers[bIdx];
        const aPreferred = aPlayer.player.preferredPositions ?? [];
        const bPreferred = bPlayer.player.preferredPositions ?? [];
        const aHasPreferred = aPreferred.some(p => availablePositions.includes(p));
        const bHasPreferred = bPreferred.some(p => availablePositions.includes(p));

        if (aHasPreferred && !bHasPreferred) return -1;
        if (!aHasPreferred && bHasPreferred) return 1;

        // Both have (or don't have) preferred available — whoever has played preferred less goes first
        return preferredPlaysCount[aIdx] - preferredPlaysCount[bIdx];
      });

      playersThisInning.forEach(playerIdx => {
        if (availablePositions.length === 0) return;

        const player = this.allPlayers[playerIdx];
        const preferred = player.player.preferredPositions ?? [];
        const anti = player.player.antiPositions ?? [];
        const lastPos = lastPosition.get(playerIdx);

        // Build pools in priority order
        const preferredAvailable = availablePositions.filter(p => preferred.includes(p));
        const nonAntiAvailable = availablePositions.filter(
          p => !anti.includes(p) && !preferred.includes(p)
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
    spotsNeeded: number
  ): number[] {
    const candidates: number[] = [];

    for (const player of players) {
      const target = targetInnings[player.globalIdx];
      const played = inningsPlayed[player.globalIdx];

      // Skip if played enough
      if (played >= target) continue;

      // Late players sit inning 1
      if (currentInning === 0 && player.isLate) continue;

      candidates.push(player.globalIdx);
    }

    // Sort by priority
    candidates.sort((a, b) => {
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
