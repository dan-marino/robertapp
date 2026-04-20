# Changelog

## Unreleased

### Added
- **Unified mode playing time fairness** — fixed structural 2-inning gap between guys and girls in unified mode. `PositionAssigner` now computes uniform targets (total spots ÷ total players) with a feasibility check; falls back to gender-specific targets only when the girl collective cannot meet the mandatory floor. New `selectCandidatesUnified()` selects all 10 players per inning from a combined pool with gender constraints.
- **Whole-game position shuffle** — replaced the per-inning-independent shuffle with a two-phase whole-game algorithm: (1) preferred pitchers are assigned consecutive inning blocks (2+2+2 / 3+3 / 6) with shuffled candidate selection for rotation variety; (2) remaining positions are assigned with a shared `positionCounts` map so players cycle through different positions across all 6 innings rather than repeating the same spot.
- **Unified batting lineup mode** — set `"lineupMode": "unified"` on a game in `src/data/season.json` to merge guys and girls into a single numbered batting order. Omitting the field defaults to `"split"` (existing behavior unchanged). Placement rules in unified mode: no girl leadoff, no more than 3 consecutive guys, last batter is a girl when mathematically possible, girls distributed as evenly as possible. Web UI shows female rows with a pink background tint; CSV exports a single section with no separator row.
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
