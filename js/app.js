import { DB } from "./db.js";
import { computeCartTotals, formatCAD } from "./tax.js";
import { getCurrentPosition, nearestStores, distanceKm } from "./geo.js";

// ---------------------------------------------------------------- routing --
const state = { view: "dashboard", storeId: null, itemId: null };

function showView(view, params = {}) {
  state.view = view;
  Object.assign(state, params);
  document.querySelectorAll(".view").forEach((el) => {
    el.hidden = el.dataset.view !== view;
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === view);
  });
  render();
}

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.view));
});
document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.back, { storeId: state.storeId }));
});

// ------------------------------------------------------------------ toast --
let toastTimer = null;
function showToast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// -------------------------------------------------------------- rendering --
function render() {
  renderReminderBell();
  if (state.view === "dashboard") renderDashboard();
  if (state.view === "stores") renderStores();
  if (state.view === "store-detail") renderStoreDetail();
  if (state.view === "item-detail") renderItemDetail();
  if (state.view === "cart") renderCart();
}

function renderReminderBell() {
  const due = DB.getAllDueReminders();
  const badge = document.getElementById("reminder-count");
  if (due.length > 0) {
    badge.hidden = false;
    badge.textContent = due.length;
  } else {
    badge.hidden = true;
  }
}

function itemSubtitle(item) {
  const parts = [];
  if (item.brand) parts.push(item.brand);
  if (item.unit) parts.push(item.unit);
  const latest = DB.getLatestPrice(item.id);
  if (latest) parts.push(formatCAD(latest.price));
  return parts.join(" · ") || "No purchases logged yet";
}

// ---- Dashboard ----
function renderDashboard() {
  const remindersEl = document.getElementById("reminders-list");
  const due = DB.getAllDueReminders();
  remindersEl.innerHTML = "";
  if (due.length === 0) {
    remindersEl.innerHTML = '<p class="empty-state">No reminders due. Set a repurchase interval on an item to get one.</p>';
  } else {
    for (const { item, status } of due) {
      const store = DB.getStore(item.storeId);
      remindersEl.appendChild(
        listRow({
          title: item.name,
          sub: `${store ? store.name : "Unknown store"} · ${itemSubtitle(item)}`,
          chip: { text: "due", cls: "due" },
          onClick: () => showView("item-detail", { storeId: item.storeId, itemId: item.id }),
        })
      );
    }
  }

  const shoppingEl = document.getElementById("shopping-list");
  const toBuy = DB.getState().items.filter((i) => i.toBuy);
  shoppingEl.innerHTML = "";
  if (toBuy.length === 0) {
    shoppingEl.innerHTML = '<p class="empty-state">Nothing marked "to buy" yet. Add items in a store and check "to buy".</p>';
  } else {
    for (const item of toBuy) {
      const store = DB.getStore(item.storeId);
      shoppingEl.appendChild(
        listRow({
          title: item.name,
          sub: `${store ? store.name : "Unknown store"} · ${itemSubtitle(item)}`,
          onClick: () => showView("item-detail", { storeId: item.storeId, itemId: item.id }),
        })
      );
    }
  }
}

document.getElementById("locate-btn").addEventListener("click", async () => {
  const statusEl = document.getElementById("locate-status");
  statusEl.textContent = "Finding your location...";
  try {
    const pos = await getCurrentPosition();
    const stores = DB.getState().stores;
    const ranked = nearestStores(pos, stores);
    if (ranked.length === 0) {
      statusEl.textContent =
        "None of your stores have a saved location yet. Open a store and tap \"Save my current location as this store\" while you're there.";
      document.getElementById("nearby-store-card").hidden = true;
      return;
    }
    const nearest = ranked[0];
    statusEl.textContent = "";
    const card = document.getElementById("nearby-store-card");
    card.hidden = false;
    document.getElementById("nearby-store-name").textContent = nearest.store.name;
    document.getElementById("nearby-store-distance").textContent =
      nearest.km < 1 ? `${Math.round(nearest.km * 1000)} m away` : `${nearest.km.toFixed(1)} km away`;

    const listEl = document.getElementById("nearby-store-list");
    listEl.innerHTML = "";
    const items = DB.getItemsForStore(nearest.store.id).filter((i) => i.toBuy || DB.getReminderStatus(i.id).due);
    if (items.length === 0) {
      listEl.innerHTML = '<p class="empty-state">Nothing to buy here right now.</p>';
    } else {
      for (const item of items) {
        listEl.appendChild(
          listRow({
            title: item.name,
            sub: itemSubtitle(item),
            onClick: () => showView("item-detail", { storeId: item.storeId, itemId: item.id }),
          })
        );
      }
    }
  } catch (err) {
    statusEl.textContent = "Couldn't get your location: " + (err.message || err);
  }
});

