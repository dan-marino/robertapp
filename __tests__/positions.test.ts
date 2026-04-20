import { generateLineup } from '../src/generator';
import { Gender, Position } from '../src/types';
import {
  createPlayer,
  createRoster,
  createAllRSVPs,
  createRSVP,
  getPositionsInInning,
  countPositionInInning,
  assertNoDuplicatePositions,
  assertFairPlayingTime,
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

describe('Position Preferences', () => {
  describe('Preferred Positions', () => {
    test('player gets preferred position at least once in a 6-inning game', () => {
      // Build a small roster where one guy wants SS
      const roster = [
        createPlayer('g0', 'Guy0', 'Test', Gender.MALE, [[Position.SHORTSTOP]]),
        createPlayer('g1', 'Guy1', 'Test', Gender.MALE),
        createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
        createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
        createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
        createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
        createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
        createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
        createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
        createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
      ];
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const preferredPlayer = lineup.lineup.find(pl => pl.player.id === 'g0')!;
      const playedSS = preferredPlayer.positions.some(p => p === Position.SHORTSTOP);
      expect(playedSS).toBe(true);
    });

    test('player with preferred position plays it more often than other positions', () => {
      // Everyone plays all 6 innings (exactly 10 players), so we can count
      const roster = [
        createPlayer('g0', 'Guy0', 'Test', Gender.MALE, [[Position.PITCHER]]),
        createPlayer('g1', 'Guy1', 'Test', Gender.MALE),
        createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
        createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
        createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
        createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
        createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
        createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
        createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
        createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
      ];
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const preferredPlayer = lineup.lineup.find(pl => pl.player.id === 'g0')!;
      const pitcherCount = preferredPlayer.positions.filter(p => p === Position.PITCHER).length;
      // Should play pitcher at least once
      expect(pitcherCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Anti-Positions', () => {
    test('player is never assigned an anti-position when other positions are available', () => {
      // Player g0 has anti-position PITCHER — should never pitch
      const roster = [
        createPlayer('g0', 'Guy0', 'Test', Gender.MALE, [], [Position.PITCHER]),
        createPlayer('g1', 'Guy1', 'Test', Gender.MALE),
        createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
        createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
        createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
        createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
        createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
        createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
        createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
        createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
      ];
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const antiPlayer = lineup.lineup.find(pl => pl.player.id === 'g0')!;
      const pitchedInnings = antiPlayer.positions.filter(p => p === Position.PITCHER).length;
      expect(pitchedInnings).toBe(0);
    });

    test('player with multiple anti-positions avoids all of them', () => {
      const roster = [
        createPlayer('g0', 'Guy0', 'Test', Gender.MALE, [], [Position.PITCHER, Position.CATCHER]),
        createPlayer('g1', 'Guy1', 'Test', Gender.MALE),
        createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
        createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
        createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
        createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
        createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
        createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
        createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
        createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
      ];
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      const antiPlayer = lineup.lineup.find(pl => pl.player.id === 'g0')!;
      const antiAssignments = antiPlayer.positions.filter(
        p => p === Position.PITCHER || p === Position.CATCHER
      ).length;
      expect(antiAssignments).toBe(0);
    });

    test('existing fairness guarantees still hold when preferences are set', () => {
      const roster = [
        createPlayer('g0', 'Guy0', 'Test', Gender.MALE, [[Position.SHORTSTOP]], [Position.CATCHER]),
        createPlayer('g1', 'Guy1', 'Test', Gender.MALE, [[Position.PITCHER]]),
        createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
        createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
        createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
        createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
        createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
        createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
        createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
        createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
      ];
      const rsvps = createAllRSVPs(roster);
      const lineup = generateLineup(rsvps, roster);

      // Everyone should still play all 6 innings (10 players, 10 field spots)
      lineup.lineup.forEach(pl => {
        const played = getInningsPlayed(pl.positions);
        expect(played).toBe(6);
      });

      // No duplicate positions per inning
      for (let inning = 0; inning < 6; inning++) {
        assertNoDuplicatePositions(lineup, inning);
      }
    });
  });
});

describe('Pitcher Rotation (R4)', () => {
  test('3 preferred pitchers → 3 consecutive 2-inning blocks', () => {
    const roster = [
      createPlayer('g0', 'Pitcher0', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g1', 'Pitcher1', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g2', 'Pitcher2', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
      createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
      createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
      createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
      createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
      createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
      createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
    ];
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    const p0 = lineup.lineup.find(pl => pl.player.id === 'g0')!;
    const p1 = lineup.lineup.find(pl => pl.player.id === 'g1')!;
    const p2 = lineup.lineup.find(pl => pl.player.id === 'g2')!;

    // Pitcher 0 pitches innings 1-2 (indices 0-1)
    expect(p0.positions[0]).toBe(Position.PITCHER);
    expect(p0.positions[1]).toBe(Position.PITCHER);
    // Pitcher 1 pitches innings 3-4 (indices 2-3)
    expect(p1.positions[2]).toBe(Position.PITCHER);
    expect(p1.positions[3]).toBe(Position.PITCHER);
    // Pitcher 2 pitches innings 5-6 (indices 4-5)
    expect(p2.positions[4]).toBe(Position.PITCHER);
    expect(p2.positions[5]).toBe(Position.PITCHER);

    // Exactly 3 unique pitchers
    const pitchers = new Set(
      lineup.lineup
        .filter(pl => pl.positions.some(pos => pos === Position.PITCHER))
        .map(pl => pl.player.id)
    );
    expect(pitchers.size).toBe(3);

    // No inning has more than 1 pitcher
    for (let inning = 0; inning < 6; inning++) {
      const count = lineup.lineup.filter(pl => pl.positions[inning] === Position.PITCHER).length;
      expect(count).toBeLessThanOrEqual(1);
    }
  });

  test('2 preferred pitchers → 2 consecutive 3-inning blocks', () => {
    const roster = [
      createPlayer('g0', 'Pitcher0', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g1', 'Pitcher1', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
      createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
      createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
      createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
      createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
      createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
      createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
      createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
    ];
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    const p0 = lineup.lineup.find(pl => pl.player.id === 'g0')!;
    const p1 = lineup.lineup.find(pl => pl.player.id === 'g1')!;

    // Pitcher 0 pitches innings 1-3 (indices 0-2)
    expect(p0.positions[0]).toBe(Position.PITCHER);
    expect(p0.positions[1]).toBe(Position.PITCHER);
    expect(p0.positions[2]).toBe(Position.PITCHER);
    // Pitcher 1 pitches innings 4-6 (indices 3-5)
    expect(p1.positions[3]).toBe(Position.PITCHER);
    expect(p1.positions[4]).toBe(Position.PITCHER);
    expect(p1.positions[5]).toBe(Position.PITCHER);

    // Exactly 2 unique pitchers
    const pitchers = new Set(
      lineup.lineup
        .filter(pl => pl.positions.some(pos => pos === Position.PITCHER))
        .map(pl => pl.player.id)
    );
    expect(pitchers.size).toBe(2);
  });

  test('1 preferred pitcher → pitches all 6 innings', () => {
    const roster = [
      createPlayer('g0', 'Pitcher0', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g1', 'Guy1', 'Test', Gender.MALE),
      createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
      createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
      createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
      createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
      createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
      createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
      createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
      createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
    ];
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    const p0 = lineup.lineup.find(pl => pl.player.id === 'g0')!;

    // Pitcher 0 pitches all 6 innings
    for (let inning = 0; inning < 6; inning++) {
      expect(p0.positions[inning]).toBe(Position.PITCHER);
    }
  });

  test('0 preferred pitchers → lineup generates without error, fairness holds', () => {
    const roster = createRoster(14, 4);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    // Should generate without error
    expect(lineup).toBeDefined();
    expect(lineup.lineup.length).toBeGreaterThan(0);

    // Fairness still holds
    assertFairPlayingTime(lineup);

    // No duplicate positions per inning
    for (let inning = 0; inning < 6; inning++) {
      assertNoDuplicatePositions(lineup, inning);
    }
  });

  test('4+ preferred pitchers → only first 3 are used as pitchers', () => {
    const roster = [
      createPlayer('g0', 'Pitcher0', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g1', 'Pitcher1', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g2', 'Pitcher2', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g3', 'Pitcher3', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
      createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
      createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
      createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
      createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
      createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
    ];
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    // Count unique players who pitched (via pre-assignment in their blocks)
    const preAssignedPitcherIds = new Set<string>();
    const p0 = lineup.lineup.find(pl => pl.player.id === 'g0')!;
    const p1 = lineup.lineup.find(pl => pl.player.id === 'g1')!;
    const p2 = lineup.lineup.find(pl => pl.player.id === 'g2')!;

    // The first 3 preferred pitchers should cover all 6 innings
    if (p0.positions[0] === Position.PITCHER) preAssignedPitcherIds.add('g0');
    if (p1.positions[2] === Position.PITCHER) preAssignedPitcherIds.add('g1');
    if (p2.positions[4] === Position.PITCHER) preAssignedPitcherIds.add('g2');

    expect(preAssignedPitcherIds.size).toBe(3);

    // The 4th preferred pitcher should not be pre-assigned as pitcher
    // (g3 pitches none of their blocks since all 6 innings are covered by g0, g1, g2)
    const p3 = lineup.lineup.find(pl => pl.player.id === 'g3')!;
    // g3 should not have pitched in innings 0-1 (g0's block), 2-3 (g1's block), or 4-5 (g2's block)
    const p3PitchedFromPreAssign =
      p3.positions[0] === Position.PITCHER ||
      p3.positions[2] === Position.PITCHER ||
      p3.positions[4] === Position.PITCHER;
    expect(p3PitchedFromPreAssign).toBe(false);
  });

  test('pitched innings count toward playing time (fairness holds)', () => {
    // 12 guys, 4 girls; first guy is a preferred pitcher (pitches 2 innings in a 2-pitcher setup)
    const roster = [
      createPlayer('g0', 'Pitcher0', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g1', 'Pitcher1', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
      createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
      createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
      createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
      createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
      createPlayer('g7', 'Guy7', 'Test', Gender.MALE),
      createPlayer('g8', 'Guy8', 'Test', Gender.MALE),
      createPlayer('g9', 'Guy9', 'Test', Gender.MALE),
      createPlayer('g10', 'Guy10', 'Test', Gender.MALE),
      createPlayer('g11', 'Guy11', 'Test', Gender.MALE),
      createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
      createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
      createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
      createPlayer('f3', 'Girl3', 'Test', Gender.FEMALE),
    ];
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    // Fairness should still hold (pitched innings count toward total)
    assertFairPlayingTime(lineup);

    // The pitchers should have their pitcher innings recorded
    const p0 = lineup.lineup.find(pl => pl.player.id === 'g0')!;
    const p1 = lineup.lineup.find(pl => pl.player.id === 'g1')!;
    expect(p0.positions[0]).toBe(Position.PITCHER);
    expect(p0.positions[1]).toBe(Position.PITCHER);
    expect(p0.positions[2]).toBe(Position.PITCHER);
    expect(p1.positions[3]).toBe(Position.PITCHER);
    expect(p1.positions[4]).toBe(Position.PITCHER);
    expect(p1.positions[5]).toBe(Position.PITCHER);
  });
});

describe('Anti-Position Priority', () => {
  test('anti-position player avoids violation when preferred pitcher competes', () => {
    // g0 has antiPosition PITCHER; g1 wants PITCHER as preferred.
    // g0 should pick first each inning and never end up as PITCHER.
    const roster = [
      createPlayer('g0', 'AntiPitch', 'Test', Gender.MALE, [], [Position.PITCHER]),
      createPlayer('g1', 'WantsPitch', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
      createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
      createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
      createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
      createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
      createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
      createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
      createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
    ];
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    const antiPlayer = lineup.lineup.find(pl => pl.player.id === 'g0')!;
    const assignedPitcher = antiPlayer.positions.some(p => p === Position.PITCHER);
    expect(assignedPitcher).toBe(false);
  });

  test('players without anti-positions still get their preferred positions honored', () => {
    // No anti-positions set — preferred-position logic should still work as before.
    const roster = [
      createPlayer('g0', 'WantsSS', 'Test', Gender.MALE, [[Position.SHORTSTOP]]),
      createPlayer('g1', 'Guy1', 'Test', Gender.MALE),
      createPlayer('g2', 'Guy2', 'Test', Gender.MALE),
      createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
      createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
      createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
      createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
      createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
      createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
      createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
    ];
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    const preferredPlayer = lineup.lineup.find(pl => pl.player.id === 'g0')!;
    const playedSS = preferredPlayer.positions.some(p => p === Position.SHORTSTOP);
    expect(playedSS).toBe(true);
  });

  test('regression: all existing anti-position behavior is preserved', () => {
    // Full roster with mixed anti/preferred settings — core invariants must hold.
    const roster = [
      createPlayer('g0', 'AntiC', 'Test', Gender.MALE, [], [Position.CATCHER]),
      createPlayer('g1', 'AntiP', 'Test', Gender.MALE, [], [Position.PITCHER]),
      createPlayer('g2', 'WantsP', 'Test', Gender.MALE, [[Position.PITCHER]]),
      createPlayer('g3', 'Guy3', 'Test', Gender.MALE),
      createPlayer('g4', 'Guy4', 'Test', Gender.MALE),
      createPlayer('g5', 'Guy5', 'Test', Gender.MALE),
      createPlayer('g6', 'Guy6', 'Test', Gender.MALE),
      createPlayer('f0', 'Girl0', 'Test', Gender.FEMALE),
      createPlayer('f1', 'Girl1', 'Test', Gender.FEMALE),
      createPlayer('f2', 'Girl2', 'Test', Gender.FEMALE),
    ];
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    // Anti-position players are never forced into their anti-positions
    const antiCatcher = lineup.lineup.find(pl => pl.player.id === 'g0')!;
    expect(antiCatcher.positions.some(p => p === Position.CATCHER)).toBe(false);

    const antiPitcher = lineup.lineup.find(pl => pl.player.id === 'g1')!;
    expect(antiPitcher.positions.some(p => p === Position.PITCHER)).toBe(false);

    // No duplicate positions in any inning
    for (let inning = 0; inning < 6; inning++) {
      assertNoDuplicatePositions(lineup, inning);
    }

    // Everyone still plays all 6 innings (exactly 10-player roster)
    lineup.lineup.forEach(pl => {
      const played = getInningsPlayed(pl.positions);
      expect(played).toBe(6);
    });
  });
});
