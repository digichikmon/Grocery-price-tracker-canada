// Local "database" for the grocery tracker — everything lives in localStorage.
// Shape:
// {
//   stores:   [{ id, name, address, lat, lng, notes }]
//   items:    [{ id, storeId, name, brand, unit, notes, taxable, reminderDays, toBuy }]
//   prices:   [{ id, itemId, date, price, quantity, notes }]   // one entry per purchase/price check
// }

const STORAGE_KEY = "gpt_ca_v1";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultState() {
  return {
    stores: [
      { id: uid(), name: "Costco", address: "", lat: null, lng: null, notes: "" },
      { id: uid(), name: "Walmart", address: "", lat: null, lng: null, notes: "" },
      { id: uid(), name: "IGA", address: "", lat: null, lng: null, notes: "" },
    ],
    items: [],
    prices: [],
  };
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = defaultState();
    save(seeded);
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw);
    parsed.stores ||= [];
    parsed.items ||= [];
    parsed.prices ||= [];
    return parsed;
  } catch {
    const seeded = defaultState();
    save(seeded);
    return seeded;
  }
}

function save(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export const DB = {
  uid,

  getState() {
    return load();
  },

  // ---- Stores ----
  addStore({ name, address = "", lat = null, lng = null, notes = "" }) {
    const state = load();
    const store = { id: uid(), name, address, lat, lng, notes };
    state.stores.push(store);
    save(state);
    return store;
  },

  updateStore(storeId, patch) {
    const state = load();
    const store = state.stores.find((s) => s.id === storeId);
    if (!store) return null;
    Object.assign(store, patch);
    save(state);
    return store;
  },

  deleteStore(storeId) {
    const state = load();
    state.stores = state.stores.filter((s) => s.id !== storeId);
    state.items = state.items.filter((i) => i.storeId !== storeId);
    const itemIds = new Set(state.items.map((i) => i.id));
    state.prices = state.prices.filter((p) => itemIds.has(p.itemId));
    save(state);
  },

  // ---- Items (products at a store) ----
  addItem({ storeId, name, brand = "", unit = "", notes = "", taxable = false, reminderDays = null }) {
    const state = load();
    const item = { id: uid(), storeId, name, brand, unit, notes, taxable, reminderDays, toBuy: false };
    state.items.push(item);
    save(state);
    return item;
  },

  updateItem(itemId, patch) {
    const state = load();
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return null;
    Object.assign(item, patch);
    save(state);
    return item;
  },

  deleteItem(itemId) {
    const state = load();
    state.items = state.items.filter((i) => i.id !== itemId);
    state.prices = state.prices.filter((p) => p.itemId !== itemId);
    save(state);
  },

  toggleToBuy(itemId, value) {
    return this.updateItem(itemId, { toBuy: value });
  },

  // ---- Prices (one entry per purchase / price check) ----
  // Returns { entry, previous, changeAmount, changePct } so the caller can
  // show "up 8% from $3.49" immediately after logging a price.
  logPrice({ itemId, price, quantity = 1, date = new Date().toISOString().slice(0, 10), notes = "" }) {
    const state = load();
    const history = state.prices
      .filter((p) => p.itemId === itemId)
      .sort((a, b) => a.date.localeCompare(b.date));
    const previous = history.length ? history[history.length - 1] : null;

    const entry = { id: uid(), itemId, date, price, quantity, notes };
    state.prices.push(entry);
    save(state);

    let changeAmount = null;
    let changePct = null;
    if (previous) {
      changeAmount = price - previous.price;
      changePct = previous.price !== 0 ? (changeAmount / previous.price) * 100 : null;
    }
    return { entry, previous, changeAmount, changePct };
  },

  getPriceHistory(itemId) {
    const state = load();
    return state.prices
      .filter((p) => p.itemId === itemId)
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  getLatestPrice(itemId) {
    const history = this.getPriceHistory(itemId);
    return history.length ? history[history.length - 1] : null;
  },

  deletePriceEntry(entryId) {
    const state = load();
    state.prices = state.prices.filter((p) => p.id !== entryId);
    save(state);
  },

  // ---- Derived / convenience views ----
  getItemsForStore(storeId) {
    return load().items.filter((i) => i.storeId === storeId);
  },

  getStore(storeId) {
    return load().stores.find((s) => s.id === storeId) || null;
  },

  getItem(itemId) {
    return load().items.find((i) => i.id === itemId) || null;
  },

  // Reminder: due when (last purchase date + reminderDays) <= today.
  getReminderStatus(itemId) {
    const item = this.getItem(itemId);
    if (!item || !item.reminderDays) return { hasReminder: false, due: false, dueDate: null };
    const latest = this.getLatestPrice(itemId);
    if (!latest) return { hasReminder: true, due: true, dueDate: null }; // never bought — always due
    const last = new Date(latest.date + "T00:00:00");
    const due = new Date(last);
    due.setDate(due.getDate() + Number(item.reminderDays));
    const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
    return { hasReminder: true, due: today >= due, dueDate: due.toISOString().slice(0, 10) };
  },

  getAllDueReminders() {
    return load()
      .items.filter((i) => i.reminderDays)
      .map((i) => ({ item: i, status: this.getReminderStatus(i.id) }))
      .filter((r) => r.status.due);
  },

  exportJSON() {
    return JSON.stringify(load(), null, 2);
  },

  importJSON(json) {
    const parsed = JSON.parse(json);
    parsed.stores ||= [];
    parsed.items ||= [];
    parsed.prices ||= [];
    save(parsed);
  },
};
