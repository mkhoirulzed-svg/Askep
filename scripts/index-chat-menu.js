(function () {
  "use strict";

  function isHomePage() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const file = path.split("/").pop() || "";
    return !file || file === "Askep" || file === "index.html";
  }

  function registerServiceWorker() {
    if (!isHomePage() || !("serviceWorker" in navigator)) return;

    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none"
        });

        await registration.update();
        console.log("Service Worker ASKEP aktif:", registration.scope);
      } catch (error) {
        console.error("Service Worker gagal didaftarkan:", error);
      }
    }, { once: true });
  }

  function loadInstallPrompt() {
    if (!isHomePage()) return;

    if (!document.querySelector('link[href="styles/pwa-install.css"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "styles/pwa-install.css";
      document.head.appendChild(link);
    }

    if (!document.querySelector('script[src="scripts/pwa-install.js"]')) {
      const script = document.createElement("script");
      script.src = "scripts/pwa-install.js";
      script.defer = true;
      document.head.appendChild(script);
    }
  }

  function addChatCard() {
    if (!isHomePage()) return;

    const grid = document.querySelector(".quick-grid");
    if (!grid || grid.querySelector('[href="pages/chat.html"]')) return;

    const card = document.createElement("a");
    card.href = "pages/chat.html";
    card.className = "quick-card native-click";
    card.setAttribute("aria-label", "Buka Chat AI ASKEP");
    card.innerHTML = `
      <div class="quick-icon">
        <i class="fa-solid fa-user-nurse" aria-hidden="true"></i>
      </div>
      <div class="quick-label">Chat AI</div>
    `;

    const generatorCard = grid.querySelector('[href="pages/generator.html"]');
    if (generatorCard) grid.insertBefore(card, generatorCard);
    else grid.appendChild(card);
  }

  registerServiceWorker();
  loadInstallPrompt();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addChatCard, { once: true });
  } else {
    addChatCard();
  }
})();
