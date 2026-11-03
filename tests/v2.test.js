// SPEC "גרסה 2" / Done means. One test (or more) per line.
const test = require("node:test");
const assert = require("node:assert");
const L = require("../logic.js");
const { createData } = require("../data.js");

const TODAY = "2026-11-03";
const item = (o) => Object.assign({ sku: "X-1", name: "פריט", category: "מסבים", warehouse: "חיפה", supplier: "ספק", onHand: 50, reorderPoint: 20, maxStock: 100, moq: 25, unitPrice: 2, dailyUsage: 4 }, o);

test("days of cover: on hand / daily usage, rounded down; out = 0", () => {
  assert.strictEqual(L.daysOfCover(item({ onHand: 50, dailyUsage: 4 })), 12);
  assert.strictEqual(L.daysOfCover(item({ onHand: 0 })), 0);
});

test("stock-out date: today + days of cover; out of stock has no date", () => {
  assert.strictEqual(L.stockoutDate(item({ onHand: 50, dailyUsage: 4 }), TODAY), "2026-11-15");
  assert.strictEqual(L.stockoutDate(item({ onHand: 0 }), TODAY), null);
});

test("ABC: A up to 70% of yearly usage value, B up to 90%, C the rest", () => {
  const items = [
    item({ sku: "A1", dailyUsage: 7, unitPrice: 10 }),  // 70
    item({ sku: "B1", dailyUsage: 2, unitPrice: 10 }),  // 20
    item({ sku: "C1", dailyUsage: 1, unitPrice: 10 }),  // 10
  ];
  assert.deepStrictEqual(L.abcClasses(items), { A1: "A", B1: "B", C1: "C" });
});

test("change vs 7 days ago, in percent", () => {
  assert.strictEqual(L.pctChange([100, 0, 0, 0, 0, 0, 0, 110], 7), 10);
  assert.strictEqual(L.pctChange([200, 0, 0, 0, 0, 0, 0, 150], 7), -25);
});

test("warehouse utilization = occupied / capacity; above 85% is nearly full", () => {
  const d = createData(42, TODAY);
  L.warehouseSummary(d).forEach((w) => {
    assert.strictEqual(w.utilization, Math.round((w.occupied / w.capacity) * 100));
    assert.strictEqual(w.nearlyFull, w.utilization > 85);
  });
});

test("supplier on-time rate and average lead time", () => {
  const d = {
    suppliers: [{ name: "S", city: "חיפה", leadTime: 5 }],
    supplyHistory: [
      { supplier: "S", ordered: "2026-10-01", promised: "2026-10-06", delivered: "2026-10-06" },
      { supplier: "S", ordered: "2026-10-10", promised: "2026-10-15", delivered: "2026-10-18" },
    ],
    items: [], shipments: [],
  };
  const [s] = L.supplierStats(d);
  assert.strictEqual(s.onTimeRate, 50);
  assert.strictEqual(s.avgLead, 6.5);
});

test("basket: an item added twice appears once; totals per supplier", () => {
  const items = [item({ sku: "P1", supplier: "S1", onHand: 15 }), item({ sku: "P2", supplier: "S1", onHand: 0 }), item({ sku: "P3", supplier: "S2", onHand: 10, moq: 10 })];
  const b = L.basket(items, ["P1", "P2", "P1", "P3"]);
  assert.strictEqual(b.count, 3);
  const s1 = b.groups.find((g) => g.supplier === "S1");
  assert.strictEqual(s1.total, s1.lines.reduce((s, l) => s + l.cost, 0));
  assert.strictEqual(b.total, b.groups.reduce((s, g) => s + g.total, 0));
});

test("CSV: header row + one row per item, with BOM for Hebrew in Excel", () => {
  const items = [item({ sku: "P1", supplier: "S1", onHand: 15, name: 'בורג "מיוחד"' })];
  const csv = L.basketCsv(L.basket(items, ["P1"]));
  assert.ok(csv.startsWith("﻿"));
  const lines = csv.slice(1).split("\r\n");
  assert.strictEqual(lines.length, 2);
  assert.ok(lines[0].includes("מק״ט") && lines[1].includes('"בורג ""מיוחד"""'));
});

test("sort by any column, both directions", () => {
  const items = [item({ sku: "B", onHand: 5 }), item({ sku: "A", onHand: 9 }), item({ sku: "C", onHand: 1 })];
  assert.deepStrictEqual(L.sortItems(items, "onHand", "asc").map((i) => i.sku), ["C", "B", "A"]);
  assert.deepStrictEqual(L.sortItems(items, "sku", "desc").map((i) => i.sku), ["C", "B", "A"]);
});

test("mock data v2: history of 31 days ending at today's stock; v1 fields unchanged", () => {
  const d = createData(42, TODAY);
  d.items.forEach((i) => {
    assert.strictEqual(i.history.length, 31);
    assert.strictEqual(i.history[30], i.onHand);
    assert.ok(i.history.every((v) => v >= 0));
  });
  assert.strictEqual(L.kpiSeries(d).stockValue[30], L.kpis(d.items, d.shipments, TODAY).stockValue);
  assert.strictEqual(L.kpiSeries(d).delayed[30], L.kpis(d.items, d.shipments, TODAY).delayedCount);
});

test("event log is derived from the data and sorted newest first", () => {
  const d = createData(42, TODAY);
  const ev = L.events(d, TODAY);
  assert.ok(ev.length > 0);
  assert.ok(ev.every((e, k) => k === 0 || ev[k - 1].date >= e.date));
  assert.ok(ev.some((e) => e.kind === "delayed"));
});
