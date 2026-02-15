# Global Death Counter 2026

Static frontend-only website that displays model-based increasing death counters for the world and individual countries using annual estimates.

## Files

- `index.html`
- `style.css`
- `main.js`
- `deaths_annual_2026.json`

## How the counter is calculated

The counter is not a live feed. It is a deterministic model:

1. Use annual death estimate for each entity (`annual_deaths_estimate`).
2. Compute exact seconds in year 2026 with UTC timestamps:
   - `seconds_in_year = (UTC(2027-01-01) - UTC(2026-01-01)) / 1000`
3. Compute per-second model rate:
   - `rate = annual_deaths / seconds_in_year`
4. Use base timestamp:
   - `2026-01-01T00:00:00Z`
5. For each animation frame:
   - `elapsed_seconds = (now - base_timestamp) / 1000`
   - clamped to `[0, seconds_in_year]`
6. Display cumulative modeled deaths:
   - `display_count = floor(rate * elapsed_seconds)`

## Data methodology

- `deaths_annual_2026.json` includes:
  - `WORLD` total
  - 250 ISO-3166 alpha-3 country/territory codes
- Since finalized official 2026 death counts do not exist in real-time, estimates are computed from latest available baseline mortality/population data:
  - Latest available crude death rate (`SP.DYN.CDRT.IN`, deaths per 1,000)
  - Latest available total population (`SP.POP.TOTL`)
  - Annual estimate formula: `population * (crude_death_rate / 1000)`
  - Regional fallback death rates are used when a country-level death rate is unavailable.

## Disclaimer

This is a model-based estimate derived from annual mortality data, not live reported deaths.

## Run locally

No build step is required.

Use any static file server, for example:

```bash
python3 -m http.server 8080
```

Then open:

`http://localhost:8080`

This site is deployable as-is to GitHub Pages or Vercel static hosting.
