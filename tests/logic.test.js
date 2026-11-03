// Each test maps to a "Done means" line in SPEC.md.
const test = require("node:test");
const assert = require("node:assert");
const L = require("../logic.js");
const { createData } = require("../data.js");

const item = (o) => Object.assign({ sku: "X-1", name: "פריט", category: "מסבים", warehouse: "חיפה", onHand: 50, reorderPoint: 20, maxStock: 100, moq: 25, unitPrice: 2 }, o);
const TODAY = "2026-11-03";

test("status: 0 = out, at or below reorder point = low, else ok", () => {
  assert.strictEqual(L.itemStatus(item({ onHand: 0 })), "out");
  assert.strictEqual(L.itemStatus(item({ onHand: 20 })), "low");
  assert.strictEqual(L.itemStatus(item({ onHand: 21 })), "ok");
});

test("reorder qty: (max - on hand) rounded up to MOQ, 0 when ok", () => {
  assert.strictEqual(L.reorderQty(item({ onHand: 15 })), 100);   // gap 85 -> 100
  assert.strictEqual(L.reorderQty(item({ onHand: 0 })), 100);    // gap 100 -> 100
  assert.strictEqual(L.reorderQty(item({ onHand: 5, moq: 10 })), 100); // gap 95 -> 100
  assert.strictEqual(L.reorderQty(item({ onHand: 60 })), 0);
});

test("delayed: not delivered and ETA before today", () => {
  assert.strictEqual(L.isDelayed({ status: "in_transit", eta: "2026-11-02" }, TODAY), true);
  assert.strictEqual(L.isDelayed({ status: "delivered", eta: "2026-11-01" }, TODAY), false);
  assert.strictEqual(L.isDelayed({ status: "preparing", eta: TODAY }, TODAY), false);
});

test("kpis match a manual calculation", () => {
  const items = [item({ onHand: 10, unitPrice: 3 }), item({ onHand: 0 }), item({ onHand: 50, unitPrice: 1.5 })];
  const ships = [{ status: "in_transit", eta: "2026-10-30" }, { status: "delivered", eta: "2026-10-30" }];
  assert.deepStrictEqual(L.kpis(items, ships, TODAY), { skuCount: 3, stockValue: 105, lowCount: 2, delayedCount: 1 });
});

test("filters stack (AND) and an empty filter does not filter", () => {
  const items = [item({ sku: "A-1", warehouse: "חיפה", onHand: 0 }), item({ sku: "A-2", warehouse: "חיפה" }), item({ sku: "A-3", warehouse: "עפולה", onHand: 0 })];
  assert.strictEqual(L.filterItems(items, {}).length, 3);
  assert.deepStrictEqual(L.filterItems(items, { warehouse: "חיפה", status: "out" }).map((i) => i.sku), ["A-1"]);
  assert.deepStrictEqual(L.filterItems(items, { query: "a-3" }).map((i) => i.sku), ["A-3"]);
});

test("marking for order twice adds the item once", () => {
  const once = L.markForOrder([], "A-1");
  assert.deepStrictEqual(L.markForOrder(once, "A-1"), ["A-1"]);
});

test("reorder list: only low/out items, out of stock first, with qty and cost", () => {
  const items = [item({ sku: "OK", onHand: 80 }), item({ sku: "LOW", onHand: 15 }), item({ sku: "OUT", onHand: 0 })];
  const list = L.reorderList(items);
  assert.deepStrictEqual(list.map((r) => r.item.sku), ["OUT", "LOW"]);
  assert.deepStrictEqual([list[0].qty, list[0].cost], [100, 200]);
});

test("shipments: delayed first, delivered last", () => {
  const ships = [
    { id: "D", status: "delivered", eta: "2026-11-01" },
    { id: "T", status: "in_transit", eta: "2026-11-05" },
    { id: "L", status: "in_transit", eta: "2026-11-01" },
    { id: "P", status: "preparing", eta: "2026-11-04" },
  ];
  assert.deepStrictEqual(L.sortShipments(ships, TODAY).map((s) => s.id), ["L", "T", "P", "D"]);
  assert.strictEqual(L.daysBetween("2026-11-01", TODAY), 2);
});

test("mock data: same seed gives the same data", () => {
  assert.deepStrictEqual(createData(42, TODAY), createData(42, TODAY));
  const d = createData(42, TODAY);
  assert.ok(d.items.length >= 30 && d.shipments.length === 18);
  assert.ok(d.items.some((i) => L.itemStatus(i) === "out"), "has out-of-stock items");
  assert.ok(d.shipments.some((s) => L.isDelayed(s, TODAY)), "has delayed shipments");
});
