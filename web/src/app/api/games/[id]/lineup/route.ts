import { NextRequest, NextResponse } from 'next/server';
import { readRoster, readRsvps } from '@/lib/data';
import { generateLineup } from '@cli/generator';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rsvps = readRsvps(id);

  if (rsvps.length === 0) {
    return NextResponse.json(
      { error: 'No RSVPs found for this game. Enter RSVPs first.' },
      { status: 422 }
    );
  }

  const players = readRoster();

  try {
    const lineup = generateLineup(rsvps, players);
    return NextResponse.json(lineup);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate lineup';
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
