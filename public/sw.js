// Glade Deck — Service Worker
// Handles Web Push notifications

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Glade Deck", body: event.data.text() };
  }

  const options = {
    body: payload.body ?? "",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: payload.tag ?? "glade-alert",
    data: payload.url ? { url: payload.url } : undefined,
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/dashboard";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => c.url === url);
        if (existing) return existing.focus();
        return clients.openWindow(url);
      })
  );
});