// ---- Stores ----
function renderStores() {
  const el = document.getElementById("stores-list");
  const stores = DB.getState().stores;
  el.innerHTML = "";
  if (stores.length === 0) {
    el.innerHTML = '<p class="empty-state">No stores yet — add Costco, Walmart, IGA, or any other store.</p>';
    return;
  }
  for (const store of stores) {
    const itemCount = DB.getItemsForStore(store.id).length;
    el.appendChild(
      listRow({
        title: store.name,
        sub: `${itemCount} product${itemCount === 1 ? "" : "s"}${store.address ? " · " + store.address : ""}${
          store.lat ? " · 📍 located" : ""
        }`,
        onClick: () => showView("store-detail", { storeId: store.id }),
      })
    );
  }
}

document.getElementById("add-store-btn").addEventListener("click", () => openStoreDialog());

function openStoreDialog(store = null) {
  const dialog = document.getElementById("store-dialog");
  const form = document.getElementById("store-form");
  form.reset();
  document.getElementById("store-dialog-title").textContent = store ? "Edit store" : "Add store";
  form.dataset.editId = store ? store.id : "";
  if (store) {
    form.name.value = store.name;
    form.address.value = store.address || "";
    form.notes.value = store.notes || "";
  }
  dialog.showModal();
}

document.getElementById("store-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const data = { name: form.name.value.trim(), address: form.address.value.trim(), notes: form.notes.value.trim() };
  if (!data.name) return;
  if (form.dataset.editId) {
    DB.updateStore(form.dataset.editId, data);
    showToast("Store updated");
  } else {
    DB.addStore(data);
    showToast("Store added");
  }
  document.getElementById("store-dialog").close();
  renderStores();
});

// ---- Store detail ----
function renderStoreDetail() {
  const store = DB.getStore(state.storeId);
  if (!store) return showView("stores");
  document.getElementById("store-detail-name").textContent = store.name;
  document.getElementById("store-detail-address").textContent =
    store.address || (store.lat ? `📍 ${store.lat.toFixed(4)}, ${store.lng.toFixed(4)}` : "No address or location saved yet");

  const el = document.getElementById("store-items-list");
  const items = DB.getItemsForStore(store.id);
  el.innerHTML = "";
  if (items.length === 0) {
    el.innerHTML = '<p class="empty-state">No products logged at this store yet.</p>';
    return;
  }
  for (const item of items) {
    const reminder = DB.getReminderStatus(item.id);
    el.appendChild(
      listRow({
        title: item.name,
        sub: itemSubtitle(item),
        chip: item.toBuy ? { text: "to buy", cls: "" } : reminder.due ? { text: "due", cls: "due" } : null,
        onClick: () => showView("item-detail", { storeId: store.id, itemId: item.id }),
      })
    );
  }
}

document.getElementById("store-set-location-btn").addEventListener("click", async () => {
  try {
    const pos = await getCurrentPosition();
    DB.updateStore(state.storeId, { lat: pos.lat, lng: pos.lng });
    showToast("Location saved for this store");
    renderStoreDetail();
  } catch (err) {
    showToast("Couldn't get your location: " + (err.message || err));
  }
});

document.getElementById("add-item-btn").addEventListener("click", () => {
  document.getElementById("item-form").reset();
  document.getElementById("item-dialog").showModal();
});

