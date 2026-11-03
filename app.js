// UI only: reads mock data, renders with the pure functions in logic.js.
(function () {
  const pad = (n) => String(n).padStart(2, "0");
  const now = new Date();
  const TODAY = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
  const data = MockData.createData(42, TODAY);
  const STATUS = { ok: "תקין", low: "נמוך", out: "אזל" };
  const ils = (n) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const state = { warehouse: "", category: "", status: "", query: "" };

  function renderKpis() {
    const k = Logic.kpis(data.items, data.shipments, TODAY);
    $("kpis").innerHTML = [
      ["מק״טים במלאי", k.skuCount, "בשלושה מחסנים", ""],
      ["שווי מלאי", "₪" + ils(k.stockValue), "כמות × מחיר יחידה", ""],
      ["מלאי נמוך או אזל", k.lowCount, "מתחת לנקודת ההזמנה", k.lowCount ? "warn" : ""],
      ["משלוחים מתעכבים", k.delayedCount, "עבר תאריך ההגעה", k.delayedCount ? "bad" : ""],
    ].map(([label, value, hint, cls]) =>
      `<div class="kpi ${cls}"><span class="label">${label}</span><span class="value">${value}</span><span class="hint">${hint}</span></div>`).join("");
  }

  function renderInventory() {
    const rows = Logic.filterItems(data.items, state);
    $("inv-count").textContent = rows.length + " מתוך " + data.items.length + " פריטים";
    $("inv-body").innerHTML = rows.length ? rows.map((i) => {
      const st = Logic.itemStatus(i);
      const fill = Math.min(100, Math.round((i.onHand / i.maxStock) * 100));
      const color = st === "ok" ? "var(--green)" : st === "low" ? "var(--amber)" : "var(--red)";
      return `<tr>
        <td class="sku">${esc(i.sku)}</td><td>${esc(i.name)}</td><td>${esc(i.category)}</td><td>${esc(i.warehouse)}</td>
        <td class="num">${i.onHand}</td>
        <td><span class="bar" title="${i.onHand} מתוך ${i.maxStock}, נקודת הזמנה ${i.reorderPoint}"><span style="width:${fill}%;background:${color}"></span></span></td>
        <td class="num">${ils(i.onHand * i.unitPrice)}</td>
        <td><span class="pill ${st}">${STATUS[st]}</span></td></tr>`;
    }).join("") : `<tr><td colspan="8" class="empty">אין פריטים שמתאימים לסינון</td></tr>`;
  }

  // Marked-for-order list survives a reload when storage is available.
  let marked = [];
  try { marked = JSON.parse(localStorage.getItem("marked-for-order") || "[]"); } catch (e) { marked = []; }
  const saveMarks = () => { try { localStorage.setItem("marked-for-order", JSON.stringify(marked)); } catch (e) { /* storage blocked */ } };

  function renderAlerts() {
    const list = Logic.reorderList(data.items);
    $("alerts-count").textContent = list.length + " פריטים";
    $("alerts").innerHTML = list.map(({ item, qty, cost }) => {
      const st = Logic.itemStatus(item);
      const on = marked.includes(item.sku);
      return `<li class="alert">
        <div class="what"><span class="name">${esc(item.name)} <span class="pill ${st}">${STATUS[st]}</span></span>
          <span class="meta"><span class="mono">${esc(item.sku)}</span> · ${esc(item.warehouse)} · במלאי ${item.onHand} מתוך נקודת הזמנה ${item.reorderPoint} · ${esc(item.supplier)}</span></div>
        <div class="qty"><b>${qty}</b><span>₪${ils(cost)}</span></div>
        <button type="button" class="mark" data-sku="${esc(item.sku)}" aria-pressed="${on}">${on ? "סומן" : "סמן להזמנה"}</button>
      </li>`;
    }).join("");
    const chosen = list.filter((r) => marked.includes(r.item.sku));
    $("order-summary").textContent = chosen.length
      ? "סומנו " + chosen.length + " פריטים · עלות משוערת ₪" + ils(chosen.reduce((s, r) => s + r.cost, 0))
      : "עוד לא סומנו פריטים להזמנה";
  }

  $("alerts").addEventListener("click", (e) => {
    const b = e.target.closest("button.mark");
    if (!b) return;
    marked = Logic.markForOrder(marked, b.dataset.sku);
    saveMarks();
    renderAlerts();
  });
  $("clear-marks").addEventListener("click", () => { marked = []; saveMarks(); renderAlerts(); });

  function fillSelect(id, values) {
    $(id).insertAdjacentHTML("beforeend", values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join(""));
  }

  $("today").textContent = "· " + now.toLocaleDateString("he-IL");
  fillSelect("f-warehouse", data.warehouses);
  fillSelect("f-category", data.categories);
  [["f-warehouse", "warehouse"], ["f-category", "category"], ["f-status", "status"]].forEach(([id, key]) =>
    $(id).addEventListener("change", (e) => { state[key] = e.target.value; renderInventory(); }));
  $("f-query").addEventListener("input", (e) => { state.query = e.target.value; renderInventory(); });

  renderKpis();
  renderAlerts();
  renderInventory();
})();
