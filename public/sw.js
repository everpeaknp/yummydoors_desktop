self.addEventListener("push", (event) => {
  const payload = event.data ? event.data.json() : {};
  const title = payload.title || "YummyDoors update";
  const body = payload.body || "You have a new notification.";
  const url = payload.deep_link || "/orders";
  const tag = payload.tag || "yummydoors-order-update";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: {
        url,
      },
      icon: "/Yummy_Doors-Png.png",
      badge: "/Yummy_Doors-Png.png",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/orders";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
      return undefined;
    }),
  );
});