document.getElementById("item-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const item = DB.addItem({
    storeId: state.storeId,
    name: form.name.value.trim(),
    brand: form.brand.value.trim(),
    unit: form.unit.value.trim(),
    notes: form.notes.value.trim(),
    taxable: form.taxable.checked,
  });
  document.getElementById("item-dialog").close();
  showToast("Product added");
  showView("item-detail", { storeId: state.storeId, itemId: item.id });
});

// ---- Item detail (price history + reminders) ----
function renderItemDetail(resetBanner = true) {
  const item = DB.getItem(state.itemId);
  if (!item) return showView("store-detail");
  document.getElementById("item-detail-name").textContent = item.name;
  document.getElementById("item-detail-brand").textContent = [item.brand, item.unit].filter(Boolean).join(" · ");

  document.getElementById("log-price-form").date.value = new Date().toISOString().slice(0, 10);
  document.getElementById("reminder-days-input").value = item.reminderDays ?? "";
  document.getElementById("item-toBuy-input").checked = !!item.toBuy;
  document.getElementById("item-taxable-input").checked = !!item.taxable;

  if (resetBanner) document.getElementById("price-change-banner").hidden = true;

  const historyEl = document.getElementById("price-history-list");
  const history = DB.getPriceHistory(item.id).slice().reverse();
  historyEl.innerHTML = "";
  if (history.length === 0) {
    historyEl.innerHTML = '<p class="empty-state">No prices logged yet.</p>';
    return;
  }
  history.forEach((entry, idx) => {
    const older = history[idx + 1]; // next in reversed = chronologically previous
    let chip = null;
    if (older) {
      const pct = older.price !== 0 ? ((entry.price - older.price) / older.price) * 100 : 0;
      if (Math.abs(pct) >= 0.01) {
        chip = { text: `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`, cls: pct > 0 ? "up" : "down" };
      }
    }
    historyEl.appendChild(
      listRow({
        title: `${formatCAD(entry.price)} — ${entry.date}`,
        sub: `qty ${entry.quantity}${entry.notes ? " · " + entry.notes : ""}${
          older ? ` · was ${formatCAD(older.price)}` : " · first time logged"
        }`,
        chip,
        onClick: null,
      })
    );
  });
}

document.getElementById("log-price-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const form = e.target;
  const price = parseFloat(form.price.value);
  const quantity = parseFloat(form.quantity.value) || 1;
  const { previous, changePct } = DB.logPrice({
    itemId: state.itemId,
    price,
    quantity,
    date: form.date.value,
    notes: form.notes.value.trim(),
  });

  const banner = document.getElementById("price-change-banner");
  if (!previous) {
    banner.hidden = true;
  } else if (Math.abs(changePct) < 0.01) {
    banner.hidden = false;
    banner.className = "banner flat";
    banner.textContent = `Same price as last time (${formatCAD(previous.price)}).`;
  } else {
    banner.hidden = false;
    const up = changePct > 0;
    banner.className = "banner " + (up ? "up" : "down");
    banner.textContent = `${up ? "Up" : "Down"} ${Math.abs(changePct).toFixed(1)}% from ${formatCAD(
      previous.price
    )} last time.`;
  }

  form.reset();
  form.date.value = new Date().toISOString().slice(0, 10);
  showToast("Price logged");
  renderItemDetail(false);
});

document.getElementById("save-reminder-btn").addEventListener("click", () => {
  const days = document.getElementById("reminder-days-input").value;
  DB.updateItem(state.itemId, { reminderDays: days ? Number(days) : null });
  showToast("Reminder saved");
  render();
});

document.getElementById("item-toBuy-input").addEventListener("change", (e) => {
  DB.toggleToBuy(state.itemId, e.target.checked);
});

document.getElementById("item-taxable-input").addEventListener("change", (e) => {
  DB.updateItem(state.itemId, { taxable: e.target.checked });
});

// ---- Cart & tax ----
function renderCartStoreOptions() {
  const select = document.getElementById("cart-store-select");
  const stores = DB.getState().stores;
  const current = select.value;
  select.innerHTML = stores.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");
  if (current && stores.some((s) => s.id === current)) select.value = current;
}

