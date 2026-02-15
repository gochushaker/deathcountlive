# Global Death Counter 2026 + AI Mortality Projection 2030

Static frontend-only data visualization site using pure HTML, CSS, and vanilla JavaScript.

No backend, no frameworks, no build tools, no external runtime libraries.

## Files

- `index.html`
- `style.css`
- `main.js`
- `deaths_annual_2026.json`
- `population_2026.json`
- `world.geojson`
- `README.md`

## 1) 2026 Real-Time Death Counter Model

The displayed values are **model-based counters** (not live incident reporting).

- Base timestamp: `2026-01-01T00:00:00Z` (UTC)
- Seconds in year:
  - `seconds_in_year = (UTC(2027-01-01) - UTC(2026-01-01)) / 1000`
- Per-second rate:
  - `rate = annual_deaths / seconds_in_year`
- Elapsed seconds:
  - `elapsed_seconds = (now_utc - base_utc) / 1000`
  - clamped to `[0, seconds_in_year]`
- Displayed cumulative deaths:
  - `floor(rate * elapsed_seconds)`

Animation uses `requestAnimationFrame`.

## 2) Heatmap Metric

Country fill color is based on normalized mortality burden:

- `deaths_per_100k = (annual_deaths / population) * 100000`

Tooltip shows:

- Country name
- 2026 annual estimated deaths
- Deaths per 100k
- Current accumulated 2026 deaths from the same real-time model

## 3) AI Mortality Projection 2030 (Hypothetical Simulation)

### Baseline projection

- `baseline_2030 = annual_2026 * (1 + annual_growth_rate)^4`
- Default `annual_growth_rate = 0.005` (0.5%), configurable in `main.js`

### AI efficiency adjustment

- Slider range: `0%` to `50%`
- `new_deaths_2030 = baseline_2030 * (1 - efficiency_rate)`

Displayed for world and selected country:

- Baseline 2030 deaths
- Projected 2030 deaths
- Reduction vs baseline (absolute and %)

Slider changes animate with interpolated transitions.

## Data Assumptions

- `deaths_annual_2026.json`: local annual death estimates keyed by `ISO-3166 alpha-3` and `WORLD`.
- `population_2026.json`: local population baseline keyed by `ISO-3166 alpha-3` and `WORLD`.
- `world.geojson`: simplified country polygons for static SVG rendering.
- If real finalized 2026 mortality values are unavailable, values are treated as annual estimates for model simulation.

## Ethical Disclaimer

- This visualization is for informational and educational modeling only.
- It is **not** a real-time mortality reporting system.
- The AI 2030 panel is a **hypothetical scenario model**, not a predictive medical forecast or policy recommendation.

## Run Locally

Because this project loads local JSON/GeoJSON via `fetch`, run it from a static file server:

```bash
python3 -m http.server 8080
```

Open:

`http://localhost:8080`

Deploy as static files to GitHub Pages or Vercel.
