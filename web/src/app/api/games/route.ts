import { NextResponse } from 'next/server';
import { readSeason } from '@/lib/data';

export async function GET() {
  const data = readSeason();
  return NextResponse.json(data);
}
