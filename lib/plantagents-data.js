const ACTIVE_SYNC_ID = "plantagents-active";

function normalizeScientificName(value) {
  return String(value || "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function toFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function validCoordinates(latitude, longitude) {
  const lat = toFiniteNumber(latitude);
  const lon = toFiniteNumber(longitude);
  return lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}

function haversineMiles(latitudeA, longitudeA, latitudeB, longitudeB) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.7613;
  const latA = toRadians(Number(latitudeA));
  const latB = toRadians(Number(latitudeB));
  const deltaLat = toRadians(Number(latitudeB) - Number(latitudeA));
  const deltaLon = toRadians(Number(longitudeB) - Number(longitudeA));
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(latA) * Math.cos(latB) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function assertPlausibleCounts(current, previous, options = {}) {
  const force = Boolean(options.force);
  const maxDropRatio = Number.isFinite(options.maxDropRatio) ? options.maxDropRatio : 0.2;
  const required = ["vendors", "sourcePlants", "sourceOfferings", "zipCodes"];
  for (const key of required) {
    if (!Number.isInteger(current[key]) || current[key] <= 0) {
      throw new Error(`PlantAgents source returned an invalid ${key} count: ${current[key]}`);
    }
  }
  if (force || !previous) return;
  for (const key of required) {
    const oldCount = Number(previous[key]);
    if (!Number.isFinite(oldCount) || oldCount <= 0) continue;
    const minimum = oldCount * (1 - maxDropRatio);
    if (current[key] < minimum) {
      throw new Error(`${key} dropped from ${oldCount} to ${current[key]} (more than ${maxDropRatio * 100}%)`);
    }
  }
}

function legacyNurseryResult(vendor) {
  return {
    SOURCE: vendor.name,
    Lat: vendor.latitude,
    Long: vendor.longitude,
    lon: vendor.longitude,
    lat: vendor.latitude,
    PHONE: vendor.phone || null,
    URL: vendor.websiteUrl || null,
    ADDRESS: vendor.displayAddress || null,
    STATE: vendor.stateOrRegion || null,
    EMAIL: vendor.email || null,
  };
}

function plantProfileUrlMatches(productUrl, plantName) {
  if (!productUrl || !plantName) return false;
  try {
    const haystack = decodeURIComponent(new URL(productUrl).pathname).toLowerCase();
    const words = normalizeScientificName(plantName).split(" ").filter((word) => word.length > 2);
    const mentionsScientificName = words.length >= 2 && words.every((word) => haystack.includes(word));
    const segments = haystack.split("/").filter(Boolean);
    const genericLastSegments = new Set([
      "catalog", "categories", "category", "custom-growing", "inventory", "natives",
      "native-plants", "perennial-power", "plants", "shop", "store",
    ]);
    const specificCatalogProfile = segments.length >= 2
      && !genericLastSegments.has(segments[segments.length - 1]);
    return mentionsScientificName
      || /\/(product|products|item|shop)\//.test(haystack)
      || specificCatalogProfile;
  } catch {
    return false;
  }
}

function vendorStoreResult(vendor, offering, options = {}) {
  const trustedPlantProfile = plantProfileUrlMatches(offering?.productUrl, options.plantName);
  const isDirectPlantLink = Boolean(
    offering?.productUrl
      && (offering.productUrlType === "product_page"
        || (offering.productUrlType === "plant_profile" && trustedPlantProfile))
  );
  return {
    storeName: vendor.name,
    storeUrl: (isDirectPlantLink ? offering.productUrl : vendor.websiteUrl) || null,
    productUrlType: offering?.productUrlType || "vendor_root",
    isDirectPlantLink,
    linkDestination: isDirectPlantLink ? "plant_page" : "vendor_website",
  };
}

function onlineVendorResult(vendor, offering, plantName) {
  return vendorStoreResult(vendor, offering, { plantName });
}

module.exports = {
  ACTIVE_SYNC_ID,
  assertPlausibleCounts,
  haversineMiles,
  legacyNurseryResult,
  onlineVendorResult,
  normalizeScientificName,
  toFiniteNumber,
  validCoordinates,
  vendorStoreResult,
};
