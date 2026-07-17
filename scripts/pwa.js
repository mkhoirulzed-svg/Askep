if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        new URL("../sw.js", document.currentScript.src),
        {
          scope: new URL("../", document.currentScript.src).pathname
        }
      );

      console.log(
        "Service Worker ASKEP aktif:",
        registration.scope
      );
    } catch (error) {
      console.error(
        "Service Worker gagal didaftarkan:",
        error
      );
    }
  });
}
