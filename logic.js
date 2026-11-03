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

  const api = { itemStatus, reorderQty, isDelayed, stockValue, kpis, filterItems, markForOrder, reorderList, valueByCategory, shipmentState, shipmentsByState, sortShipments, daysBetween };
  if (typeof module !== "undefined") module.exports = api;
  else root.Logic = api;
})(this);
