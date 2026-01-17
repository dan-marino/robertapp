# Softball Lineup Generator

Automated lineup and position assignment tool for co-ed softball teams.

## Features

- 🎯 Fair playing time distribution across all players
- 👥 Co-ed league rule compliance (3 girls minimum, 7 guys maximum on field)
- ⏰ Late arrival handling (sits inning 1, bottom 20% of batting order)
- 📊 6-inning position rotation
- 📝 CSV export ready for Google Sheets

## Quick Start

### 1. Setup
```bash
# Run all setup commands from setup-commands artifact
cd robertapp
npm install
```

### 2. Configure Your Team
Edit the following files:
- `src/data/roster.json` - Add your team's players
- `src/rsvp.ts` - Update RSVPs for your game

### 3. Generate Lineup
```bash
npm start
```

This will:
- Generate the lineup
- Print it to console
- Save to `output/game-g1-lineup.csv`

### 4. Import to Google Sheets
- Open the CSV file
- Copy contents
- Paste into Google Sheets

## File Structure

```
robertapp/
├── src/
│   ├── types.ts              # Core data types
│   ├── generator.ts          # Main entry point for generation
│   ├── csv-writer.ts         # CSV output formatting
│   ├── index.ts              # CLI runner
│   ├── rsvp.ts               # Game RSVPs
│   ├── models/
│   │   ├── LineupBuilder.ts      # Orchestrates lineup generation
│   │   ├── PlayerSorter.ts       # Organizes players by gender/arrival
│   │   └── PositionAssigner.ts   # Assigns positions with fairness
│   ├── utils/
│   │   └── calculations.ts       # Math helpers
│   └── data/
│       ├── roster.json           # Team roster
│       └── season.json           # Season and game info
└── output/
    └── *.csv                     # Generated lineups
```

## How It Works

### Algorithm Overview

1. **Player Organization** (`PlayerSorter`)
   - Split players by gender
   - Sort: on-time players first, late players last
   - Late players automatically go to bottom 20% of batting order

2. **Field Composition** (`calculations.ts`)
   - Guys: maximum 7 on field
   - Girls: minimum 3 on field
   - Total: 10 players on field when possible

3. **Position Assignment** (`PositionAssigner`)
   - Calculate fair inning distribution
   - Everyone plays roughly equal time (±1 inning)
   - Late arrivals sit inning 1
   - Rotate through all field positions

4. **Output** (`CSVWriter`)
   - Guys lineup first
   - Empty row separator
   - Girls lineup second
   - Each row: Name | Inn1 | Inn2 | Inn3 | Inn4 | Inn5 | Inn6

### Position Abbreviations
- `P` - Pitcher
- `C` - Catcher
- `1B`, `2B`, `3B` - Bases
- `SS` - Shortstop
- `LF`, `LCF`, `RCF`, `RF` - Outfield
- `-` - Bench

## Example Output

```csv
Name,Inn1,Inn2,Inn3,Inn4,Inn5,Inn6
1. John Smith,P,1B,-,SS,-,2B
2. Mike Johnson,-,C,3B,-,P,-
3. Dave Williams,2B,-,P,-,C,-

1. Sarah Martin,1B,-,P,2B,-,C
2. Emma Garcia,C,SS,-,-,1B,P
```

## Future Enhancements

- [ ] Position preferences (1-3 preferred positions per player)
- [ ] Anti-positions (0-2 positions to avoid)
- [ ] Skill-based optimization ("playoff mode")
- [ ] Player stats tracking
- [ ] Multiple seasons/games management
- [ ] Web interface
- [ ] Real-time game updates

## Development

### Run
```bash
npm start
```

### Build
```bash
npm run build
```

### Add Tests (Future)
```bash
npm test
```

## License

MIT