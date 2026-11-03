// Pure dashboard logic. Every rule here comes from "Done means" in SPEC.md.
(function (root) {
  function itemStatus(item) {
    if (item.onHand === 0) return "out";
    if (item.onHand <= item.reorderPoint) return "low";
    return "ok";
  }

  function reorderQty(item) {
    if (itemStatus(item) === "ok") return 0;
    const gap = item.maxStock - item.onHand;
    return Math.ceil(gap / item.moq) * item.moq;
  }

  function isDelayed(shipment, today) {
    return shipment.status !== "delivered" && shipment.eta < today;
  }

  function stockValue(items) {
    return items.reduce((sum, i) => sum + i.onHand * i.unitPrice, 0);
  }

  function kpis(items, shipments, today) {
    return {
      skuCount: items.length,
      stockValue: Math.round(stockValue(items)),
      lowCount: items.filter((i) => itemStatus(i) !== "ok").length,
      delayedCount: shipments.filter((s) => isDelayed(s, today)).length,
    };
  }

  // Filters stack (AND); an empty filter does not filter.
  function filterItems(items, f) {
    const q = (f.query || "").trim().toLowerCase();
    return items.filter((i) =>
      (!f.warehouse || i.warehouse === f.warehouse) &&
      (!f.category || i.category === f.category) &&
      (!f.status || itemStatus(i) === f.status) &&
      (!q || i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)));
  }

  // Marking twice does not add the item twice.
  function markForOrder(marked, sku) {
    return marked.includes(sku) ? marked : marked.concat(sku);
  }

  // Items to reorder: out of stock first, then the lowest stock relative to the reorder point.
  function reorderList(items) {
    return items.filter((i) => itemStatus(i) !== "ok")
      .map((i) => ({ item: i, qty: reorderQty(i), cost: Math.round(reorderQty(i) * i.unitPrice) }))
      .sort((a, b) => a.item.onHand / a.item.reorderPoint - b.item.onHand / b.item.reorderPoint);
  }

  function valueByCategory(items) {
    const m = new Map();
    items.forEach((i) => m.set(i.category, (m.get(i.category) || 0) + i.onHand * i.unitPrice));
    return [...m].map(([category, value]) => ({ category, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }

  function shipmentState(s, today) {
    return isDelayed(s, today) ? "delayed" : s.status;
  }

  function daysBetween(fromIso, toIso) {
    return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);
  }

  // Delayed first, then open shipments by ETA, delivered last (newest first).
  function sortShipments(shipments, today) {
    const rank = { delayed: 0, in_transit: 1, preparing: 2, delivered: 3 };
    return shipments.slice().sort((a, b) => {
      const ra = rank[shipmentState(a, today)], rb = rank[shipmentState(b, today)];
      if (ra !== rb) return ra - rb;
      return ra === 3 ? (a.eta < b.eta ? 1 : -1) : (a.eta < b.eta ? -1 : a.eta > b.eta ? 1 : 0);
    });
  }

  function shipmentsByState(shipments, today) {
    const order = ["preparing", "in_transit", "delayed", "delivered"];
    const counts = Object.fromEntries(order.map((k) => [k, 0]));
    shipments.forEach((s) => counts[shipmentState(s, today)]++);
    return order.map((state) => ({ state, count: counts[state] }));
  }

  // ---------------- v2 (SPEC "גרסה 2") ----------------
  function addDays(iso, n) {
    const d = new Date(iso + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function daysOfCover(item) {
    if (item.onHand === 0) return 0;
    return Math.floor(item.onHand / item.dailyUsage);
  }

  function stockoutDate(item, today) {
    return item.onHand === 0 ? null : addDays(today, daysOfCover(item));
  }

  // A = up to 70% of yearly usage value, B = up to 90%, C = the rest.
  function abcClasses(items) {
    const rows = items.map((i) => ({ sku: i.sku, v: i.dailyUsage * 365 * i.unitPrice })).sort((a, b) => b.v - a.v);
    const total = rows.reduce((s, r) => s + r.v, 0) || 1;
    const out = {};
    let run = 0;
    rows.forEach((r) => {
      const before = run / total;
      run += r.v;
      out[r.sku] = before < 0.7 ? "A" : before < 0.9 ? "B" : "C";
    });
    return out;
  }

  function pctChange(series, back) {
    const now = series[series.length - 1], then = series[series.length - 1 - back];
    if (!then) return now ? 100 : 0;
    return Math.round(((now - then) / then) * 1000) / 10;
  }

  // Delayed on a given day: ETA before that day and not yet delivered on that day.
  function delayedOn(shipments, day) {
    return shipments.filter((s) => s.eta < day && (s.status !== "delivered" || (s.deliveredOn && s.deliveredOn > day))).length;
  }

  function kpiSeries(data) {
    const days = data.items[0].history.length;
    const stockValue = [], lowCount = [], delayed = [];
    for (let k = 0; k < days; k++) {
      const day = addDays(data.today, k - (days - 1));
      stockValue.push(Math.round(data.items.reduce((s, i) => s + i.history[k] * i.unitPrice, 0)));
      lowCount.push(data.items.filter((i) => i.history[k] <= i.reorderPoint).length);
      delayed.push(delayedOn(data.shipments, day));
    }
    return { stockValue, lowCount, delayed };
  }

  // Units moved per day over the last n days: in = receipts, out = usage.
  function flows(items, n) {
    const days = items[0].history.length;
    const res = [];
    for (let k = days - n; k < days; k++) {
      let inn = 0, out = 0;
      items.forEach((i) => {
        const diff = i.history[k] - i.history[k - 1];
        if (diff > 0) inn += diff; else out -= diff;
      });
      res.push({ k, in: inn, out });
    }
    return res;
  }

  function warehouseSummary(data) {
    return data.warehouseInfo.map((w) => {
      const items = data.items.filter((i) => i.warehouse === w.name);
      const utilization = Math.round((w.occupied / w.capacity) * 100);
      return {
        name: w.name, capacity: w.capacity, occupied: w.occupied, utilization,
        nearlyFull: utilization > 85,
        value: Math.round(stockValue(items)),
        attention: items.filter((i) => itemStatus(i) !== "ok").length,
        skuCount: items.length,
      };
    });
  }

  function supplierStats(data) {
    return data.suppliers.map((sp) => {
      const hist = data.supplyHistory.filter((h) => h.supplier === sp.name);
      const onTime = hist.filter((h) => h.delivered <= h.promised).length;
      const lead = hist.reduce((s, h) => s + (Date.parse(h.delivered) - Date.parse(h.ordered)) / 86400000, 0);
      const items = data.items.filter((i) => i.supplier === sp.name);
      return {
        name: sp.name, city: sp.city,
        orders: hist.length,
        onTimeRate: hist.length ? Math.round((onTime / hist.length) * 100) : 0,
        avgLead: hist.length ? Math.round((lead / hist.length) * 10) / 10 : 0,
        openShipments: data.shipments.filter((s) => s.party === sp.name && s.status !== "delivered").length,
        itemsValue: Math.round(stockValue(items)),
        itemCount: items.length,
      };
    }).sort((a, b) => a.onTimeRate - b.onTimeRate);
  }

  function basket(items, marked) {
    const groups = new Map();
    [...new Set(marked)].forEach((sku) => {
      const item = items.find((i) => i.sku === sku);
      if (!item) return;
      const qty = reorderQty(item) || item.moq;
      const line = { item, qty, cost: Math.round(qty * item.unitPrice) };
      if (!groups.has(item.supplier)) groups.set(item.supplier, []);
      groups.get(item.supplier).push(line);
    });
    const list = [...groups].map(([supplier, lines]) => ({ supplier, lines, total: lines.reduce((s, l) => s + l.cost, 0) }));
    return { groups: list, total: list.reduce((s, g) => s + g.total, 0), count: list.reduce((s, g) => s + g.lines.length, 0) };
  }

  // BOM so Excel opens Hebrew correctly.
  function basketCsv(b) {
    const q = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const rows = [["מק״ט", "פריט", "ספק", "כמות", "עלות ₪"]];
    b.groups.forEach((g) => g.lines.forEach((l) => rows.push([l.item.sku, l.item.name, g.supplier, l.qty, l.cost])));
    return "﻿" + rows.map((r) => r.map(q).join(",")).join("\r\n");
  }

  function sortItems(items, key, dir, ctx) {
    const val = {
      sku: (i) => i.sku, name: (i) => i.name, warehouse: (i) => i.warehouse, onHand: (i) => i.onHand,
      value: (i) => i.onHand * i.unitPrice, cover: (i) => daysOfCover(i),
      status: (i) => ({ out: 0, low: 1, ok: 2 })[itemStatus(i)], abc: (i) => (ctx && ctx.abc ? ctx.abc[i.sku] : ""),
    }[key] || ((i) => i.sku);
    const sign = dir === "desc" ? -1 : 1;
    return items.slice().sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sign;
    });
  }

  function events(data, today) {
    const ev = [];
    data.shipments.forEach((s) => {
      if (isDelayed(s, today)) ev.push({ kind: "delayed", date: s.eta, text: s.id + " מתעכב, היה אמור להגיע מ" + s.from + " אל " + s.to, ref: s.id });
      else if (s.status === "delivered") ev.push({ kind: "delivered", date: s.deliveredOn || s.eta, text: s.id + " נמסר ב" + s.to, ref: s.id });
      else if (s.status === "in_transit") ev.push({ kind: "in_transit", date: addDays(s.eta, -1), text: s.id + " יצא מ" + s.from + " אל " + s.to, ref: s.id });
    });
    data.items.forEach((i) => {
      if (i.onHand !== 0) return;
      const k = i.history.findIndex((v) => v === 0);
      ev.push({ kind: "out", date: addDays(today, k - (i.history.length - 1)), text: i.name + " אזל במחסן " + i.warehouse, ref: i.sku });
    });
    return ev.filter((e) => e.date <= today).sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  const api = { daysOfCover, stockoutDate, abcClasses, pctChange, delayedOn, kpiSeries, flows, warehouseSummary, supplierStats, basket, basketCsv, sortItems, events, addDays, itemStatus, reorderQty, isDelayed, stockValue, kpis, filterItems, markForOrder, reorderList, valueByCategory, shipmentState, shipmentsByState, sortShipments, daysBetween };
  if (typeof module !== "undefined") module.exports = api;
  else root.Logic = api;
})(this);
