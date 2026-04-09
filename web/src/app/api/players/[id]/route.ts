import { NextRequest, NextResponse } from 'next/server';
import { readRoster, writeRoster } from '@/lib/data';
import type { Player } from '@cli/types';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as Partial<Omit<Player, 'id'>>;
  const players = readRoster();
  const idx = players.findIndex(p => p.id === id);

  if (idx === -1) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  const updated = { ...players[idx], ...body };
  players[idx] = updated;
  writeRoster(players);
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const players = readRoster();
  const filtered = players.filter(p => p.id !== id);

  if (filtered.length === players.length) {
    return NextResponse.json({ error: 'Player not found' }, { status: 404 });
  }

  writeRoster(filtered);
  return NextResponse.json({ success: true });
}
