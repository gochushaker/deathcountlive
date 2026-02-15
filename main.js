(function () {
  "use strict";

  const ANNUAL_GROWTH_RATE = 0.005;
  const TARGET_YEAR = 2026;
  const START_UTC_MS = Date.UTC(TARGET_YEAR, 0, 1, 0, 0, 0);
  const END_UTC_MS = Date.UTC(TARGET_YEAR + 1, 0, 1, 0, 0, 0);
  const SECONDS_IN_YEAR = (END_UTC_MS - START_UTC_MS) / 1000;

  const el = {
    countrySearch: document.getElementById("country-search"),
    countrySelect: document.getElementById("country-select"),
    clockInfo: document.getElementById("clock-info"),

    worldCounter: document.getElementById("world-counter"),
    countryCounter: document.getElementById("country-counter"),
    countryTitle: document.getElementById("country-title"),

    worldPerYear: document.getElementById("world-per-year"),
    worldPerDay: document.getElementById("world-per-day"),
    worldPerMinute: document.getElementById("world-per-minute"),
    countryPerYear: document.getElementById("country-per-year"),
    countryPerDay: document.getElementById("country-per-day"),
    countryPerMinute: document.getElementById("country-per-minute"),

    worldMap: document.getElementById("world-map"),
    tooltip: document.getElementById("map-tooltip"),
    legendMin: document.getElementById("legend-min"),
    legendMax: document.getElementById("legend-max"),

    growthRateLabel: document.getElementById("growth-rate-label"),
    efficiencySlider: document.getElementById("efficiency-slider"),
    efficiencyLabel: document.getElementById("efficiency-label"),

    worldBase2030: document.getElementById("world-base-2030"),
    worldProj2030: document.getElementById("world-proj-2030"),
    worldDiff2030: document.getElementById("world-diff-2030"),
    countryProjTitle: document.getElementById("country-proj-title"),
    countryBase2030: document.getElementById("country-base-2030"),
    countryProj2030: document.getElementById("country-proj-2030"),
    countryDiff2030: document.getElementById("country-diff-2030"),
  };

  const nf = new Intl.NumberFormat("en-US");

  const state = {
    deaths: null,
    population: null,
    geo: null,
    namesByCode: new Map(),
    selectedCode: "USA",
    mapStatsByCode: new Map(),
    mapPathByCode: new Map(),
    hoveredCode: null,
    projectionDisplay: {
      worldBaseline: 0,
      worldProjected: 0,
      countryBaseline: 0,
      countryProjected: 0,
    },
    projectionTarget: {
      worldBaseline: 0,
      worldProjected: 0,
      countryBaseline: 0,
      countryProjected: 0,
    },
    projectionAnim: {
      start: 0,
      durationMs: 320,
      from: null,
      active: false,
    },
  };

  function formatInt(num) {
    return nf.format(Math.floor(num));
  }

  function formatRate(num) {
    return Number.isFinite(num) ? num.toFixed(1) : "0.0";
  }

  function countryName(code) {
    return state.namesByCode.get(code) || code;
  }

  function getElapsedSeconds() {
    const elapsed = (Date.now() - START_UTC_MS) / 1000;
    return Math.max(0, Math.min(SECONDS_IN_YEAR, elapsed));
  }

  function ratePerSecond(annualDeaths) {
    return annualDeaths / SECONDS_IN_YEAR;
  }

  function accumulatedDeaths(annualDeaths, elapsedSec) {
    return Math.floor(ratePerSecond(annualDeaths) * elapsedSec);
  }

  function perDay(annualDeaths) {
    return annualDeaths / (SECONDS_IN_YEAR / 86400);
  }

  function perMinute(annualDeaths) {
    return annualDeaths / (SECONDS_IN_YEAR / 60);
  }

  function bump(elm) {
    elm.classList.remove("bump");
    void elm.offsetWidth;
    elm.classList.add("bump");
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function toColorHex(r, g, b) {
    const n = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
    return `#${n(r)}${n(g)}${n(b)}`;
  }

  function colorForValue(v, min, max) {
    if (!Number.isFinite(v)) {
      return "#1a2640";
    }
    const t = max <= min ? 0 : (v - min) / (max - min);
    const clamped = Math.max(0, Math.min(1, t));
    const r = lerp(31, 115, clamped);
    const g = lerp(44, 226, clamped);
    const b = lerp(69, 255, clamped);
    return toColorHex(r, g, b);
  }

  function projectLonLat(lon, lat, width, height) {
    const x = ((lon + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  }

  function ringToPath(ring, width, height) {
    let d = "";
    for (let i = 0; i < ring.length; i += 1) {
      const p = ring[i];
      const [x, y] = projectLonLat(p[0], p[1], width, height);
      d += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)} `;
    }
    return `${d}Z `;
  }

  function geometryToPath(geometry, width, height) {
    if (!geometry) {
      return "";
    }

    let d = "";
    if (geometry.type === "Polygon") {
      for (const ring of geometry.coordinates) {
        d += ringToPath(ring, width, height);
      }
    } else if (geometry.type === "MultiPolygon") {
      for (const polygon of geometry.coordinates) {
        for (const ring of polygon) {
          d += ringToPath(ring, width, height);
        }
      }
    }
    return d;
  }

  function buildNamesFromGeo() {
    state.namesByCode.clear();
    state.namesByCode.set("WORLD", "World");
    for (const feature of state.geo.features) {
      const code = feature.id || feature.properties?.iso_a3 || feature.properties?.ISO_A3;
      if (!code) {
        continue;
      }
      state.namesByCode.set(code, feature.properties?.name || code);
    }
  }

  function buildCountryList() {
    const codes = Object.keys(state.deaths)
      .filter((c) => c !== "WORLD")
      .sort((a, b) => countryName(a).localeCompare(countryName(b)));

    const fragment = document.createDocumentFragment();
    for (const code of codes) {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${code} - ${countryName(code)}`;
      fragment.appendChild(option);
    }
    el.countrySelect.replaceChildren(fragment);

    if (!state.deaths[state.selectedCode]) {
      state.selectedCode = codes[0];
    }
    el.countrySelect.value = state.selectedCode;
  }

  function filterCountryList(query) {
    const q = query.trim().toLowerCase();
    const options = Array.from(el.countrySelect.options);
    for (const option of options) {
      const show = !q || option.textContent.toLowerCase().includes(q);
      option.hidden = !show;
    }

    const selectedVisible = options.find((o) => o.value === state.selectedCode && !o.hidden);
    if (!selectedVisible) {
      const first = options.find((o) => !o.hidden);
      if (first) {
        first.selected = true;
        state.selectedCode = first.value;
        renderCountryStatic();
        updateMapSelection();
        recalcProjectionTarget(true);
      }
    }
  }

  function getDeaths(code) {
    return state.deaths[code] || 0;
  }

  function getPopulation(code) {
    return state.population[code] || 0;
  }

  function renderWorldStatic() {
    const annual = getDeaths("WORLD");
    el.worldPerYear.textContent = formatInt(annual);
    el.worldPerDay.textContent = formatInt(perDay(annual));
    el.worldPerMinute.textContent = formatInt(perMinute(annual));
  }

  function renderCountryStatic() {
    const code = state.selectedCode;
    const annual = getDeaths(code);

    el.countryTitle.textContent = `${countryName(code)} (${code})`;
    el.countryPerYear.textContent = formatInt(annual);
    el.countryPerDay.textContent = formatInt(perDay(annual));
    el.countryPerMinute.textContent = formatInt(perMinute(annual));
    el.countryProjTitle.textContent = `${countryName(code)} 2030`;
  }

  function buildMapStats() {
    state.mapStatsByCode.clear();

    for (const feature of state.geo.features) {
      const code = feature.id || feature.properties?.iso_a3 || feature.properties?.ISO_A3;
      if (!code) {
        continue;
      }
      const annual = getDeaths(code);
      const population = getPopulation(code);
      const per100k = population > 0 ? (annual / population) * 100000 : NaN;
      state.mapStatsByCode.set(code, {
        code,
        name: feature.properties?.name || countryName(code),
        annual,
        population,
        per100k,
        accumulated: 0,
      });
    }
  }

  function buildMap() {
    const width = 1000;
    const height = 520;

    buildMapStats();

    const values = Array.from(state.mapStatsByCode.values())
      .map((s) => s.per100k)
      .filter((v) => Number.isFinite(v));

    const min = Math.min(...values);
    const max = Math.max(...values);

    el.legendMin.textContent = `${formatRate(min)} / 100k`;
    el.legendMax.textContent = `${formatRate(max)} / 100k`;

    const fragment = document.createDocumentFragment();
    state.mapPathByCode.clear();

    for (const feature of state.geo.features) {
      const code = feature.id || feature.properties?.iso_a3 || feature.properties?.ISO_A3;
      if (!code || !state.deaths[code]) {
        continue;
      }

      const pathData = geometryToPath(feature.geometry, width, height);
      if (!pathData) {
        continue;
      }

      const stats = state.mapStatsByCode.get(code);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("fill-rule", "evenodd");
      path.setAttribute("class", "country-path");
      path.dataset.code = code;
      path.style.fill = colorForValue(stats.per100k, min, max);

      path.addEventListener("mouseenter", () => {
        state.hoveredCode = code;
        el.tooltip.hidden = false;
      });

      path.addEventListener("mouseleave", () => {
        state.hoveredCode = null;
        el.tooltip.hidden = true;
      });

      path.addEventListener("mousemove", (event) => {
        el.tooltip.style.left = `${event.clientX + 16}px`;
        el.tooltip.style.top = `${event.clientY + 16}px`;
      });

      path.addEventListener("click", () => {
        if (!state.deaths[code]) {
          return;
        }
        state.selectedCode = code;
        el.countrySelect.value = code;
        renderCountryStatic();
        updateMapSelection();
        recalcProjectionTarget(true);
      });

      state.mapPathByCode.set(code, path);
      fragment.appendChild(path);
    }

    el.worldMap.replaceChildren(fragment);
    updateMapSelection();
  }

  function updateMapSelection() {
    for (const [code, path] of state.mapPathByCode.entries()) {
      path.classList.toggle("selected", code === state.selectedCode);
    }
  }

  function updateTooltip(elapsedSec) {
    const code = state.hoveredCode;
    if (!code) {
      return;
    }

    const stats = state.mapStatsByCode.get(code);
    if (!stats) {
      return;
    }

    const current = accumulatedDeaths(stats.annual, elapsedSec);
    stats.accumulated = current;

    el.tooltip.innerHTML = [
      `<strong>${stats.name} (${code})</strong>`,
      `2026 annual estimate: ${formatInt(stats.annual)}`,
      `Deaths per 100k: ${formatRate(stats.per100k)}`,
      `Accumulated in 2026: ${formatInt(current)}`,
    ].join("<br>");
  }

  function baseline2030(annual2026) {
    return annual2026 * Math.pow(1 + ANNUAL_GROWTH_RATE, 4);
  }

  function projected2030(base2030, efficiency) {
    return base2030 * (1 - efficiency);
  }

  function recalcProjectionTarget(startAnimation) {
    const efficiency = Number(el.efficiencySlider.value) / 100;
    const worldBase = baseline2030(getDeaths("WORLD"));
    const countryBase = baseline2030(getDeaths(state.selectedCode));

    state.projectionTarget = {
      worldBaseline: worldBase,
      worldProjected: projected2030(worldBase, efficiency),
      countryBaseline: countryBase,
      countryProjected: projected2030(countryBase, efficiency),
    };

    if (startAnimation) {
      state.projectionAnim.from = { ...state.projectionDisplay };
      state.projectionAnim.start = performance.now();
      state.projectionAnim.active = true;
    } else {
      state.projectionDisplay = { ...state.projectionTarget };
    }

    el.efficiencyLabel.textContent = `${efficiency * 100}%`;
  }

  function renderProjection() {
    const d = state.projectionDisplay;

    const worldReduction = d.worldBaseline - d.worldProjected;
    const worldReductionPct = d.worldBaseline > 0 ? (worldReduction / d.worldBaseline) * 100 : 0;

    const countryReduction = d.countryBaseline - d.countryProjected;
    const countryReductionPct = d.countryBaseline > 0 ? (countryReduction / d.countryBaseline) * 100 : 0;

    el.worldBase2030.textContent = formatInt(d.worldBaseline);
    el.worldProj2030.textContent = formatInt(d.worldProjected);
    el.worldDiff2030.textContent = `${formatInt(worldReduction)} (${worldReductionPct.toFixed(1)}%)`;

    el.countryBase2030.textContent = formatInt(d.countryBaseline);
    el.countryProj2030.textContent = formatInt(d.countryProjected);
    el.countryDiff2030.textContent = `${formatInt(countryReduction)} (${countryReductionPct.toFixed(1)}%)`;

    el.worldDiff2030.classList.toggle("negative", worldReduction > 0);
    el.countryDiff2030.classList.toggle("negative", countryReduction > 0);
  }

  function tickProjectionAnimation(now) {
    if (!state.projectionAnim.active || !state.projectionAnim.from) {
      return;
    }

    const elapsed = now - state.projectionAnim.start;
    const t = Math.max(0, Math.min(1, elapsed / state.projectionAnim.durationMs));
    const e = easeOutCubic(t);

    const from = state.projectionAnim.from;
    const to = state.projectionTarget;

    state.projectionDisplay = {
      worldBaseline: lerp(from.worldBaseline, to.worldBaseline, e),
      worldProjected: lerp(from.worldProjected, to.worldProjected, e),
      countryBaseline: lerp(from.countryBaseline, to.countryBaseline, e),
      countryProjected: lerp(from.countryProjected, to.countryProjected, e),
    };

    if (t >= 1) {
      state.projectionAnim.active = false;
      state.projectionDisplay = { ...to };
    }
  }

  function attachEvents() {
    el.countrySearch.addEventListener("input", () => {
      filterCountryList(el.countrySearch.value);
    });

    el.countrySelect.addEventListener("change", (event) => {
      state.selectedCode = event.target.value;
      renderCountryStatic();
      updateMapSelection();
      recalcProjectionTarget(true);
    });

    el.efficiencySlider.addEventListener("input", () => {
      recalcProjectionTarget(true);
    });
  }

  function renderClockInfo() {
    el.clockInfo.textContent = `UTC Base: 2026-01-01 00:00:00 | Seconds in 2026: ${formatInt(SECONDS_IN_YEAR)}`;
    el.growthRateLabel.textContent = `${(ANNUAL_GROWTH_RATE * 100).toFixed(2)}%`;
  }

  function startMainLoop() {
    let prevWorld = -1;
    let prevCountry = -1;

    function frame(now) {
      const elapsedSec = getElapsedSeconds();

      const worldCurrent = accumulatedDeaths(getDeaths("WORLD"), elapsedSec);
      if (worldCurrent !== prevWorld) {
        el.worldCounter.textContent = formatInt(worldCurrent);
        bump(el.worldCounter);
        prevWorld = worldCurrent;
      }

      const countryAnnual = getDeaths(state.selectedCode);
      const countryCurrent = accumulatedDeaths(countryAnnual, elapsedSec);
      if (countryCurrent !== prevCountry) {
        el.countryCounter.textContent = formatInt(countryCurrent);
        bump(el.countryCounter);
        prevCountry = countryCurrent;
      }

      tickProjectionAnimation(now);
      renderProjection();
      updateTooltip(elapsedSec);

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }

  async function loadData() {
    const [deathsRes, popRes, geoRes] = await Promise.all([
      fetch("deaths_annual_2026.json", { cache: "no-store" }),
      fetch("population_2026.json", { cache: "no-store" }),
      fetch("world.geojson", { cache: "no-store" }),
    ]);

    if (!deathsRes.ok || !popRes.ok || !geoRes.ok) {
      throw new Error("Failed to load one or more local data files.");
    }

    const [deaths, population, geo] = await Promise.all([deathsRes.json(), popRes.json(), geoRes.json()]);

    state.deaths = deaths;
    state.population = population;
    state.geo = geo;
  }

  function init() {
    renderClockInfo();
    buildNamesFromGeo();
    buildCountryList();
    renderWorldStatic();
    renderCountryStatic();
    buildMap();
    recalcProjectionTarget(false);
    renderProjection();
    attachEvents();
    startMainLoop();
  }

  loadData()
    .then(init)
    .catch((error) => {
      console.error(error);
      el.clockInfo.textContent = `Data load error: ${error.message}`;
    });
})();
