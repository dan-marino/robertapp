# Changelog

## Unreleased

### Added
- Next.js 15 web admin at `web/` (React 19, Tailwind CSS 4)
- Player management: list, add, edit, and delete players via `/players` page and REST API
- RSVP management: per-game attending/late toggles via `/games/[id]/rsvp` and `PUT /api/games/[id]/rsvps`
- Lineup visualization: color-coded position grid at `/games/[id]/lineup`, reusing `generateLineup()` from CLI
- CSV download button in lineup view for direct Google Sheets import
- File-system data layer (`web/src/lib/data.ts`) reading/writing shared JSON files in `src/data/`
- Jest tests for all API routes and data layer (`web/__tests__/`)
- `preferredPositions` and `antiPositions` fields on `Player` type
- Position preference logic in `PositionAssigner`: players with unmet preferred positions get first pick each inning
- Anti-position avoidance: player is never assigned a refused position when alternatives exist
- Preference tracking (`preferredPlaysCount`) across all 6 innings
- 6 new tests covering preferred position fulfillment, anti-position avoidance, and fairness with preferences active
- Position preferences and anti-positions populated for all 20 players in `roster.json`
- `CLAUDE.md`, `ARCHITECTURE.md`, `CHANGELOG.md`

## v1.0.0

### Added
- CLI app generating co-ed softball lineups from a roster and RSVP list
- Fair playing time distribution (±1 inning across all players)
- Co-ed rule enforcement: min 3 girls, max 7 guys on field per inning
- Late arrival handling: benched inning 1, placed in bottom 20% of batting order
- Position rotation to avoid repeating the same spot each inning
- CSV output split into two batting orders (guys / girls) for Google Sheets
- Jest test suite: co-ed rules, fairness, position uniqueness, late arrivals
