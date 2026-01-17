import { generateLineup } from '../src/generator';
import { Position } from '../src/types';
import {
  createRoster,
  createRSVP,
  createAllRSVPs,
  getInningsPlayed,
  getPositionsInInning,
} from './setup';

describe('Late Arrival Handling', () => {
  describe('Inning 1 Bench Requirement', () => {
    test('late players sit inning 1', () => {
      const roster = createRoster(14, 4);
      const rsvps = [
        createRSVP('g0', true), // Late guy
        ...roster.slice(1, 14).map(p => createRSVP(p.id)),
        createRSVP('f0', true), // Late girl
        ...roster.slice(15).map(p => createRSVP(p.id)),
      ];

      const lineup = generateLineup(rsvps, roster);

      const lateGuy = lineup.lineup.find(p => p.player.id === 'g0')!;
      const lateGirl = lineup.lineup.find(p => p.player.id === 'f0')!;

      expect(lateGuy.positions[0]).toBe(Position.BENCH);
      expect(lateGirl.positions[0]).toBe(Position.BENCH);
    });

    test('multiple late guys all sit inning 1', () => {
      const roster = createRoster(14, 4);
      const rsvps = [
        createRSVP('g0', true),
        createRSVP('g1', true),
        createRSVP('g2', true),
        ...roster.slice(3, 14).map(p => createRSVP(p.id)),
        ...roster.slice(14).map(p => createRSVP(p.id)),
      ];

      const lineup = generateLineup(rsvps, roster);

      expect(lineup.lineup.find(p => p.player.id === 'g0')!.positions[0]).toBe(Position.BENCH);
      expect(lineup.lineup.find(p => p.player.id === 'g1')!.positions[0]).toBe(Position.BENCH);
      expect(lineup.lineup.find(p => p.player.id === 'g2')!.positions[0]).toBe(Position.BENCH);
    });

    test('all late arrivals scenario - everyone sits inning 1', () => {
      const roster = createRoster(10, 4);
      const rsvps = createAllRSVPs(roster, true);
      const lineup = generateLineup(rsvps, roster);

      lineup.lineup.forEach(player => {
        expect(player.positions[0]).toBe(Position.BENCH);
      });
    });

    test('all late arrivals still field 10 players in innings 2-6', () => {
      const roster = createRoster(10, 4);
      const rsvps = createAllRSVPs(roster, true);
      const lineup = generateLineup(rsvps, roster);

      for (let inning = 1; inning < 6; inning++) {
        const playersOnField = getPositionsInInning(lineup, inning);
        expect(playersOnField.length).toBe(10);
      }
    });
  });

  describe('Batting Order Placement', () => {
    test('late players are in bottom 20% of batting order', () => {
      const roster = createRoster(14, 4);
      const rsvps = [
        createRSVP('g0', true),
        createRSVP('g1', true),
        ...roster.slice(2, 14).map(p => createRSVP(p.id)),
        createRSVP('f0', true),
        ...roster.slice(15).map(p => createRSVP(p.id)),
      ];

      const lineup = generateLineup(rsvps, roster);

      // Late guys should be in positions 13-14 (bottom 20% of 14)
      const lateGuy0 = lineup.lineup.find(p => p.player.id === 'g0')!;
      const lateGuy1 = lineup.lineup.find(p => p.player.id === 'g1')!;
      expect(lateGuy0.battingOrder).toBeGreaterThanOrEqual(13);
      expect(lateGuy1.battingOrder).toBeGreaterThanOrEqual(13);

      // Late girl should be position 4 (last in batting order)
      const lateGirl = lineup.lineup.find(p => p.player.id === 'f0')!;
      expect(lateGirl.battingOrder).toBe(4);
    });

    test('on-time players bat before late players', () => {
      const roster = createRoster(10, 4);
      const rsvps = [
        ...roster.slice(0, 8).map(p => createRSVP(p.id)), // On-time guys
        createRSVP('g8', true), // Late guys
        createRSVP('g9', true),
        ...roster.slice(10, 13).map(p => createRSVP(p.id)), // On-time girls
        createRSVP('f3', true), // Late girl
      ];

      const lineup = generateLineup(rsvps, roster);

      // First 8 guys should be on-time
      for (let i = 0; i < 8; i++) {
        const player = lineup.lineup[i];
        expect(player.player.id).not.toBe('g8');
        expect(player.player.id).not.toBe('g9');
      }

      // Last 2 guys should be late
      expect(['g8', 'g9']).toContain(lineup.lineup[8].player.id);
      expect(['g8', 'g9']).toContain(lineup.lineup[9].player.id);

      // First 3 girls should be on-time
      for (let i = 0; i < 3; i++) {
        expect(lineup.lineup[10 + i].player.id).not.toBe('f3');
      }

      // Last girl should be late
      expect(lineup.lineup[13].player.id).toBe('f3');
    });
  });

  describe('Fair Playing Time After Inning 1', () => {
    test('late players still get fair playing time after inning 1', () => {
      const roster = createRoster(14, 4);
      const rsvps = [
        createRSVP('g0', true),
        ...roster.slice(1, 14).map(p => createRSVP(p.id)),
        createRSVP('f0', true),
        ...roster.slice(15).map(p => createRSVP(p.id)),
      ];

      const lineup = generateLineup(rsvps, roster);

      const lateGuy = lineup.lineup.find(p => p.player.id === 'g0')!;
      const lateGirl = lineup.lineup.find(p => p.player.id === 'f0')!;

      // Should still play 2-3 innings after sitting inning 1
      const guyInnings = getInningsPlayed(lateGuy.positions);
      const girlInnings = getInningsPlayed(lateGirl.positions);

      expect(guyInnings).toBeGreaterThanOrEqual(2);
      expect(girlInnings).toBeGreaterThanOrEqual(4);
    });

    test('late players catch up in innings 2-6', () => {
      const roster = createRoster(10, 4);
      const rsvps = [
        ...roster.slice(0, 8).map(p => createRSVP(p.id)),
        createRSVP('g8', true),
        createRSVP('g9', true),
        ...roster.slice(10).map(p => createRSVP(p.id)),
      ];

      const lineup = generateLineup(rsvps, roster);

      const lateGuy1 = lineup.lineup.find(p => p.player.id === 'g8')!;
      const lateGuy2 = lineup.lineup.find(p => p.player.id === 'g9')!;

      // Should play most of innings 2-6
      const innings1 = getInningsPlayed(lateGuy1.positions);
      const innings2 = getInningsPlayed(lateGuy2.positions);

      expect(innings1).toBeGreaterThanOrEqual(3);
      expect(innings2).toBeGreaterThanOrEqual(3);
    });

    test('late arrivals do not get unfairly benched after inning 1', () => {
      const roster = createRoster(14, 4);
      const rsvps = [
        createRSVP('g0', true),
        createRSVP('g1', true),
        ...roster.slice(2, 14).map(p => createRSVP(p.id)),
        ...roster.slice(14).map(p => createRSVP(p.id)),
      ];

      const lineup = generateLineup(rsvps, roster);

      const lateGuy0 = lineup.lineup.find(p => p.player.id === 'g0')!;
      const lateGuy1 = lineup.lineup.find(p => p.player.id === 'g1')!;

      // Late guys: sit inning 1, then play 2-3 more innings
      // Total: 2-3 innings (vs 3 innings for on-time guys)
      const innings0 = getInningsPlayed(lateGuy0.positions);
      const innings1 = getInningsPlayed(lateGuy1.positions);

      // Should be within 1 inning of fair share
      expect(innings0).toBeGreaterThanOrEqual(2);
      expect(innings0).toBeLessThanOrEqual(3);
      expect(innings1).toBeGreaterThanOrEqual(2);
      expect(innings1).toBeLessThanOrEqual(3);
    });
  });

  describe('Mixed Late/On-time Scenarios', () => {
    test('handles mix of late and on-time players', () => {
      const roster = createRoster(14, 4);
      const rsvps = [
        createRSVP('g0', true),
        ...roster.slice(1, 7).map(p => createRSVP(p.id)),
        createRSVP('g7', true),
        ...roster.slice(8, 14).map(p => createRSVP(p.id)),
        createRSVP('f0', true),
        ...roster.slice(15, 17).map(p => createRSVP(p.id)),
        createRSVP('f3', true),
      ];

      const lineup = generateLineup(rsvps, roster);

      // All late players sit inning 1
      expect(lineup.lineup.find(p => p.player.id === 'g0')!.positions[0]).toBe(Position.BENCH);
      expect(lineup.lineup.find(p => p.player.id === 'g7')!.positions[0]).toBe(Position.BENCH);
      expect(lineup.lineup.find(p => p.player.id === 'f0')!.positions[0]).toBe(Position.BENCH);
      expect(lineup.lineup.find(p => p.player.id === 'f3')!.positions[0]).toBe(Position.BENCH);

      // On-time players can play inning 1
      const onTimeGuys = lineup.lineup
        .slice(0, lineup.guysCount)
        .filter(p => !['g0', 'g7'].includes(p.player.id));

      const onTimePlaying = onTimeGuys.filter(p => p.positions[0] !== Position.BENCH);
      expect(onTimePlaying.length).toBeGreaterThan(0);
    });
  });
});
