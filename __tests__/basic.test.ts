import { generateLineup } from '../src/generator';
import { createRoster, createAllRSVPs } from './setup';

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
});
