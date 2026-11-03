// UI: control-room shell with four screens (SPEC v2). All numbers come from logic.js.
(function () {
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const TODAY = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  const data = MockData.createData(42, TODAY);
  const ABC = Logic.abcClasses(data.items);
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const ils = (n) => "₪" + Math.round(n).toLocaleString("he-IL");
  const num = (n) => Math.round(n).toLocaleString("he-IL");
  const dshort = (iso) => { const [, m, d] = iso.split("-"); return +d + "." + +m; };
  const STATUS = { ok: "תקין", low: "נמוך", out: "אזל" };
  const SHIP = { preparing: "בהכנה", in_transit: "בדרך", delayed: "מתעכב", delivered: "נמסר" };
  const TITLES = { overview: "סקירה", inventory: "מלאי", shipments: "משלוחים", suppliers: "ספקים" };
  const ARROW_UP = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>';
  const ARROW_DOWN = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>';

  // ---------- shared state ----------
  const state = { view: "overview", filters: { warehouse: "", category: "", status: "", query: "" }, sort: { key: "status", dir: "asc" }, shipDir: "", attnTab: "items" };
  let marked = [];
  try { marked = JSON.parse(localStorage.getItem("marked-for-order") || "[]"); } catch (e) { marked = []; }
  const saveMarks = () => { try { localStorage.setItem("marked-for-order", JSON.stringify(marked)); } catch (e) { /* storage blocked */ } };
  function toggleMark(sku) {
    marked = marked.includes(sku) ? marked.filter((s) => s !== sku) : Logic.markForOrder(marked, sku);
    saveMarks();
    renderAll();
  }
  const markBtn = (sku) => {
    const on = marked.includes(sku);
    return `<button type="button" class="btn" data-mark="${esc(sku)}" aria-pressed="${on}">${on ? "בסל" : "הוסף לסל"}</button>`;
  };

  // ---------- overview ----------
  function kpiCard(label, value, series, cls, unit, fmt) {
    const ch = Logic.pctChange(series, 7);
    const dir = ch > 0 ? "עלייה" : ch < 0 ? "ירידה" : "ללא שינוי";
    const arrow = ch > 0 ? ARROW_UP : ch < 0 ? ARROW_DOWN : "";
    return `<div class="panel kpi ${cls}"><span class="lbl">${label}</span>
      <span class="num">${value}</span>${Charts.sparkline(series, 96, 38, "#3cc8e0")}
      <span class="delta">${arrow}<b>${dir}${ch ? " של " + Math.abs(ch) + "%" : ""}</b> מול לפני 7 ימים${unit ? " (" + unit + ")" : ""}</span></div>`;
  }

  function renderOverview() {
    const k = Logic.kpis(data.items, data.shipments, TODAY);
    const ser = Logic.kpiSeries(data);
    const labels = ser.stockValue.map((_, i) => dshort(Logic.addDays(TODAY, i - 30)));
    const flows = Logic.flows(data.items, 14);
    const whs = Logic.warehouseSummary(data);
    const cats = Logic.valueByCategory(data.items);
    const catMax = Math.max(...cats.map((c) => c.value), 1);
    const ev = Logic.events(data, TODAY).slice(0, 7);

    const soon = data.items.filter((i) => Logic.itemStatus(i) !== "ok" || Logic.daysOfCover(i) <= 14)
      .sort((a, b) => Logic.daysOfCover(a) - Logic.daysOfCover(b)).slice(0, 7);
    const late = Logic.sortShipments(data.shipments, TODAY).filter((s) => Logic.shipmentState(s, TODAY) === "delayed");

    const attnItems = soon.map((i) => {
      const st = Logic.itemStatus(i), cover = Logic.daysOfCover(i);
      return `<li class="row"><button type="button" class="linkish" data-item="${esc(i.sku)}">
          <div class="t">${esc(i.name)}</div>
          <div class="m"><span class="st ${st}">${STATUS[st]}</span>&nbsp; ${st === "out" ? "אזל, מחסן " + esc(i.warehouse) : "נגמר בעוד " + cover + " ימים, מחסן " + esc(i.warehouse)}, להזמנה ${Logic.reorderQty(i) || i.moq} יח׳</div>
        </button>${markBtn(i.sku)}</li>`;
    }).join("");
    const attnShips = late.length ? late.map((s) => `<li class="row"><div><div class="t">${esc(s.id)} מ${esc(s.from)} אל ${esc(s.to)}</div>
        <div class="m"><span class="st delayed">מתעכב</span>&nbsp; באיחור של ${-Logic.daysBetween(TODAY, s.eta)} ימים, ${esc(s.party)}</div></div>
        <a class="btn quiet" href="#shipments">ללוח</a></li>`).join("") : `<li class="row"><div class="m">אין משלוחים מתעכבים.</div></li>`;

    $("view-overview").innerHTML = `
      <div class="kpis">
        ${kpiCard("מק״טים במלאי", num(k.skuCount), Array(31).fill(k.skuCount), "", "")}
        ${kpiCard("שווי מלאי", ils(k.stockValue), ser.stockValue, "", "")}
        ${kpiCard("מלאי נמוך או אזל", num(k.lowCount), ser.lowCount, k.lowCount ? "low" : "", "פריטים")}
        ${kpiCard("משלוחים מתעכבים", num(k.delayedCount), ser.delayed, k.delayedCount ? "bad" : "", "משלוחים")}
      </div>
      <div class="grid" style="margin-top:18px">
        <section class="panel s7" aria-labelledby="map-h">
          <div class="ph"><h2 id="map-h">הרשת עכשיו</h2><span class="note">${data.shipments.filter((s) => s.status !== "delivered").length} משלוחים פתוחים</span></div>
          <div class="pb map-wrap">
            <div class="map">${NetworkMap.networkMap(data, Logic, TODAY)}</div>
            <div class="legend">
              <span><i style="border-color:var(--signal);border-top-style:dashed"></i>משלוח בדרך</span>
              <span><i style="border-color:var(--bad);border-top-style:dashed"></i>משלוח מתעכב</span>
              <span><i style="border-color:var(--faint);border-top-style:dotted"></i>בהכנה</span>
              <span><i style="border:0;width:12px;height:12px;background:var(--signal);border-radius:2px;vertical-align:-1px"></i>מחסן</span>
              <span><i style="border:1.5px solid var(--muted);width:9px;height:9px;border-radius:50%;vertical-align:0"></i>ספק או לקוח</span>
              <span style="color:var(--faint);line-height:1.5">מפה סכמטית: קו בין מוצא ליעד, לא מיקום בזמן אמת.</span>
            </div>
          </div>
        </section>
        <section class="panel s5" aria-labelledby="attn-h">
          <div class="ph"><h2 id="attn-h">דורש טיפול</h2>
            <div class="tabs" role="group" aria-label="סוג">
              <button type="button" data-attn="items" aria-pressed="${state.attnTab === "items"}">פריטים (${soon.length})</button>
              <button type="button" data-attn="ships" aria-pressed="${state.attnTab === "ships"}">משלוחים (${late.length})</button>
            </div></div>
          <div class="pb"><ul class="rows">${state.attnTab === "items" ? attnItems : attnShips}</ul></div>
        </section>
        <section class="panel s7" aria-labelledby="trend-h">
          <div class="ph"><h2 id="trend-h">שווי מלאי ב-30 הימים האחרונים</h2><span class="note">${ils(ser.stockValue[30])} היום</span></div>
          <div class="pb chart">${Charts.area(ser.stockValue, labels, { label: "שווי מלאי יומי", fmt: (v) => "₪" + Math.round(v / 1000) + "K" })}</div>
        </section>
        <section class="panel s5" aria-labelledby="flow-h">
          <div class="ph"><h2 id="flow-h">תנועות ב-14 הימים האחרונים</h2>
            <span class="key"><span><i style="background:var(--signal)"></i>נכנס</span><span><i style="background:var(--violet)"></i>יצא</span></span></div>
          <div class="pb chart">${Charts.flowBars(flows, [labels[30 - 13], labels[30]])}<div class="note" style="direction:rtl;color:var(--muted);font-size:13px;margin-top:6px">יחידות בכל יום, בכל המחסנים</div></div>
        </section>
        <div class="s12 whs">${whs.map((w) => `
          <button type="button" class="panel wh" data-wh="${esc(w.name)}" aria-label="פתח את המלאי של מחסן ${esc(w.name)}">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%"><h3>${esc(w.name)}</h3>${w.nearlyFull ? '<span class="tag">כמעט מלא</span>' : ""}</div>
            <div style="width:100%"><div style="display:flex;justify-content:space-between;font-size:13px;color:var(--muted);margin-bottom:6px"><span>תפוסת מקומות משטח</span><span>${w.occupied} מתוך ${w.capacity} (${w.utilization}%)</span></div>
              <div class="bar"><span style="width:${w.utilization}%"></span></div></div>
            <div class="facts" style="width:100%"><span><b>${ils(w.value)}</b>שווי מלאי</span><span><b>${w.skuCount}</b>מק״טים</span><span><b>${w.attention}</b>דורשים טיפול</span></div>
          </button>`).join("")}</div>
        <section class="panel s7" aria-labelledby="cat-h">
          <div class="ph"><h2 id="cat-h">שווי מלאי לפי קטגוריה</h2></div>
          <div class="pb hbars">${cats.map((c) => `<div class="hbar"><span>${esc(c.category)}</span><div class="track"><span style="width:${Math.max(2, (c.value / catMax) * 100)}%"></span></div><span class="v">${ils(c.value)}</span></div>`).join("")}</div>
        </section>
        <section class="panel s5" aria-labelledby="ev-h">
          <div class="ph"><h2 id="ev-h">יומן אירועים</h2></div>
          <div class="pb">${ev.map((e) => `<div class="ev"><time datetime="${e.date}">${dshort(e.date)}</time><span><span class="st ${e.kind}"></span> ${esc(e.text)}</span></div>`).join("")}</div>
        </section>
      </div>`;
  }

  // ---------- other screens (filled by later requests) ----------
  // ---------- inventory ----------
  const COLS = [
    ["sku", "מק״ט", ""], ["name", "פריט", ""], ["warehouse", "מחסן ומיקום", ""], ["abc", "ABC", ""],
    ["onHand", "כמות", "n"], ["cover", "ימי מלאי", "n"], ["", "אזילה צפויה", ""], ["value", "שווי", "n"], ["status", "סטטוס", ""], ["", "", ""],
  ];
  function renderInventory() {
    const f = state.filters;
    const opts = (list, cur) => '<option value="">הכול</option>' + list.map((v) => `<option ${v === cur ? "selected" : ""}>${esc(v)}</option>`).join("");
    const rows = Logic.sortItems(Logic.filterItems(data.items, f), state.sort.key, state.sort.dir, { abc: ABC });
    const head = COLS.map(([key, label, cls]) => {
      if (!key) return `<th class="${cls}">${label}</th>`;
      const on = state.sort.key === key;
      const aria = on ? ` aria-sort="${state.sort.dir === "asc" ? "ascending" : "descending"}"` : "";
      return `<th class="${cls}"${aria}><button type="button" data-sort="${key}">${label}${on ? (state.sort.dir === "asc" ? " ▴" : " ▾") : ""}</button></th>`;
    }).join("");
    const body = rows.length ? rows.map((i) => {
      const st = Logic.itemStatus(i), cover = Logic.daysOfCover(i), out = Logic.stockoutDate(i, TODAY);
      const fill = Math.min(100, Math.round((i.onHand / i.maxStock) * 100));
      const color = st === "ok" ? "var(--ok)" : st === "low" ? "var(--low)" : "var(--bad)";
      return `<tr data-item="${esc(i.sku)}" tabindex="0" aria-label="פרטי ${esc(i.name)}">
        <td class="code">${esc(i.sku)}</td><td>${esc(i.name)}</td>
        <td>${esc(i.warehouse)} <span class="code">${esc(i.bin)}</span></td>
        <td><span class="abc ${ABC[i.sku]}">${ABC[i.sku]}</span></td>
        <td class="n">${num(i.onHand)} יח׳<span class="mini" aria-hidden="true"><span style="width:${fill}%;background:${color}"></span></span></td>
        <td class="n">${st === "out" ? "0" : cover} ימים</td>
        <td>${out ? dshort(out) : "אזל"}</td>
        <td class="n">${ils(i.onHand * i.unitPrice)}</td>
        <td><span class="st ${st}">${STATUS[st]}</span></td>
        <td>${markBtn(i.sku)}</td></tr>`;
    }).join("") : `<tr><td colspan="${COLS.length}" style="text-align:center;color:var(--muted);padding:28px">אין פריטים שמתאימים לסינון. <button type="button" class="btn quiet" data-clear="1">נקה סינון</button></td></tr>`;
    const statusChips = [["", "הכול"], ["out", "אזל"], ["low", "נמוך"], ["ok", "תקין"]]
      .map(([v, l]) => `<button type="button" class="chip" data-status="${v}" aria-pressed="${f.status === v}">${l}</button>`).join("");
    $("view-inventory").innerHTML = `
      <div class="toolbar">
        <label>מחסן<select data-filter="warehouse">${opts(data.warehouses, f.warehouse)}</select></label>
        <label>קטגוריה<select data-filter="category">${opts(data.categories, f.category)}</select></label>
        <label>חיפוש בטבלה<input type="search" data-filter="query" value="${esc(f.query)}" placeholder="שם או מק״ט"></label>
        <div role="group" aria-label="סטטוס" style="display:flex;gap:6px;align-self:end">${statusChips}</div>
        <span class="grow">${rows.length} מתוך ${data.items.length} פריטים</span>
      </div>
      <div class="panel tbl-box"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  }

  // ---------- item drawer ----------
  const drawerHost = document.createElement("div");
  drawerHost.innerHTML = `<div class="scrim" id="scrim" hidden></div>
    <aside class="drawer" id="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" hidden></aside>`;
  document.body.appendChild(drawerHost);
  let lastFocus = null;
  function openDrawer(html) {
    lastFocus = document.activeElement;
    $("drawer").innerHTML = html;
    $("drawer").hidden = false; $("scrim").hidden = false;
    $("drawer").querySelector(".x").focus();
  }
  function closeDrawer() {
    $("drawer").hidden = true; $("scrim").hidden = true;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  function itemDrawer(sku) {
    const i = data.items.find((x) => x.sku === sku);
    if (!i) return;
    const st = Logic.itemStatus(i), qty = Logic.reorderQty(i) || i.moq, out = Logic.stockoutDate(i, TODAY);
    const sp = data.suppliers.find((s) => s.name === i.supplier);
    openDrawer(`
      <div class="dh"><div><span class="code">${esc(i.sku)}</span><h2 id="drawer-title">${esc(i.name)}</h2>
        <div style="margin-top:6px"><span class="st ${st}">${STATUS[st]}</span> <span class="abc ${ABC[i.sku]}" style="margin-inline-start:8px" title="סיווג ABC">${ABC[i.sku]}</span></div></div>
        <button type="button" class="x" data-close="1" aria-label="סגור">✕</button></div>
      <div class="db">
        <div class="facts-grid">
          <div class="fact"><span>במלאי</span><b>${num(i.onHand)} יח׳</b></div>
          <div class="fact"><span>נקודת הזמנה</span><b>${num(i.reorderPoint)} יח׳</b></div>
          <div class="fact"><span>מלאי מקסימלי</span><b>${num(i.maxStock)} יח׳</b></div>
          <div class="fact"><span>צריכה יומית</span><b>${i.dailyUsage} יח׳</b></div>
          <div class="fact"><span>ימי מלאי</span><b>${Logic.daysOfCover(i)} ימים</b></div>
          <div class="fact"><span>אזילה צפויה</span><b>${out ? dshort(out) : "אזל"}</b></div>
          <div class="fact"><span>מחסן ומדף</span><b>${esc(i.warehouse)} <span class="code">${esc(i.bin)}</span></b></div>
          <div class="fact"><span>ספק</span><b style="font-size:14px">${esc(i.supplier)}</b></div>
          <div class="fact"><span>זמן אספקה</span><b>${sp ? sp.leadTime : "?"} ימים</b></div>
        </div>
        <div><div style="font-size:14px;margin-bottom:6px">מלאי ב-30 הימים האחרונים</div>
          <div class="chart">${Charts.itemHistory(i.history, i.reorderPoint, [dshort(Logic.addDays(TODAY, -30)), "היום"])}</div></div>
        <div class="callout"><div><div style="font-size:14px;color:var(--muted)">הזמנה מוצעת</div>
          <div style="font-size:20px;font-weight:600">${num(qty)} יח׳, ${ils(qty * i.unitPrice)}</div>
          <div style="font-size:13px;color:var(--muted)">${st === "ok" ? "הפריט תקין. כמות MOQ אחת אם רוצים להקדים." : "משלים עד המלאי המקסימלי, בכפולות של " + i.moq + "."}</div></div>
          ${markBtn(i.sku)}</div>
      </div>`);
  }

  // ---------- global search ----------
  function renderResults() {
    const q = $("q").value.trim().toLowerCase();
    const box = $("q-results");
    if (!q) { box.hidden = true; return; }
    const hits = data.items.filter((i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)).slice(0, 8);
    box.innerHTML = hits.length ? hits.map((i) => `<li><button type="button" data-item="${esc(i.sku)}"><span>${esc(i.name)}</span><span class="code">${esc(i.sku)}</span></button></li>`).join("")
      : '<li style="padding:8px 10px;color:var(--muted)">לא נמצא פריט. נסו מק״ט, למשל BR-1001.</li>';
    box.hidden = false;
  }
  $("q").addEventListener("input", renderResults);
  $("q").addEventListener("keydown", (e) => { if (e.key === "Escape") { $("q").value = ""; renderResults(); } });
  function renderShipments() { $("view-shipments").innerHTML = '<p class="note">לוח המשלוחים בבנייה.</p>'; }
  function renderSuppliers() { $("view-suppliers").innerHTML = '<p class="note">מסך הספקים בבנייה.</p>'; }

  // ---------- shell ----------
  function renderChrome() {
    const k = Logic.kpis(data.items, data.shipments, TODAY);
    $("nav-attn").textContent = k.lowCount;
    $("nav-late").textContent = k.delayedCount;
    $("basket-count").textContent = Logic.basket(data.items, marked).count;
    $("basket-count").classList.toggle("hot", marked.length > 0);
    $("view-title").textContent = TITLES[state.view];
    $("when").textContent = now.toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long" }) + ", נתוני דמה";
    document.querySelectorAll(".nav a").forEach((a) => {
      if (a.dataset.view === state.view) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === "view-" + state.view));
  }

  function renderAll() {
    renderChrome();
    ({ overview: renderOverview, inventory: renderInventory, shipments: renderShipments, suppliers: renderSuppliers })[state.view]();
  }

  // Deep links: #inventory opens the inventory screen; Back returns to the previous one.
  function route() {
    const v = location.hash.replace("#", "");
    state.view = TITLES[v] ? v : "overview";
    renderAll();
  }
  window.addEventListener("hashchange", route);

  // One delegated click handler for the whole app.
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search")) $("q-results").hidden = true;
    const t = e.target.closest("[data-mark],[data-attn],[data-wh],[data-item],[data-sort],[data-status],[data-clear],[data-close],#scrim");
    if (!t) return;
    if (t.id === "scrim" || t.dataset.close) { closeDrawer(); return; }
    if (t.dataset.mark) {
      toggleMark(t.dataset.mark);
      if (!$("drawer").hidden && $("drawer").querySelector("[data-mark]")) { const b = $("drawer").querySelector("[data-mark]"); const on = marked.includes(b.dataset.mark); b.setAttribute("aria-pressed", on); b.textContent = on ? "בסל" : "הוסף לסל"; }
      return;
    }
    if (t.dataset.item) { $("q-results").hidden = true; itemDrawer(t.dataset.item); return; }
    if (t.dataset.sort) {
      const k = t.dataset.sort;
      state.sort = { key: k, dir: state.sort.key === k && state.sort.dir === "asc" ? "desc" : "asc" };
      renderInventory(); return;
    }
    if (t.dataset.status !== undefined) { state.filters.status = t.dataset.status; renderInventory(); return; }
    if (t.dataset.clear) { state.filters = { warehouse: "", category: "", status: "", query: "" }; renderInventory(); return; }
    if (t.dataset.attn) { state.attnTab = t.dataset.attn; renderOverview(); return; }
    if (t.dataset.wh) { state.filters = { warehouse: t.dataset.wh, category: "", status: "", query: "" }; location.hash = "#inventory"; }
  });

  // Filters in the inventory toolbar.
  document.addEventListener("change", (e) => {
    const k = e.target.dataset && e.target.dataset.filter;
    if (k && k !== "query") { state.filters[k] = e.target.value; renderInventory(); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.dataset && e.target.dataset.filter === "query") {
      state.filters.query = e.target.value;
      const pos = e.target.selectionStart;
      renderInventory();
      const el = document.querySelector('[data-filter="query"]');
      el.focus(); el.setSelectionRange(pos, pos);
    }
  });

  // Keyboard: "/" focuses search, Esc closes the drawer, Enter on a table row opens it.
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !/INPUT|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $("q").focus(); }
    if (e.key === "Escape" && !$("drawer").hidden) closeDrawer();
    if (e.key === "Enter" && document.activeElement.matches("tr[data-item]")) itemDrawer(document.activeElement.dataset.item);
  });

  route();
  window.App = { data, state, TODAY, ABC, esc, ils, num, dshort, STATUS, SHIP, markBtn, toggleMark, renderAll, $ };
})();
