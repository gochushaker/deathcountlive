(function () {
  "use strict";

  const DATA_FILE = "deaths_annual_2026.json";
  const TARGET_YEAR = 2026;
  const yearStartUtc = Date.UTC(TARGET_YEAR, 0, 1, 0, 0, 0);
  const secondsInYear = (Date.UTC(TARGET_YEAR + 1, 0, 1, 0, 0, 0) - yearStartUtc) / 1000;

  const elements = {
    worldCounter: document.getElementById("world-counter"),
    worldRate: document.getElementById("world-rate"),
    worldYear: document.getElementById("world-year"),
    worldDay: document.getElementById("world-day"),
    worldMinute: document.getElementById("world-minute"),
    countrySearch: document.getElementById("country-search"),
    countrySelect: document.getElementById("country-select"),
    countryTitle: document.getElementById("country-title"),
    countryCounter: document.getElementById("country-counter"),
    countryRate: document.getElementById("country-rate"),
    countryYear: document.getElementById("country-year"),
    countryDay: document.getElementById("country-day"),
    countryMinute: document.getElementById("country-minute"),
    dataNote: document.getElementById("data-note"),
  };

  const nf = new Intl.NumberFormat("en-US");

  let model = null;
  let selectedCountryCode = null;

  function formatInt(value) {
    return nf.format(Math.floor(value));
  }

  function calcRatePerSecond(annualDeaths) {
    return annualDeaths / secondsInYear;
  }

  function elapsedSecondsNow() {
    const elapsed = (Date.now() - yearStartUtc) / 1000;
    return Math.max(0, Math.min(secondsInYear, elapsed));
  }

  function computeCount(annualDeaths, elapsedSeconds) {
    const rate = calcRatePerSecond(annualDeaths);
    return Math.floor(rate * elapsedSeconds);
  }

  function perDay(annualDeaths) {
    return annualDeaths / (secondsInYear / 86400);
  }

  function perMinute(annualDeaths) {
    return annualDeaths / (secondsInYear / 60);
  }

  function bumpCounter(el) {
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
  }

  function renderStaticStats(target, annualDeaths, codeLabel) {
    target.year.textContent = formatInt(annualDeaths);
    target.day.textContent = formatInt(perDay(annualDeaths));
    target.minute.textContent = formatInt(perMinute(annualDeaths));
    target.rate.textContent = `${codeLabel} rate: ${calcRatePerSecond(annualDeaths).toFixed(6)} / sec`;
  }

  function findCountry(code) {
    return model.countries.find((country) => country.code === code);
  }

  function renderCountrySelector(countries) {
    const frag = document.createDocumentFragment();
    countries.forEach((country) => {
      const option = document.createElement("option");
      option.value = country.code;
      option.textContent = `${country.code} - ${country.name}`;
      frag.appendChild(option);
    });
    elements.countrySelect.replaceChildren(frag);
  }

  function filterCountries(query) {
    const q = query.trim().toLowerCase();
    const options = Array.from(elements.countrySelect.options);
    options.forEach((option) => {
      const show = !q || option.textContent.toLowerCase().includes(q);
      option.hidden = !show;
    });

    const current = options.find((option) => option.value === selectedCountryCode && !option.hidden);
    if (!current) {
      const firstVisible = options.find((option) => !option.hidden);
      if (firstVisible) {
        firstVisible.selected = true;
        selectedCountryCode = firstVisible.value;
        refreshCountryMeta();
      }
    }
  }

  function refreshCountryMeta() {
    const country = findCountry(selectedCountryCode);
    if (!country) {
      return;
    }

    elements.countryTitle.textContent = `${country.name} (${country.code})`;
    renderStaticStats(
      {
        year: elements.countryYear,
        day: elements.countryDay,
        minute: elements.countryMinute,
        rate: elements.countryRate,
      },
      country.annual_deaths_estimate,
      country.code
    );
  }

  function startAnimation() {
    let lastWorldCount = -1;
    let lastCountryCount = -1;

    function tick() {
      const elapsed = elapsedSecondsNow();

      const worldCount = computeCount(model.world.annual_deaths_estimate, elapsed);
      if (worldCount !== lastWorldCount) {
        elements.worldCounter.textContent = formatInt(worldCount);
        bumpCounter(elements.worldCounter);
        lastWorldCount = worldCount;
      }

      const country = findCountry(selectedCountryCode);
      if (country) {
        const countryCount = computeCount(country.annual_deaths_estimate, elapsed);
        if (countryCount !== lastCountryCount) {
          elements.countryCounter.textContent = formatInt(countryCount);
          bumpCounter(elements.countryCounter);
          lastCountryCount = countryCount;
        }
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  async function loadData() {
    const response = await fetch(DATA_FILE, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load ${DATA_FILE} (${response.status})`);
    }
    return response.json();
  }

  function initEventHandlers() {
    elements.countrySearch.addEventListener("input", () => {
      filterCountries(elements.countrySearch.value);
    });

    elements.countrySelect.addEventListener("change", (event) => {
      selectedCountryCode = event.target.value;
      refreshCountryMeta();
    });
  }

  function initialize(data) {
    model = data;
    renderCountrySelector(model.countries);

    const defaultCountry = model.countries.find((country) => country.code === "USA") || model.countries[0];
    selectedCountryCode = defaultCountry.code;
    elements.countrySelect.value = selectedCountryCode;

    renderStaticStats(
      {
        year: elements.worldYear,
        day: elements.worldDay,
        minute: elements.worldMinute,
        rate: elements.worldRate,
      },
      model.world.annual_deaths_estimate,
      "WORLD"
    );

    refreshCountryMeta();

    elements.dataNote.textContent = [
      `Base timestamp: ${model.base_timestamp_utc}`,
      `Year seconds: ${formatInt(secondsInYear)}`,
      `Countries: ${formatInt(model.countries.length)}`,
    ].join(" | ");

    initEventHandlers();
    startAnimation();
  }

  loadData()
    .then(initialize)
    .catch((error) => {
      console.error(error);
      elements.dataNote.textContent = `Data load error: ${error.message}`;
    });
})();
