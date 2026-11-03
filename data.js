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
    return { items, shipments, warehouses: WAREHOUSES.slice(), categories: CATALOG.map((c) => c[0]) };
  }

  const api = { createData, addDays };
  if (typeof module !== "undefined") module.exports = api;
  else root.MockData = api;
})(this);
