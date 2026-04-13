import type { Metadata } from 'next';
import Link from 'next/link';
import { readSeason } from '@/lib/data';
import { formatGameDate } from '@/lib/utils';
import './globals.css';

export const metadata: Metadata = {
  title: 'Robertapp',
  description: 'Co-ed softball lineup generator',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { games } = readSeason();

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6 flex-wrap">
          <span className="font-semibold text-gray-800">Robertapp</span>
          <Link href="/players" className="text-sm text-gray-600 hover:text-gray-900">
            Players
          </Link>
          {games.map(g => (
            <div key={g.id} className="flex items-center gap-3 text-sm text-gray-500">
              <span className="text-gray-300">|</span>
              <span>{formatGameDate(g.date, 'short')} vs {g.opponent}</span>
              <Link href={`/games/${g.id}/rsvp`} className="text-gray-600 hover:text-gray-900">RSVP</Link>
              <Link href={`/games/${g.id}/lineup`} className="text-gray-600 hover:text-gray-900">Lineup</Link>
            </div>
          ))}
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
