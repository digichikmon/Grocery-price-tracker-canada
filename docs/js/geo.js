// Location helpers — "which store am I at, and what's on my list there?"
// Uses the Capacitor Geolocation plugin so the same code gets real native
// GPS + permission prompts on Android/iOS, and falls back to the browser's
// own Geolocation API automatically when running as a plain website (the
// plugin's web implementation wraps navigator.geolocation for us).

function getGeolocationPlugin() {
  return window.Capacitor?.Plugins?.Geolocation || null;
}

// Haversine distance in kilometres between two lat/lng points.
export function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export async function getCurrentPosition() {
  const Geolocation = getGeolocationPlugin();
  if (!Geolocation) {
    // No Capacitor runtime on the page at all — plain browser fallback.
    if (!("geolocation" in navigator)) {
      throw new Error("Geolocation isn't available on this device/browser.");
    }
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  const perms = await Geolocation.checkPermissions();
  if (perms.location !== "granted" && perms.coarseLocation !== "granted") {
    const req = await Geolocation.requestPermissions();
    if (req.location !== "granted" && req.coarseLocation !== "granted") {
      throw new Error("Location permission was denied.");
    }
  }
  const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}

// Given the user's position and the store list, return stores sorted by
// distance (only stores that have saved coordinates are considered).
export function nearestStores(userPos, stores) {
  return stores
    .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
    .map((s) => ({ store: s, km: distanceKm(userPos.lat, userPos.lng, s.lat, s.lng) }))
    .sort((a, b) => a.km - b.km);
}
