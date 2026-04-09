import { NextRequest } from 'next/server';
import { Gender } from '@cli/types';

jest.mock('@/lib/data');
import { readRsvps, writeRsvps, readRoster } from '@/lib/data';
const mockReadRsvps = readRsvps as jest.MockedFunction<typeof readRsvps>;
const mockWriteRsvps = writeRsvps as jest.MockedFunction<typeof writeRsvps>;
const mockReadRoster = readRoster as jest.MockedFunction<typeof readRoster>;

import { GET, PUT } from '@/app/api/games/[id]/rsvps/route';

const ROSTER = [
  { id: 'p1', firstName: 'John', lastName: 'Smith', gender: Gender.MALE, preferredPositions: [], antiPositions: [] },
  { id: 'p2', firstName: 'Jane', lastName: 'Doe', gender: Gender.FEMALE, preferredPositions: [], antiPositions: [] },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockReadRoster.mockReturnValue(ROSTER);
  mockWriteRsvps.mockImplementation(() => {});
});

describe('GET /api/games/[id]/rsvps', () => {
  test('returns defaults with hasExisting=false when no RSVPs saved yet', async () => {
    mockReadRsvps.mockReturnValue([]);
    const req = new NextRequest('http://localhost/api/games/g1/rsvps');
    const res = await GET(req, { params: Promise.resolve({ id: 'g1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.hasExisting).toBe(false);
    expect(body.rsvps).toHaveLength(2);
    expect(body.rsvps[0]).toEqual({ playerId: 'p1', isLate: false });
  });

  test('returns existing RSVPs with hasExisting=true', async () => {
    const rsvps = [{ playerId: 'p1', isLate: true }];
    mockReadRsvps.mockReturnValue(rsvps);
    const req = new NextRequest('http://localhost/api/games/g1/rsvps');
    const res = await GET(req, { params: Promise.resolve({ id: 'g1' }) });
    const body = await res.json();

    expect(body.hasExisting).toBe(true);
    expect(body.rsvps).toEqual(rsvps);
  });
});

describe('PUT /api/games/[id]/rsvps', () => {
  test('saves RSVPs and returns them', async () => {
    const rsvps = [{ playerId: 'p1', isLate: false }];
    const req = new NextRequest('http://localhost/api/games/g1/rsvps', {
      method: 'PUT',
      body: JSON.stringify(rsvps),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'g1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.rsvps).toEqual(rsvps);
    expect(mockWriteRsvps).toHaveBeenCalledWith('g1', rsvps);
  });

  test('returns 400 for non-array body', async () => {
    const req = new NextRequest('http://localhost/api/games/g1/rsvps', {
      method: 'PUT',
      body: JSON.stringify({ wrong: true }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'g1' }) });
    expect(res.status).toBe(400);
  });
});
