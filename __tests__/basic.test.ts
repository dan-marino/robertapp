import { generateLineup } from '../src/generator';
import { createRoster, createAllRSVPs, createRSVP } from './setup';
import { Gender } from '../src/types';

describe('Basic Functionality', () => {
  test('generates lineup with correct structure', () => {
    const roster = createRoster(10, 4);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    expect(lineup.guysCount).toBe(10);
    expect(lineup.girlsCount).toBe(4);
    expect(lineup.lineup.length).toBe(14);

    // Each player should have 6 innings of positions
    lineup.lineup.forEach(player => {
      expect(player.positions.length).toBe(6);
    });
  });

  test('batting order is sequential starting from 1', () => {
    const roster = createRoster(14, 4);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    // Guys batting order: 1, 2, 3, ...
    for (let i = 0; i < lineup.guysCount; i++) {
      expect(lineup.lineup[i].battingOrder).toBe(i + 1);
    }

    // Girls batting order: 1, 2, 3, ...
    for (let i = 0; i < lineup.girlsCount; i++) {
      expect(lineup.lineup[lineup.guysCount + i].battingOrder).toBe(i + 1);
    }
  });

  test('handles standard roster size (14 guys, 4 girls)', () => {
    const roster = createRoster(14, 4);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    expect(lineup.lineup.length).toBe(18);
    expect(lineup.guysCount).toBe(14);
    expect(lineup.girlsCount).toBe(4);
  });

  test('handles minimum viable team (7 guys, 3 girls)', () => {
    const roster = createRoster(7, 3);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    expect(lineup.lineup.length).toBe(10);
    expect(lineup.guysCount).toBe(7);
    expect(lineup.girlsCount).toBe(3);
  });

  test('handles large roster (19 players)', () => {
    const roster = createRoster(14, 5);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    expect(lineup.lineup.length).toBe(19);
  });

  test('every PlayerLineup has isLate and targetInnings fields', () => {
    const roster = createRoster(10, 4);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    lineup.lineup.forEach(pl => {
      expect(typeof pl.isLate).toBe('boolean');
      expect(typeof pl.targetInnings).toBe('number');
      expect(pl.targetInnings).toBeGreaterThan(0);
    });
  });

  test('late arrival player has isLate true; on-time players have isLate false', () => {
    const roster = createRoster(10, 4);
    // Make the last guy a late arrival
    const rsvps = [
      ...roster.slice(0, roster.length - 1).map(p => createRSVP(p.id, false)),
      createRSVP(roster[roster.length - 1].id, true),
    ];
    const lineup = generateLineup(rsvps, roster);

    const latePlayer = lineup.lineup.find(pl => pl.player.id === roster[roster.length - 1].id);
    expect(latePlayer?.isLate).toBe(true);

    const onTimePlayers = lineup.lineup.filter(pl => pl.player.id !== roster[roster.length - 1].id);
    onTimePlayers.forEach(pl => expect(pl.isLate).toBe(false));
  });

  test('targetInnings values sum to total field slots', () => {
    const roster = createRoster(10, 4);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster);

    // 10 field positions × 6 innings = 60 total field slots
    const totalTarget = lineup.lineup.reduce((sum, pl) => sum + pl.targetInnings, 0);
    expect(totalTarget).toBe(60);
  });

  test('unified mode: every PlayerLineup has isLate and targetInnings', () => {
    const roster = createRoster(10, 4);
    const rsvps = createAllRSVPs(roster);
    const lineup = generateLineup(rsvps, roster, 'unified');

    lineup.lineup.forEach(pl => {
      expect(typeof pl.isLate).toBe('boolean');
      expect(typeof pl.targetInnings).toBe('number');
      expect(pl.targetInnings).toBeGreaterThan(0);
    });

    const totalTarget = lineup.lineup.reduce((sum, pl) => sum + pl.targetInnings, 0);
    expect(totalTarget).toBe(60);
  });
});
