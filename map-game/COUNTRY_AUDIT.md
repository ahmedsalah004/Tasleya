# Map-game country coverage audit

Run:

```bash
node tools/map-game-country-audit.mjs
```

## Data sources the audit compares
1. Map feature countries from the runtime map source (`geo-countries` GeoJSON).
2. Local question export (preferred):
   - `data/map-game/questions-export.csv` (recommended)
   - or `data/map-game/questions-export.json`
   - or pass a path: `node tools/map-game-country-audit.mjs --export=/path/to/file.csv`

If live worker endpoints are blocked, export your map-game questions from Sheets/DB and place them in the path above.

## Notes
- ISO alpha-2/alpha-3 matching is used first.
- Alias/name matching is fallback only and reported as suspicious alias-only matches.
- The command exits non-zero when all-country coverage is not complete or required small countries are missing.
