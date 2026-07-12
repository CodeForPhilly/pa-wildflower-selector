const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertPlausibleCounts,
  haversineMiles,
  legacyNurseryResult,
  normalizeScientificName,
  onlineVendorResult,
  vendorStoreResult,
  validCoordinates,
} = require("../lib/plantagents-data");

test("normalizes scientific names without changing their words", () => {
  assert.equal(normalizeScientificName("  Acer   rubrum  "), "acer rubrum");
  assert.equal(normalizeScientificName(null), "");
});

test("validates coordinate boundaries including zero", () => {
  assert.equal(validCoordinates(0, 0), true);
  assert.equal(validCoordinates(91, 0), false);
  assert.equal(validCoordinates(0, -181), false);
  assert.equal(validCoordinates(null, null), false);
});

test("calculates distance in miles", () => {
  const philadelphiaToNewYork = haversineMiles(39.9526, -75.1652, 40.7128, -74.006);
  assert.ok(philadelphiaToNewYork > 75 && philadelphiaToNewYork < 85);
});

test("rejects empty and unexpectedly reduced source counts", () => {
  const healthy = { vendors: 100, sourcePlants: 1000, sourceOfferings: 5000, zipCodes: 30000 };
  assert.throws(() => assertPlausibleCounts({ ...healthy, vendors: 0 }), /invalid vendors count/);
  assert.throws(() => assertPlausibleCounts({ ...healthy, vendors: 79 }, healthy), /dropped/);
  assert.doesNotThrow(() => assertPlausibleCounts({ ...healthy, vendors: 79 }, healthy, { force: true }));
});

test("adapts a synced vendor to the existing nursery map response", () => {
  assert.deepEqual(legacyNurseryResult({
    name: "Native Nursery", latitude: 40, longitude: -75, phone: "555",
    websiteUrl: "https://example.com", displayAddress: "1 Main St",
    stateOrRegion: "PA", email: "plants@example.com",
  }), {
    SOURCE: "Native Nursery", Lat: 40, Long: -75, lon: -75, lat: 40,
    PHONE: "555", URL: "https://example.com", ADDRESS: "1 Main St",
    STATE: "PA", EMAIL: "plants@example.com",
  });
});

test("online vendors prefer a plant-specific URL and fall back to the vendor site", () => {
  const vendor = { name: "Prairie Moon", websiteUrl: "https://example.com" };
  assert.deepEqual(onlineVendorResult(vendor, {
    productUrl: "https://example.com/plants/acorus-americanus",
    productUrlType: "plant_profile",
  }, "Acorus americanus"), {
    storeName: "Prairie Moon",
    storeUrl: "https://example.com/plants/acorus-americanus",
    productUrlType: "plant_profile",
    isDirectPlantLink: true,
    linkDestination: "plant_page",
  });
  assert.equal(onlineVendorResult(vendor, null, "Acorus americanus").storeUrl, "https://example.com");
  assert.equal(onlineVendorResult(vendor, null, "Acorus americanus").isDirectPlantLink, false);
});

test("physical vendors also prefer direct plant pages and identify root-site fallbacks", () => {
  const vendor = { name: "Local Nursery", websiteUrl: "https://example.com" };
  assert.deepEqual(vendorStoreResult(vendor, {
    productUrl: "https://example.com/native-plants/asclepias-tuberosa",
    productUrlType: "product_page",
  }, { plantName: "Asclepias tuberosa" }), {
    storeName: "Local Nursery",
    storeUrl: "https://example.com/native-plants/asclepias-tuberosa",
    productUrlType: "product_page",
    isDirectPlantLink: true,
    linkDestination: "plant_page",
  });
  assert.equal(vendorStoreResult(vendor, { productUrl: null }).linkDestination, "vendor_website");
  assert.equal(vendorStoreResult(vendor, {
    productUrl: "https://example.com/native-plants/asclepias-tuberosa",
    productUrlType: "plant_profile",
  }, { plantName: "Asclepias tuberosa" }).isDirectPlantLink, true);
  assert.equal(vendorStoreResult(vendor, {
    productUrl: "https://example.com/perennial-power/",
    productUrlType: "plant_profile",
  }, { plantName: "Asclepias tuberosa" }).isDirectPlantLink, false);
  assert.equal(vendorStoreResult(vendor, {
    productUrl: "https://example.com/plant-catalog/blue-wildrye/",
    productUrlType: "plant_profile",
  }, { plantName: "Elymus glaucus" }).isDirectPlantLink, true);
  assert.equal(vendorStoreResult(vendor, {
    productUrl: "https://example.com/Plant-Category/Natives",
    productUrlType: "plant_profile",
  }, { plantName: "Elymus glaucus" }).isDirectPlantLink, false);
});
