// Schematic network map along the Mediterranean coast (SPEC v2 feature 10).
// Draws routes between origin and destination cities only. It is not GPS tracking.
(function (root) {
  const W = 360, H = 560;
  const LAT0 = 33.2, LAT1 = 31.1, LON0 = 34.35, LON1 = 35.55;
  const px = (lat, lon) => [((lon - LON0) / (LON1 - LON0)) * W, ((LAT0 - lat) / (LAT0 - LAT1)) * H];
  const COAST = [[33.09, 35.105], [32.92, 35.075], [32.83, 34.985], [32.73, 34.95], [32.5, 34.89], [32.32, 34.85], [32.1, 34.77], [31.95, 34.7], [31.8, 34.64], [31.67, 34.55], [31.53, 34.47], [31.3, 34.27]];

  function networkMap(data, logic, today) {
    const c = (name) => px(...data.cities[name]);
    const coast = COAST.map((p) => px(...p));
    const coastPath = coast.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const sea = coastPath + ` L ${coast[coast.length - 1][0]} ${H} L 0 ${H} L 0 0 L ${coast[0][0]} 0 Z`;

    let routes = "";
    data.shipments.filter((s) => s.status !== "delivered").forEach((s) => {
      const [x1, y1] = c(s.from), [x2, y2] = c(s.to);
      const mx = (x1 + x2) / 2 + (y2 - y1) * 0.18, my = (y1 + y2) / 2 - (x2 - x1) * 0.18;
      const st = logic.shipmentState(s, today);
      const cls = st === "delayed" ? "late" : st === "in_transit" ? "moving" : "prep";
      routes += `<path class="route ${cls}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"><title>${s.id}: ${s.from} אל ${s.to}</title></path>`;
    });

    const whNames = new Set(data.warehouses);
    let nodes = "";
    Object.keys(data.cities).forEach((name) => {
      const [x, y] = c(name);
      if (whNames.has(name)) return;
      nodes += `<circle cx="${x}" cy="${y}" r="3.5" fill="#1a2a36" stroke="#9aacba" stroke-width="1.5"/>
        <text x="${x + 8}" y="${y + 4}" text-anchor="start" font-size="11" fill="#9aacba">${name}</text>`;
    });
    logic.warehouseSummary(data).forEach((w) => {
      const [x, y] = c(w.name);
      nodes += `<g><rect x="${x - 9}" y="${y - 9}" width="18" height="18" rx="3" fill="#3cc8e0" stroke="#132029" stroke-width="3"/>
        <text x="${x + 15}" y="${y - 2}" text-anchor="start" font-size="15" fill="#e8eef2" font-family="Secular One, Rubik, sans-serif">${w.name}</text>
        <text x="${x + 15}" y="${y + 14}" text-anchor="start" font-size="11" fill="#9aacba">${w.utilization}% תפוסה</text></g>`;
    });

    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="מפת רשת סכמטית: מחסנים, ספקים, לקוחות ומשלוחים פתוחים">
      <path d="${sea}" fill="#10202b"/>
      <path d="${coastPath}" fill="none" stroke="#2b3d4b" stroke-width="2"/>
      <text x="22" y="${H * 0.42}" font-size="12" fill="#6f8494" transform="rotate(-90 22 ${H * 0.42})" text-anchor="middle">הים התיכון</text>
      ${routes}${nodes}</svg>`;
  }

  root.NetworkMap = { networkMap };
})(this);
