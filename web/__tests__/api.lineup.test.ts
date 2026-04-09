import { NextRequest } from 'next/server';
import { Gender } from '@cli/types';

jest.mock('@/lib/data');
import { readRsvps, readRoster } from '@/lib/data';
const mockReadRsvps = readRsvps as jest.MockedFunction<typeof readRsvps>;
const mockReadRoster = readRoster as jest.MockedFunction<typeof readRoster>;

import { GET } from '@/app/api/games/[id]/lineup/route';

// Minimal 10-player roster (7M + 3F) — exact field spots, no bench needed
const ROSTER = [
  { id: 'g0', firstName: 'Guy0', lastName: 'T', gender: Gender.MALE, preferredPositions: [], antiPositions: [] },
  { id: 'g1', firstName: 'Guy1', lastName: 'T', gender: Gender.MALE, preferredPositions: [], antiPositions: [] },
  { id: 'g2', firstName: 'Guy2', lastName: 'T', gender: Gender.MALE, preferredPositions: [], antiPositions: [] },
  { id: 'g3', firstName: 'Guy3', lastName: 'T', gender: Gender.MALE, preferredPositions: [], antiPositions: [] },
  { id: 'g4', firstName: 'Guy4', lastName: 'T', gender: Gender.MALE, preferredPositions: [], antiPositions: [] },
  { id: 'g5', firstName: 'Guy5', lastName: 'T', gender: Gender.MALE, preferredPositions: [], antiPositions: [] },
  { id: 'g6', firstName: 'Guy6', lastName: 'T', gender: Gender.MALE, preferredPositions: [], antiPositions: [] },
  { id: 'f0', firstName: 'Girl0', lastName: 'T', gender: Gender.FEMALE, preferredPositions: [], antiPositions: [] },
  { id: 'f1', firstName: 'Girl1', lastName: 'T', gender: Gender.FEMALE, preferredPositions: [], antiPositions: [] },
  { id: 'f2', firstName: 'Girl2', lastName: 'T', gender: Gender.FEMALE, preferredPositions: [], antiPositions: [] },
];
const RSVPS = ROSTER.map(p => ({ playerId: p.id, isLate: false }));

beforeEach(() => {
  jest.clearAllMocks();
  mockReadRoster.mockReturnValue(ROSTER);
});

describe('GET /api/games/[id]/lineup', () => {
  test('returns 422 when no RSVPs exist', async () => {
    mockReadRsvps.mockReturnValue([]);
    const req = new NextRequest('http://localhost/api/games/g1/lineup');
    const res = await GET(req, { params: Promise.resolve({ id: 'g1' }) });
    expect(res.status).toBe(422);
  });

  test('returns a GameLineup when RSVPs exist', async () => {
    mockReadRsvps.mockReturnValue(RSVPS);
    const req = new NextRequest('http://localhost/api/games/g1/lineup');
    const res = await GET(req, { params: Promise.resolve({ id: 'g1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty('lineup');
    expect(body).toHaveProperty('guysCount');
    expect(body).toHaveProperty('girlsCount');
    expect(body.lineup).toHaveLength(10);
    expect(body.guysCount).toBe(7);
    expect(body.girlsCount).toBe(3);
  });

  test('each player lineup has 6 position slots', async () => {
    mockReadRsvps.mockReturnValue(RSVPS);
    const req = new NextRequest('http://localhost/api/games/g1/lineup');
    const res = await GET(req, { params: Promise.resolve({ id: 'g1' }) });
    const body = await res.json();

    body.lineup.forEach((pl: { positions: string[] }) => {
      expect(pl.positions).toHaveLength(6);
    });
  });
});
