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
  function renderInventory() { $("view-inventory").innerHTML = '<p class="note">מסך המלאי בבנייה.</p>'; }
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
    const t = e.target.closest("[data-mark],[data-attn],[data-wh]");
    if (!t) return;
    if (t.dataset.mark) { toggleMark(t.dataset.mark); return; }
    if (t.dataset.attn) { state.attnTab = t.dataset.attn; renderOverview(); return; }
    if (t.dataset.wh) { state.filters = { warehouse: t.dataset.wh, category: "", status: "", query: "" }; location.hash = "#inventory"; }
  });

  // Global search: "/" focuses it from anywhere.
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement.tagName !== "INPUT") { e.preventDefault(); $("q").focus(); }
  });

  route();
  window.App = { data, state, TODAY, ABC, esc, ils, num, dshort, STATUS, SHIP, markBtn, toggleMark, renderAll, $ };
})();
