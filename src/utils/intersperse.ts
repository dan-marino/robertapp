import { PlayerWithMetadata } from '../models/PlayerSorter';

/**
 * Merges sorted guys and girls arrays into a single batting-order array.
 *
 * Priority rules (in order):
 * 1. No girl leadoff — position 1 is always a guy
 * 2. No more than 3 consecutive guys between girls
 * 3. End with a girl (best effort — honored when guys.length <= 3 * girls.length)
 * 4. Girls spread as evenly as possible within the above constraints
 */
export function intersperseBattingOrder(
  guys: PlayerWithMetadata[],
  girls: PlayerWithMetadata[]
): PlayerWithMetadata[] {
  if (girls.length === 0) return [...guys];
  if (guys.length === 0) return [...girls];

  const G = guys.length;
  const R = girls.length;

  // Rule 3: end with a girl when mathematically possible (G ≤ 3·R means we can
  // distribute all guys before girls with each run ≤ 3)
  const endWithGirl = G <= 3 * R;

  // Number of guy-slots: one before each girl (ending with girl) or one extra after (ending with guy)
  const numSlots = endWithGirl ? R : R + 1;

  // Distribute G guys across numSlots as evenly as possible
  const slots = distributeEvenly(G, numSlots);

  const result: PlayerWithMetadata[] = [];
  let guyIdx = 0;
  let girlIdx = 0;

  for (let i = 0; i < numSlots; i++) {
    // Fill the guy-slot
    for (let j = 0; j < slots[i]; j++) {
      if (guyIdx < guys.length) result.push(guys[guyIdx++]);
    }
    // Append a girl after this slot — except the last slot when ending with guys
    const appendGirl = endWithGirl || i < numSlots - 1;
    if (appendGirl && girlIdx < girls.length) {
      result.push(girls[girlIdx++]);
    }
  }

  // Safety: flush any remaining players (should not occur under normal ratios)
  while (guyIdx < guys.length) result.push(guys[guyIdx++]);
  while (girlIdx < girls.length) result.push(girls[girlIdx++]);

  return result;
}

/**
 * Distributes `total` items across `slots` as evenly as possible.
 * The first `total % slots` entries receive one extra item.
 */
function distributeEvenly(total: number, slots: number): number[] {
  const base = Math.floor(total / slots);
  const remainder = total % slots;
  return Array.from({ length: slots }, (_, i) => (i < remainder ? base + 1 : base));
}
