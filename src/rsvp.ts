import { RSVP } from './types';

// Sample RSVPs for game g1
// 14 guys, 4 girls = 18 total players
// Mike (p2) and Ashley (p18) are running late
export const sampleRSVPs: RSVP[] = [
  // Guys
  { playerId: 'p1', isLate: false },
  { playerId: 'p2', isLate: true },  // Mike is late
  { playerId: 'p3', isLate: false },
  { playerId: 'p4', isLate: false },
  { playerId: 'p5', isLate: false },
  { playerId: 'p6', isLate: false },
  { playerId: 'p7', isLate: false },
  { playerId: 'p8', isLate: false },
  { playerId: 'p9', isLate: false },
  { playerId: 'p10', isLate: false },
  { playerId: 'p11', isLate: false },
  { playerId: 'p12', isLate: false },
  { playerId: 'p13', isLate: false },
  { playerId: 'p14', isLate: false },
  
  // Girls
  { playerId: 'p15', isLate: false },
  { playerId: 'p16', isLate: false },
  { playerId: 'p17', isLate: false },
  { playerId: 'p18', isLate: true },  // Ashley is late
];

export const gameId = 'g1';
