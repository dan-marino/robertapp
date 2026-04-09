import { NextRequest, NextResponse } from 'next/server';
import { readRoster, writeRoster } from '@/lib/data';
import type { Player } from '@cli/types';

export async function GET() {
  const players = readRoster();
  return NextResponse.json(players);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as Omit<Player, 'id'>;

  if (!body.firstName || !body.lastName || !body.gender) {
    return NextResponse.json({ error: 'firstName, lastName, and gender are required' }, { status: 400 });
  }

  const players = readRoster();
  const newPlayer: Player = {
    ...body,
    id: `p${Date.now()}`,
    preferredPositions: body.preferredPositions ?? [],
    antiPositions: body.antiPositions ?? [],
  };

  writeRoster([...players, newPlayer]);
  return NextResponse.json(newPlayer, { status: 201 });
}
