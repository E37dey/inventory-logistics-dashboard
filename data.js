// Mock data: deterministic for a given seed (SPEC: "same seed -> same data").
(function (root) {
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const WAREHOUSES = ["חיפה", "אשדוד", "עפולה"];
  const CATALOG = [
    ["ברגים ואומים", "BR", 0.4, [["בורג M8×30 נירוסטה", 1.2], ["בורג M6×20 מגולוון", 0.6], ["אום M10 נירוסטה", 0.9], ["דיסקית קפיצית M6", 0.2], ["בורג אלן M5×16", 0.7], ["עוגן כימי M12", 6.5], ["אום נעילה M8", 0.5], ["בורג פח 4.2×19", 0.15]]],
    ["מסבים", "MS", 1, [["מסב 6204-2RS", 18], ["מסב 6305-ZZ", 26], ["מסב לינארי LM12UU", 22], ["מסב מתכוונן UCP205", 64], ["מסב מחט HK1612", 9]]],
    ["צנרת ואביזרים", "TZ", 1, [["צינור PVC 32 מ״מ (מטר)", 7.5], ["מחבר T פליז ½״", 14], ["ברז כדורי 1״", 48], ["אטם O-ring 20×2", 0.8], ["צינור לחץ 10 מ״מ (מטר)", 11], ["מצמד מהיר ¼״", 19]]],
    ["חשמל ובקרה", "HS", 1, [["ממסר 24V DC", 32], ["מפסק גבול", 41], ["חיישן קרבה M18", 95], ["כבל 3×1.5 (מטר)", 6], ["ספק כוח 24V 5A", 180], ["לחצן חירום", 58], ["מגען 9A", 120]]],
    ["אריזה", "AR", 1, [["קרטון 40×30×30", 3.2], ["סרט אריזה 48 מ״מ", 4.5], ["ניילון נצמד 50 ס״מ", 39], ["משטח עץ 120×80", 55], ["פצפצים (גליל)", 85]]],
  ];
  const SUPPLIERS = ["מתכות הצפון", "יבוא תעשייתי בע״מ", "אלקטרו-פרו", "פלסט-אור", "אריזות המרכז"];
  const CUSTOMERS = ["מפעל גליל מכונות", "אגרו-טק עמק", "מתקני מים בע״מ", "רובוטיקה דרום", "ש.א. הנדסה"];

  function addDays(isoDate, days) {
    const d = new Date(isoDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function createData(seed, today) {
    const r = rng(seed);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const items = [];
    let n = 1000;
    CATALOG.forEach(([category, prefix, , products], ci) => {
      products.forEach(([name, price], pi) => {
        n += 1;
        const reorderPoint = 20 + Math.floor(r() * 80);
        const maxStock = reorderPoint * 4 + Math.floor(r() * 60);
        const roll = r();
        // ~12% out of stock, ~25% low, rest healthy
        const onHand = roll < 0.12 ? 0 : roll < 0.37 ? Math.floor(r() * reorderPoint) + 1 : reorderPoint + 1 + Math.floor(r() * (maxStock - reorderPoint));
        items.push({
          sku: prefix + "-" + n,
          name,
          category,
          warehouse: WAREHOUSES[(ci + pi) % WAREHOUSES.length],
          onHand,
          reorderPoint,
          maxStock,
          moq: [10, 20, 25, 50][Math.floor(r() * 4)],
          unitPrice: price,
          supplier: SUPPLIERS[ci % SUPPLIERS.length],
        });
      });
    });
    const shipments = [];
    for (let i = 0; i < 18; i++) {
      const inbound = r() < 0.5;
      const sRoll = r();
      const status = sRoll < 0.3 ? "delivered" : sRoll < 0.75 ? "in_transit" : "preparing";
      // delivered ones are in the past; open ones spread around today so some are late
      const offset = status === "delivered" ? -1 - Math.floor(r() * 10) : Math.floor(r() * 12) - 4;
      shipments.push({
        id: "SH-" + (24001 + i),
        direction: inbound ? "inbound" : "outbound",
        party: inbound ? pick(SUPPLIERS) : pick(CUSTOMERS),
        warehouse: pick(WAREHOUSES),
        lines: 1 + Math.floor(r() * 9),
        status,
        eta: addDays(today, offset),
      });
    }
    const base = { items, shipments, warehouses: WAREHOUSES.slice(), categories: CATALOG.map((c) => c[0]) };
    return extendV2(base, seed, today);
  }

  // ---- v2 (SPEC "גרסה 2"): extra fields from a second generator, so v1 values stay identical ----
  const CITY = {
    "חיפה": [32.794, 34.989], "אשדוד": [31.804, 34.655], "עפולה": [32.607, 35.289],
    "נתניה": [32.321, 34.853], "רמלה": [31.929, 34.866], "באר שבע": [31.252, 34.791],
    "כרמיאל": [32.919, 35.304], "יקנעם": [32.659, 35.105], "קריית גת": [31.61, 34.764],
    "פתח תקווה": [32.087, 34.887],
  };
  const SUPPLIER_INFO = {
    "מתכות הצפון": { city: "כרמיאל", leadTime: 5 }, "יבוא תעשייתי בע״מ": { city: "אשדוד", leadTime: 12 },
    "אלקטרו-פרו": { city: "פתח תקווה", leadTime: 7 }, "פלסט-אור": { city: "נתניה", leadTime: 4 },
    "אריזות המרכז": { city: "רמלה", leadTime: 3 },
  };
  const CUSTOMER_CITY = { "מפעל גליל מכונות": "כרמיאל", "אגרו-טק עמק": "יקנעם", "מתקני מים בע״מ": "רמלה", "רובוטיקה דרום": "באר שבע", "ש.א. הנדסה": "קריית גת" };
  const USAGE = { "ברגים ואומים": [3, 12], "מסבים": [1, 4], "צנרת ואביזרים": [1, 6], "חשמל ובקרה": [0.5, 3], "אריזה": [2, 9] };
  const AISLE = { "ברגים ואומים": "A", "מסבים": "B", "צנרת ואביזרים": "C", "חשמל ובקרה": "D", "אריזה": "E" };
  const CAPACITY = { "חיפה": 420, "אשדוד": 560, "עפולה": 300 };

  function extendV2(d, seed, today) {
    const r = rng(seed ^ 0x9e3779b9);
    d.items.forEach((it, k) => {
      const [lo, hi] = USAGE[it.category];
      it.dailyUsage = Math.round((lo + r() * (hi - lo)) * 10) / 10;
      it.bin = AISLE[it.category] + "-" + String(1 + (k % 12)).padStart(2, "0") + "-" + (1 + Math.floor(r() * 4));
      it.leadTime = SUPPLIER_INFO[it.supplier].leadTime;
      // 30 days back from today: each day stock = next day + that day's usage, minus a receipt when it overflows max
      const hist = [it.onHand];
      let cur = it.onHand;
      for (let day = 1; day <= 30; day++) {
        const used = Math.max(0, Math.round(it.dailyUsage * (0.6 + r() * 0.8)));
        let prev = cur + used;
        while (prev > it.maxStock) prev -= it.moq * 2;
        cur = Math.max(0, prev);
        hist.push(cur);
      }
      it.history = hist.reverse(); // index 0 = 30 days ago, index 30 = today
    });
    d.shipments.forEach((s) => {
      const info = SUPPLIER_INFO[s.party];
      s.from = s.direction === "inbound" ? info.city : s.warehouse;
      s.to = s.direction === "inbound" ? s.warehouse : CUSTOMER_CITY[s.party];
      if (s.status === "delivered") s.deliveredOn = r() < 0.3 ? addDays(s.eta, 1 + Math.floor(r() * 3)) : s.eta;
    });
    // closed inbound orders of the last 90 days, for supplier performance
    d.supplyHistory = [];
    Object.keys(SUPPLIER_INFO).forEach((name) => {
      const info = SUPPLIER_INFO[name];
      const n = 6 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const ordered = addDays(today, -90 + Math.floor(r() * 80));
        const promised = addDays(ordered, info.leadTime);
        const late = r() < (name === "יבוא תעשייתי בע״מ" ? 0.45 : 0.15) ? 1 + Math.floor(r() * 5) : 0;
        d.supplyHistory.push({ supplier: name, ordered, promised, delivered: addDays(promised, late) });
      }
    });
    d.warehouseInfo = d.warehouses.map((w) => {
      const pallets = d.items.filter((i) => i.warehouse === w).reduce((s, i) => s + Math.ceil(i.onHand / i.moq), 0);
      return { name: w, city: w, capacity: CAPACITY[w], occupied: Math.min(CAPACITY[w], Math.round(CAPACITY[w] * (0.55 + r() * 0.4)) + pallets) };
    });
    d.suppliers = Object.keys(SUPPLIER_INFO).map((name) => ({ name, city: SUPPLIER_INFO[name].city, leadTime: SUPPLIER_INFO[name].leadTime }));
    d.cities = CITY;
    d.today = today;
    return d;
  }

  const api = { createData, addDays };
  if (typeof module !== "undefined") module.exports = api;
  else root.MockData = api;
})(this);
