/**
 * Serialize / parse browse state into shareable URL query params.
 * Used on `/` and `/plants/:name` so filtered views and detail stay in sync.
 */

const DEFAULT_SORT = "Sort by Recommendation Score";

const SORT_TO_SLUG = {
  [DEFAULT_SORT]: "rec",
  "Sort by Common Name (A-Z)": "name-az",
  "Sort by Common Name (Z-A)": "name-za",
  "Sort by Scientific Name (A-Z)": "sci-az",
  "Sort by Scientific Name (Z-A)": "sci-za",
  "Sort by Height (Tallest First)": "ht-desc",
  "Sort by Height (Shortest First)": "ht-asc",
  "Sort by Spread (Widest First)": "sp-desc",
  "Sort by Spread (Thinnest First)": "sp-asc",
  "Sort by Search Relevance": "relevance",
};

const SLUG_TO_SORT = Object.fromEntries(
  Object.entries(SORT_TO_SLUG).map(([sort, slug]) => [slug, sort])
);

/** @type {Record<string, string>} */
const ARRAY_FILTER_PARAM = {
  "Sun Exposure Flags": "sun",
  "Soil Moisture Flags": "soil",
  "Plant Type Flags": "type",
  "Life Cycle Flags": "life",
  "Pollinator Flags": "poll",
  "Flower Color Flags": "color",
  "Availability Flags": "avail",
  Genus: "genus",
  Family: "family",
  States: "state",
  Superplant: "super",
  Showy: "showy",
};

/** @type {Record<string, string>} */
const RANGE_FILTER_PARAM = {
  "Flowering Months": "bloom",
  "Height (feet)": "height",
  "Spread (feet)": "spread",
};

const PARAM_TO_ARRAY_FILTER = Object.fromEntries(
  Object.entries(ARRAY_FILTER_PARAM).map(([name, param]) => [param, name])
);

const PARAM_TO_RANGE_FILTER = Object.fromEntries(
  Object.entries(RANGE_FILTER_PARAM).map(([name, param]) => [param, name])
);

const FLOWERING_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function splitComma(value) {
  if (!value || !String(value).trim()) return [];
  return String(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseRange(value) {
  const match = String(value || "").match(/^(-?\d+)-(-?\d+)$/);
  if (!match) return null;
  const min = Number.parseInt(match[1], 10);
  const max = Number.parseInt(match[2], 10);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function formatRange(range) {
  if (!range || typeof range.min !== "number" || typeof range.max !== "number") {
    return "";
  }
  return `${range.min}-${range.max}`;
}

function isRangeActive(filter, value) {
  if (!filter || !filter.range || !value) return false;
  if (typeof filter.min !== "number" || typeof filter.max !== "number") {
    return true;
  }
  return value.min !== filter.min || value.max !== filter.max;
}

function isArrayActive(defaultValues, filterName, value) {
  const current = Array.isArray(value) ? value : [];
  const defaults = defaultValues?.[filterName];
  if (!Array.isArray(defaults) || defaults.length === 0) {
    return current.length > 0;
  }
  return JSON.stringify([...current].sort()) !== JSON.stringify([...defaults].sort());
}

/**
 * @param {import('vue-router').LocationQuery} query
 */
export function routeQueryToSearchParams(query) {
  const params = new URLSearchParams();
  if (!query) return params;
  for (const [key, raw] of Object.entries(query)) {
    if (raw == null) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) {
        if (value != null) params.append(key, String(value));
      }
    } else {
      params.set(key, String(raw));
    }
  }
  return params;
}

/**
 * @param {URLSearchParams} searchParams
 */
export function parseBrowseSearchParams(searchParams) {
  /** @type {Record<string, unknown>} */
  const filterValues = {};

  for (const [param, filterName] of Object.entries(PARAM_TO_ARRAY_FILTER)) {
    const values = splitComma(searchParams.get(param));
    if (values.length > 0) {
      filterValues[filterName] = values;
    }
  }

  for (const [param, filterName] of Object.entries(PARAM_TO_RANGE_FILTER)) {
    const range = parseRange(searchParams.get(param));
    if (range) {
      filterValues[filterName] = range;
    }
  }

  const sortSlug = searchParams.get("sort")?.trim() ?? "";
  const sort = SLUG_TO_SORT[sortSlug] || DEFAULT_SORT;
  const q = searchParams.get("q")?.trim() ?? "";
  const zip = searchParams.get("zip")?.trim() ?? "";
  const loc = searchParams.get("loc")?.trim() ?? "";

  return {
    q,
    sort,
    zip,
    loc,
    filterValues,
  };
}

/**
 * @param {{
 *   q?: string
 *   sort?: string
 *   zip?: string
 *   loc?: string
 *   filterValues?: Record<string, unknown>
 * }} snapshot
 * @param {Array<{ name: string, range?: boolean, min?: number, max?: number }>} filters
 * @param {Record<string, unknown>} defaultFilterValues
 */
export function serializeBrowseSearchParams(snapshot, filters, defaultFilterValues) {
  const params = new URLSearchParams();
  const filterValues = snapshot.filterValues || {};
  const filterByName = Object.fromEntries((filters || []).map((f) => [f.name, f]));

  for (const [filterName, param] of Object.entries(ARRAY_FILTER_PARAM)) {
    const value = filterValues[filterName];
    if (!isArrayActive(defaultFilterValues, filterName, value)) continue;
    const values = Array.isArray(value) ? value : [];
    if (values.length > 0) {
      params.set(param, values.join(","));
    }
  }

  for (const [filterName, param] of Object.entries(RANGE_FILTER_PARAM)) {
    const value = filterValues[filterName];
    const filter = filterByName[filterName];
    if (!isRangeActive(filter, value)) continue;
    const encoded = formatRange(value);
    if (encoded) params.set(param, encoded);
  }

  const sort = snapshot.sort || DEFAULT_SORT;
  if (sort !== DEFAULT_SORT && SORT_TO_SLUG[sort]) {
    params.set("sort", SORT_TO_SLUG[sort]);
  }

  const q = (snapshot.q || "").trim();
  if (q) params.set("q", q);

  const zip = (snapshot.zip || "").trim();
  if (zip) params.set("zip", zip);

  const loc = (snapshot.loc || "").trim();
  if (loc) params.set("loc", loc);

  return params.toString();
}

/** @param {string} queryString */
export function queryStringToRouteQuery(queryString) {
  if (!queryString) return {};
  return Object.fromEntries(new URLSearchParams(queryString));
}

function normalizeRouteQuery(query) {
  const params = routeQueryToSearchParams(query);
  return params.toString();
}

/**
 * @param {import('vue-router').LocationQuery} a
 * @param {import('vue-router').LocationQuery} b
 */
export function browseRouteQueriesMatch(a, b) {
  return normalizeRouteQuery(a) === normalizeRouteQuery(b);
}

export function floweringMonthLabel(index) {
  return FLOWERING_MONTHS[index] ?? String(index);
}

export { DEFAULT_SORT, SORT_TO_SLUG, SLUG_TO_SORT, FLOWERING_MONTHS };
