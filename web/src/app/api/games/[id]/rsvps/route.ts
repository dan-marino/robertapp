import { NextRequest, NextResponse } from 'next/server';
import { readRsvps, writeRsvps, readRoster } from '@/lib/data';
import type { RSVP } from '@cli/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rsvps = readRsvps(id);

  // If no RSVPs saved yet, default every roster player to not attending
  if (rsvps.length === 0) {
    const players = readRoster();
    const defaults: RSVP[] = players.map(p => ({ playerId: p.id, isLate: false }));
    return NextResponse.json({ rsvps: defaults, hasExisting: false });
  }

  return NextResponse.json({ rsvps, hasExisting: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rsvps = await req.json() as RSVP[];

  if (!Array.isArray(rsvps)) {
    return NextResponse.json({ error: 'Body must be an array of RSVPs' }, { status: 400 });
  }

  writeRsvps(id, rsvps);
  return NextResponse.json({ rsvps });
}
