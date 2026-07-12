const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertPlausibleCounts,
  haversineMiles,
  legacyNurseryResult,
  normalizeScientificName,
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
