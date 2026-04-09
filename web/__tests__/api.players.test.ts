import { NextRequest } from 'next/server';
import { Gender } from '@cli/types';

jest.mock('@/lib/data');
import { readRoster, writeRoster } from '@/lib/data';
const mockReadRoster = readRoster as jest.MockedFunction<typeof readRoster>;
const mockWriteRoster = writeRoster as jest.MockedFunction<typeof writeRoster>;

import { GET, POST } from '@/app/api/players/route';
import { PUT, DELETE } from '@/app/api/players/[id]/route';

const PLAYERS = [
  { id: 'p1', firstName: 'John', lastName: 'Smith', gender: Gender.MALE, preferredPositions: [], antiPositions: [] },
  { id: 'p2', firstName: 'Jane', lastName: 'Doe', gender: Gender.FEMALE, preferredPositions: [], antiPositions: [] },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockReadRoster.mockReturnValue(PLAYERS);
  mockWriteRoster.mockImplementation(() => {});
});

describe('GET /api/players', () => {
  test('returns all players', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(PLAYERS);
  });
});

describe('POST /api/players', () => {
  test('creates a new player and returns 201', async () => {
    const newPlayer = { firstName: 'Mike', lastName: 'Jones', gender: Gender.MALE };
    const req = new NextRequest('http://localhost/api/players', {
      method: 'POST',
      body: JSON.stringify(newPlayer),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.firstName).toBe('Mike');
    expect(body.id).toMatch(/^p\d+/);
    expect(mockWriteRoster).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ firstName: 'Mike' })])
    );
  });

  test('returns 400 when required fields are missing', async () => {
    const req = new NextRequest('http://localhost/api/players', {
      method: 'POST',
      body: JSON.stringify({ firstName: 'Mike' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/players/[id]', () => {
  test('updates an existing player', async () => {
    const req = new NextRequest('http://localhost/api/players/p1', {
      method: 'PUT',
      body: JSON.stringify({ firstName: 'Jonathan' }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'p1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.firstName).toBe('Jonathan');
    expect(body.id).toBe('p1');
  });

  test('returns 404 for unknown player', async () => {
    const req = new NextRequest('http://localhost/api/players/unknown', {
      method: 'PUT',
      body: JSON.stringify({ firstName: 'X' }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'unknown' }) });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/players/[id]', () => {
  test('removes the player and returns success', async () => {
    const req = new NextRequest('http://localhost/api/players/p1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'p1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockWriteRoster).toHaveBeenCalledWith(
      expect.not.arrayContaining([expect.objectContaining({ id: 'p1' })])
    );
  });

  test('returns 404 for unknown player', async () => {
    const req = new NextRequest('http://localhost/api/players/unknown', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'unknown' }) });
    expect(res.status).toBe(404);
  });
});