document.getElementById("cart-store-select").addEventListener("change", renderCart);

function renderCart() {
  renderCartStoreOptions();
  const storeId = document.getElementById("cart-store-select").value;
  const el = document.getElementById("cart-items-list");
  el.innerHTML = "";
  if (!storeId) {
    el.innerHTML = '<p class="empty-state">Add a store first.</p>';
    updateCartTotals([]);
    return;
  }
  const items = DB.getItemsForStore(storeId);
  if (items.length === 0) {
    el.innerHTML = '<p class="empty-state">No products at this store yet.</p>';
    updateCartTotals([]);
    return;
  }

  for (const item of items) {
    const latest = DB.getLatestPrice(item.id);
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `
      <label class="checkbox-row" style="margin-bottom:8px;">
        <input type="checkbox" class="cart-check" data-item="${item.id}" ${item.toBuy ? "checked" : ""} />
        <strong>${escapeHtml(item.name)}</strong>${item.brand ? " · " + escapeHtml(item.brand) : ""}
      </label>
      <div class="form-grid">
        <label>Qty <input type="number" class="cart-qty" data-item="${item.id}" min="0" step="0.01" value="1" /></label>
        <label>Price (CAD) <input type="number" class="cart-price" data-item="${item.id}" min="0" step="0.01" value="${
      latest ? latest.price : ""
    }" /></label>
        <label class="checkbox-row full"><input type="checkbox" class="cart-taxable" data-item="${item.id}" ${
      item.taxable ? "checked" : ""
    } /> Taxable</label>
      </div>`;
    el.appendChild(row);
  }

  el.querySelectorAll("input").forEach((input) => input.addEventListener("input", recomputeCart));
  recomputeCart();
}

function recomputeCart() {
  const el = document.getElementById("cart-items-list");
  const rows = [];
  el.querySelectorAll(".cart-check").forEach((chk) => {
    if (!chk.checked) return;
    const id = chk.dataset.item;
    const qty = parseFloat(el.querySelector(`.cart-qty[data-item="${id}"]`).value) || 0;
    const price = parseFloat(el.querySelector(`.cart-price[data-item="${id}"]`).value) || 0;
    const taxable = el.querySelector(`.cart-taxable[data-item="${id}"]`).checked;
    rows.push({ quantity: qty, price, taxable });
  });
  updateCartTotals(rows);
}

function updateCartTotals(rows) {
  const totals = computeCartTotals(rows);
  document.getElementById("cart-subtotal").textContent = formatCAD(totals.subtotal);
  document.getElementById("cart-tps").textContent = formatCAD(totals.tps);
  document.getElementById("cart-tvq").textContent = formatCAD(totals.tvq);
  document.getElementById("cart-total").textContent = formatCAD(totals.total);
}

// ---- Settings ----
document.getElementById("export-btn").addEventListener("click", () => {
  const blob = new Blob([DB.exportJSON()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `grocery-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  try {
    DB.importJSON(text);
    showToast("Backup imported");
    showView("dashboard");
  } catch {
    showToast("That file couldn't be read as a backup.");
  }
  e.target.value = "";
});

// ---- Dialog close buttons ----
document.querySelectorAll("[data-close-dialog]").forEach((btn) => {
  btn.addEventListener("click", () => btn.closest("dialog").close());
});

// ---- Shared row builder ----
function listRow({ title, sub, chip, onClick }) {
  const row = document.createElement("div");
  row.className = "list-row";
  row.innerHTML = `
    <div class="row-main">
      <span class="row-title">${escapeHtml(title)}</span>
      <span class="row-sub">${escapeHtml(sub || "")}</span>
    </div>
    <div class="row-side">${chip ? `<span class="chip ${chip.cls}">${escapeHtml(chip.text)}</span>` : ""}</div>
  `;
  if (onClick) row.addEventListener("click", onClick);
  return row;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------------------------------------------------------------- init ----
showView("dashboard");
