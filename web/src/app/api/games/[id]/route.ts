import { NextRequest, NextResponse } from 'next/server';
import { updateGame } from '@/lib/data';
import type { LineupMode } from '@cli/types';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json() as { lineupMode?: LineupMode };

  if (body.lineupMode !== undefined) {
    if (body.lineupMode !== 'split' && body.lineupMode !== 'unified') {
      return NextResponse.json({ error: 'Invalid lineupMode' }, { status: 400 });
    }
    updateGame(id, { lineupMode: body.lineupMode });
  }

  return NextResponse.json({ ok: true });
}
