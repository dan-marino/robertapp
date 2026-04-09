import { NextRequest, NextResponse } from 'next/server';
import { readRsvps, writeRsvps } from '@/lib/data';
import type { RSVP } from '@cli/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(readRsvps(id));
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
