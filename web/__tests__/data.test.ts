import fs from 'fs';
import { Gender } from '@cli/types';
import {
  readRoster,
  writeRoster,
  readRsvps,
  writeRsvps,
  readSeason,
} from '@/lib/data';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('readRoster', () => {
  test('parses roster.json and returns players array', () => {
    const players = [
      { id: 'p1', firstName: 'John', lastName: 'Smith', gender: Gender.MALE },
    ];
    mockFs.readFileSync.mockReturnValue(JSON.stringify({ players }) as unknown as Buffer);

    const result = readRoster();
    expect(result).toEqual(players);
  });
});

describe('writeRoster', () => {
  test('writes players wrapped in { players } to roster.json', () => {
    const players = [
      { id: 'p1', firstName: 'John', lastName: 'Smith', gender: Gender.MALE },
    ];

    writeRoster(players);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('roster.json'),
      JSON.stringify({ players }, null, 2),
      'utf-8'
    );
  });
});

describe('readRsvps', () => {
  test('returns empty array when rsvp file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);

    const result = readRsvps('g1');
    expect(result).toEqual([]);
  });

  test('parses and returns rsvps when file exists', () => {
    const rsvps = [{ playerId: 'p1', isLate: false }];
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue(JSON.stringify(rsvps) as unknown as Buffer);

    const result = readRsvps('g1');
    expect(result).toEqual(rsvps);
  });
});

describe('writeRsvps', () => {
  test('writes rsvps to rsvps-{gameId}.json', () => {
    const rsvps = [{ playerId: 'p1', isLate: true }];

    writeRsvps('g1', rsvps);

    expect(mockFs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining('rsvps-g1.json'),
      JSON.stringify(rsvps, null, 2),
      'utf-8'
    );
  });
});

describe('readSeason', () => {
  test('parses and returns season data', () => {
    const data = {
      season: { id: 's1', name: 'Spring 2025', year: 2025, rosterIds: [] },
      games: [{ id: 'g1', seasonId: 's1', date: '2025-04-15', opponent: 'The Sluggers' }],
    };
    mockFs.readFileSync.mockReturnValue(JSON.stringify(data) as unknown as Buffer);

    const result = readSeason();
    expect(result).toEqual(data);
  });
});
