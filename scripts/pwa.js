/* Registrasi PWA ASKEP — simpan URL script sebelum callback load. */
(function () {
  "use strict";
  if (!("serviceWorker" in navigator)) return;

  const scriptUrl = document.currentScript
    ? document.currentScript.src
    : new URL("./scripts/pwa.js", window.location.href).href;
  const workerUrl = new URL("../sw.js", scriptUrl);
  const appScope = new URL("../", scriptUrl).pathname;

  window.addEventListener("load", async function () {
    try {
      const registration = await navigator.serviceWorker.register(
        workerUrl.href,
        { scope: appScope, updateViaCache: "none" }
      );
      await registration.update();
      console.info("Service Worker ASKEP aktif:", registration.scope);
    } catch (error) {
      console.error("Service Worker ASKEP gagal didaftarkan:", error);
    }
  }, { once: true });
})();
