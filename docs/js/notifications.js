// Native repurchase reminders via the Capacitor Local Notifications plugin.
// On Android/iOS this schedules a real OS notification for the due date.
// In a plain browser, local-notification scheduling isn't reliably
// supported, so this quietly no-ops there — the in-app "due" list on the
// dashboard (js/db.js + js/app.js) already covers that case everywhere.

function getPlugin() {
  return window.Capacitor?.isNativePlatform?.() ? window.Capacitor.Plugins.LocalNotifications : null;
}

// Deterministic 31-bit notification id derived from the item id string.
function notificationIdFor(itemId) {
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) {
    hash = (hash * 31 + itemId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483647;
}

let permissionRequested = false;
async function ensurePermission(plugin) {
  if (permissionRequested) return true;
  const perms = await plugin.checkPermissions();
  if (perms.display !== "granted") {
    const req = await plugin.requestPermissions();
    if (req.display !== "granted") return false;
  }
  permissionRequested = true;
  return true;
}

// dueDate: "YYYY-MM-DD" or null to just cancel any existing notification.
export async function scheduleReminderNotification(item, dueDate) {
  const plugin = getPlugin();
  if (!plugin) return;
  const id = notificationIdFor(item.id);

  await plugin.cancel({ notifications: [{ id }] });
  if (!dueDate) return;

  const at = new Date(dueDate + "T09:00:00");
  if (at.getTime() <= Date.now()) return; // already due — dashboard covers it, don't schedule in the past

  if (!(await ensurePermission(plugin))) return;

  await plugin.schedule({
    notifications: [
      {
        id,
        title: "Time to restock",
        body: `${item.name}${item.brand ? " · " + item.brand : ""} is due for a repurchase.`,
        schedule: { at },
      },
    ],
  });
}

export async function cancelReminderNotification(item) {
  const plugin = getPlugin();
  if (!plugin) return;
  await plugin.cancel({ notifications: [{ id: notificationIdFor(item.id) }] });
}
