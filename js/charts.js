// Tiny SVG chart helpers. Return markup strings; charts read left to right in time (dir=ltr wrapper).
(function (root) {
  function scale(values, h, pad) {
    const max = Math.max(...values), min = Math.min(...values);
    const span = max - min || 1;
    return (v) => pad + (h - 2 * pad) * (1 - (v - min) / span);
  }

  function sparkline(values, w, h, color) {
    const y = scale(values, h, 3);
    const step = w / (values.length - 1);
    const pts = values.map((v, i) => (i * step).toFixed(1) + "," + y(v).toFixed(1)).join(" ");
    const last = values.length - 1;
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${(last * step).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="2.6" fill="${color}"/></svg>`;
  }

  // Area chart with y gridlines and first/middle/last x labels.
  function area(values, labels, opts) {
    const W = 640, H = 220, L = 54, R = 10, T = 12, B = 26;
    const max = Math.max(...values) * 1.08, min = Math.min(...values) * 0.92;
    const x = (i) => L + ((W - L - R) * i) / (values.length - 1);
    const y = (v) => T + (H - T - B) * (1 - (v - min) / (max - min || 1));
    const line = values.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    const fill = line + ` L ${x(values.length - 1)} ${H - B} L ${x(0)} ${H - B} Z`;
    let grid = "";
    for (let g = 0; g <= 3; g++) {
      const v = min + ((max - min) * g) / 3;
      grid += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#2b3d4b"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${opts.fmt(v)}</text>`;
    }
    const ticks = [0, Math.floor(values.length / 2), values.length - 1]
      .map((i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="${i === 0 ? "start" : i === values.length - 1 ? "end" : "middle"}">${labels[i]}</text>`).join("");
    const i = values.length - 1;
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.label}">
      <defs><linearGradient id="ag" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3cc8e0" stop-opacity=".35"/><stop offset="1" stop-color="#3cc8e0" stop-opacity="0"/></linearGradient></defs>
      ${grid}<path d="${fill}" fill="url(#ag)"/><path d="${line}" fill="none" stroke="#3cc8e0" stroke-width="2.2"/>
      <circle cx="${x(i)}" cy="${y(values[i])}" r="4" fill="#3cc8e0" stroke="#1a2a36" stroke-width="2"/>${ticks}</svg>`;
  }

  // Paired bars per day: in (signal) and out (violet).
  function flowBars(rows, labels) {
    const W = 460, H = 220, L = 34, R = 6, T = 12, B = 26;
    const max = Math.max(...rows.map((r) => Math.max(r.in, r.out)), 1);
    const slot = (W - L - R) / rows.length, bw = Math.max(3, slot * 0.34);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    let s = `<line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="#2b3d4b"/>`;
    s += `<text x="${L - 6}" y="${y(max) + 4}" text-anchor="end">${max}</text><text x="${L - 6}" y="${H - B}" text-anchor="end">0</text>`;
    rows.forEach((r, i) => {
      const x0 = L + slot * i + slot / 2 - bw;
      s += `<rect x="${x0}" y="${y(r.in)}" width="${bw}" height="${H - B - y(r.in)}" rx="1.5" fill="#3cc8e0"/>`;
      s += `<rect x="${x0 + bw + 1}" y="${y(r.out)}" width="${bw}" height="${H - B - y(r.out)}" rx="1.5" fill="#a78bfa"/>`;
    });
    [0, rows.length - 1].forEach((i, k) => { s += `<text x="${L + slot * i + slot / 2}" y="${H - 6}" text-anchor="middle">${labels[k]}</text>`; });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="יחידות שנכנסו ויצאו בכל יום">${s}</svg>`;
  }

  // Item history with the reorder point as a dashed line.
  function itemHistory(values, reorderPoint, labels) {
    const W = 420, H = 150, L = 34, R = 8, T = 10, B = 22;
    const max = Math.max(...values, reorderPoint) * 1.1 || 1;
    const x = (i) => L + ((W - L - R) * i) / (values.length - 1);
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const line = values.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="מלאי ב-30 הימים האחרונים">
      <line x1="${L}" x2="${W - R}" y1="${y(reorderPoint)}" y2="${y(reorderPoint)}" stroke="#f2a93b" stroke-dasharray="4 4"/>
      <text x="${W - R}" y="${y(reorderPoint) - 5}" text-anchor="end" fill="#f2a93b">נקודת הזמנה ${reorderPoint}</text>
      <path d="${line}" fill="none" stroke="#3cc8e0" stroke-width="2"/>
      <text x="${L - 6}" y="${y(max / 1.1) + 4}" text-anchor="end">${Math.round(max / 1.1)}</text><text x="${L - 6}" y="${H - B}" text-anchor="end">0</text>
      <text x="${x(0)}" y="${H - 5}">${labels[0]}</text><text x="${x(values.length - 1)}" y="${H - 5}" text-anchor="end">${labels[1]}</text></svg>`;
  }

  root.Charts = { sparkline, area, flowBars, itemHistory };
})(this);
