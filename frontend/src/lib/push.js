const API = process.env.REACT_APP_BACKEND_URL + "/api";

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((ch) => ch.charCodeAt(0)));
}

const authHeaders = () => {
  const token = localStorage.getItem("manre_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && window.isSecureContext;

export async function currentPushState() {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg && (await reg.pushManager.getSubscription());
  return sub ? "on" : "off";
}

export async function enablePush() {
  if (!pushSupported()) throw new Error("Browser ini belum mendukung notifikasi push");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Izin notifikasi ditolak");

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  const res = await fetch(`${API}/push/public-key`);
  if (!res.ok) throw new Error("Gagal ambil kunci push");
  const { publicKey } = await res.json();

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const saved = await fetch(`${API}/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  });
  if (!saved.ok) throw new Error("Gagal menyimpan langganan push");
  return true;
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = reg && (await reg.pushManager.getSubscription());
  if (!sub) return true;
  await fetch(`${API}/push/subscribe`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    credentials: "include",
    body: JSON.stringify({ endpoint: sub.endpoint }),
  });
  await sub.unsubscribe();
  return true;
}
