(function () {
  "use strict";

  const STYLE_ID = "detail-copy-actions-style";
  const COPY_CLASS = "detail-copy-actions";
  const DETAIL_PAGE_SELECTOR = ".page-diagnosis-detail, .page-slki-detail, .page-siki-detail";

  function isDetailPage() {
    return Boolean(document.body?.matches(DETAIL_PAGE_SELECTOR));
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .askep-upgrade-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(15,23,42,.58);backdrop-filter:blur(5px)}
      .askep-upgrade-overlay[hidden]{display:none!important}
      .askep-upgrade-modal{position:relative;width:min(100%,420px);max-height:min(90vh,760px);overflow:auto;padding:26px 22px 22px;border-radius:24px;background:#fff;color:#0f172a;box-shadow:0 25px 80px rgba(15,23,42,.28);font-family:inherit}
      .askep-upgrade-close{position:absolute;top:12px;right:12px;width:36px;height:36px;border:0;border-radius:12px;background:#f1f5f9;color:#64748b;font-size:16px;cursor:pointer}
      .askep-upgrade-icon{display:flex;align-items:center;justify-content:center;width:54px;height:54px;margin:0 auto 12px;border-radius:17px;background:linear-gradient(135deg,#fef3c7,#fde68a);color:#b45309;font-size:22px}
      .askep-upgrade-eyebrow{text-align:center;margin:0;color:#b45309;font-size:10px;font-weight:900;letter-spacing:.12em}
      .askep-upgrade-modal h2{text-align:center;margin:6px 0 8px;font-size:21px;font-weight:900}
      .askep-upgrade-desc{text-align:center;margin:0;color:#64748b;font-size:12px;line-height:1.6}
      .askep-upgrade-price{display:flex;flex-direction:column;align-items:center;gap:3px;margin:18px 0;padding:14px;border:1px solid #fde68a;border-radius:16px;background:#fffbeb}
      .askep-upgrade-price strong{color:#b45309;font-size:28px;font-weight:900}
      .askep-upgrade-price span{color:#92400e;font-size:11px;font-weight:700}
      .askep-upgrade-benefits{display:grid;gap:9px;margin:0 0 18px;padding:0;list-style:none;font-size:12px;color:#334155}
      .askep-upgrade-benefits li{display:flex;gap:9px;align-items:flex-start}
      .askep-upgrade-benefits i{color:#16a34a;margin-top:2px}
      .askep-upgrade-actions{display:grid;gap:8px}
      .askep-upgrade-primary,.askep-upgrade-secondary{width:100%;min-height:46px;border:0;border-radius:14px;font:inherit;font-size:13px;font-weight:800;cursor:pointer}
      .askep-upgrade-primary{background:#2563eb;color:#fff}
      .askep-upgrade-secondary{background:#f1f5f9;color:#475569}
      .askep-upgrade-footnote{text-align:center;margin:12px 0 0;color:#94a3b8;font-size:10px}
      .detail-copy-actions {
        position: relative;
        z-index: 2;
        display: flex;
        width: min(100%, 220px);
        margin-top: 14px;
      }

      .detail-copy-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 44px;
        gap: 8px;
        padding: 10px 14px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 15px;
        background: rgba(255, 255, 255, 0.16);
        color: #fff;
        font: inherit;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }

      .detail-copy-button:hover {
        background: rgba(255, 255, 255, 0.23);
      }

      .page-diagnosis-detail .action-row.detail-single-action {
        grid-template-columns: minmax(0, 220px);
      }

      /* Seluruh teks isi detail dapat ditekan lama, diseleksi, dan disalin. */
      :is(.page-diagnosis-detail, .page-slki-detail, .page-siki-detail)
      :is(#heroArea, #contentArea, #detailArea, .hero-card, .card, .detail-card, .meta-card, .related-card) {
        -webkit-user-select: text !important;
        user-select: text !important;
      }

      :is(.page-diagnosis-detail, .page-slki-detail, .page-siki-detail)
      :is(#heroArea, #contentArea, #detailArea) *:not(button):not(input):not(textarea):not(select) {
        -webkit-user-select: text !important;
        user-select: text !important;
      }

      :is(.page-diagnosis-detail, .page-slki-detail, .page-siki-detail)
      :is(button, input, textarea, select, .bottom-nav, .bottom-nav *) {
        -webkit-user-select: none !important;
        user-select: none !important;
      }

      @media (max-width: 380px) {
        .detail-copy-actions,
        .page-diagnosis-detail .action-row.detail-single-action {
          width: 100%;
          grid-template-columns: 1fr;
        }
      }
    `;

    document.head.appendChild(style);
  }


  const PREMIUM_API_BASE = "https://askep.mkhoirulzed.workers.dev";
  let premiumStatusPromise = null;
  let premiumStatus = null;
  let premiumCopyBypass = false;
  let upgradeModal = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src="' + src + '"]')) {
        const existing = document.querySelector('script[src="' + src + '"]');
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => { script.dataset.loaded = "true"; resolve(); };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function checkPremiumStatus() {
    if (premiumStatus !== null) return premiumStatus;
    if (premiumStatusPromise) return premiumStatusPromise;

    premiumStatusPromise = (async () => {
      try {
        if (!window.firebase) {
          await loadScript("https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js");
        }
        if (!window.firebase?.auth) {
          await loadScript("https://www.gstatic.com/firebasejs/10.12.4/firebase-auth-compat.js");
        }
        const firebaseConfig = {
          apiKey: "AIzaSyChTj0cPYydn-VRaCnYXX4lBKiGmcIIb8Q",
          authDomain: "sdki-a3960.firebaseapp.com",
          projectId: "sdki-a3960",
          storageBucket: "sdki-a3960.firebasestorage.app",
          messagingSenderId: "577189478908",
          appId: "1:577189478908:web:efe83142bb88bbc5b07279",
          measurementId: "G-845T8J7J98"
        };
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        const auth = firebase.auth();
        const user = await new Promise((resolve, reject) => {
          let unsubscribe = null;
          const timer = setTimeout(() => {
            if (unsubscribe) unsubscribe();
            reject(new Error("Timeout memeriksa sesi login"));
          }, 8000);
          unsubscribe = auth.onAuthStateChanged(value => {
            clearTimeout(timer);
            if (unsubscribe) unsubscribe();
            resolve(value || null);
          }, error => {
            clearTimeout(timer);
            if (unsubscribe) unsubscribe();
            reject(error);
          });
        });
        if (!user) {
          premiumStatus = false;
          return false;
        }
        const token = await user.getIdToken();
        const response = await fetch(PREMIUM_API_BASE + "/api/account/status", {
          method: "GET",
          headers: { Authorization: "Bearer " + token }
        });
        if (!response.ok) throw new Error("Status akun tidak dapat diverifikasi");
        const data = await response.json();
        premiumStatus = data?.success === true ? Boolean(data.premium) : null;
        return premiumStatus;
      } catch (error) {
        console.warn("[ASKEP Premium] Status belum dapat diverifikasi:", error);
        premiumStatus = null;
        return null;
      } finally {
        premiumStatusPromise = null;
      }
    })();

    return premiumStatusPromise;
  }

  function ensureUpgradeModal() {
    if (upgradeModal) return upgradeModal;
    upgradeModal = document.createElement("div");
    upgradeModal.className = "askep-upgrade-overlay";
    upgradeModal.hidden = true;
    upgradeModal.innerHTML = `
      <div class="askep-upgrade-modal" role="dialog" aria-modal="true" aria-labelledby="askepUpgradeTitle">
        <button class="askep-upgrade-close" type="button" aria-label="Tutup"><i class="fa-solid fa-xmark"></i></button>
        <div class="askep-upgrade-icon"><i class="fa-solid fa-crown"></i></div>
        <p class="askep-upgrade-eyebrow">ASKEP PREMIUM</p>
        <h2 id="askepUpgradeTitle">Buka fitur lengkap</h2>
        <p class="askep-upgrade-desc">Fitur salin hasil dan fitur premium lainnya tersedia untuk pengguna Premium.</p>
        <div class="askep-upgrade-price"><strong>Rp59.000</strong><span>Lifetime · sekali bayar</span></div>
        <ul class="askep-upgrade-benefits">
          <li><i class="fa-solid fa-check"></i> Copy seluruh hasil dari aplikasi</li>
          <li><i class="fa-solid fa-check"></i> Database SDKI, SLKI, SIKI lebih lengkap</li>
          <li><i class="fa-solid fa-check"></i> AI hingga 50 pertanyaan per hari</li>
          <li><i class="fa-solid fa-check"></i> Generator ASKEP dan SOAP</li>
        </ul>
        <div class="askep-upgrade-actions">
          <button class="askep-upgrade-primary" type="button">Upgrade Premium</button>
          <button class="askep-upgrade-secondary" type="button">Nanti saja</button>
        </div>
        <p class="askep-upgrade-footnote">Metode pembayaran sedang disiapkan.</p>
      </div>`;
    document.body.appendChild(upgradeModal);
    const close = () => { upgradeModal.hidden = true; };
    upgradeModal.querySelector(".askep-upgrade-close").addEventListener("click", close);
    upgradeModal.querySelector(".askep-upgrade-secondary").addEventListener("click", close);
    upgradeModal.addEventListener("click", event => {
      if (event.target === upgradeModal) close();
    });
    upgradeModal.querySelector(".askep-upgrade-primary").addEventListener("click", () => {
      const path = location.pathname.includes("/pages/") ? "premium.html" : "pages/premium.html";
      location.href = new URL(path, location.href).href;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && upgradeModal && !upgradeModal.hidden) close();
    });
    return upgradeModal;
  }

  function showUpgradeModal(message) {
    const modal = ensureUpgradeModal();
    if (message) modal.querySelector(".askep-upgrade-desc").textContent = message;
    modal.hidden = false;
    modal.querySelector(".askep-upgrade-secondary").focus();
  }

  function isPremiumAction(element) {
    if (!element) return false;
    if (element.matches?.(".detail-copy-button, .chat-copy-btn, #copySoapButton, #copyTableButton, #copyBtn, button[onclick*='copyDiagnosis']")) return true;
    if (element.matches?.("#generateButton, #regenerateButton, [data-download-docx], [data-download-pdf], [data-print]")) return true;
    if (element.matches?.("a[href]")) {
      const href = element.getAttribute("href") || "";
      return /(?:^|\/)askep-lengkap\.html(?:[?#]|$)|(?:^|\/)soap\.html(?:[?#]|$)/i.test(href);
    }
    if (element.tagName !== "BUTTON") return false;
    const label = [
      element.textContent,
      element.getAttribute("aria-label"),
      element.getAttribute("title")
    ].filter(Boolean).join(" ");
    return /\b(salin|copy)\b/i.test(label);
  }

  function captureCopyAction(event) {
    if (premiumCopyBypass) return;
    const target = event.target?.closest?.("button, a");
    if (!isPremiumAction(target)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    checkPremiumStatus().then(status => {
      if (status === true) {
        premiumCopyBypass = true;
        target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
        premiumCopyBypass = false;
        return;
      }
      showUpgradeModal(status === null
        ? "Status Premium belum dapat diverifikasi. Coba lagi atau masuk ke halaman Premium."
        : "Fitur ini tersedia untuk pengguna Premium. Upgrade untuk membuka fitur lengkap ASKEP.");
    }).catch(() => showUpgradeModal("Status Premium belum dapat diverifikasi. Silakan coba lagi."));
  }

  function normalizeCopiedText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .split("\n")
      .map(line => line.trim())
      .filter((line, index, lines) => line || (index > 0 && lines[index - 1]))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function getVisibleText(container, options = {}) {
    if (!container) return "";

    const clone = container.cloneNode(true);
    clone.querySelectorAll([
      ".detail-copy-actions",
      ".loading",
      ".bottom-nav",
      "button",
      "script",
      "style"
    ].join(",")).forEach(element => element.remove());

    if (options.removeHero) {
      clone.querySelectorAll(".hero-card").forEach(element => element.remove());
    }

    return normalizeCopiedText(clone.innerText || clone.textContent || "");
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  async function copyText(text, successMessage) {
    const cleanText = normalizeCopiedText(text);
    if (!cleanText) return;

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(cleanText);
      } else if (!fallbackCopy(cleanText)) {
        throw new Error("Perintah salin tidak didukung.");
      }

      window.alert(successMessage);
    } catch (error) {
      console.error("Gagal menyalin detail:", error);
      window.alert("Teks belum dapat disalin. Silakan coba kembali.");
    }
  }

  function createCopyAction(hero, getText, successMessage) {
    if (!hero || hero.querySelector(`.${COPY_CLASS}`)) return;

    const row = document.createElement("div");
    row.className = COPY_CLASS;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "detail-copy-button native-click";
    button.innerHTML = '<i class="fa-regular fa-copy" aria-hidden="true"></i><span>Salin</span>';
    button.addEventListener("click", () => copyText(getText(), successMessage));

    row.appendChild(button);
    hero.appendChild(row);
  }

  function reorderDesktopClinicalSections() {
    const column = document.querySelector(
      ".page-diagnosis-detail .wide-detail-columns .wide-detail-column:first-child"
    );
    if (!column) return;

    const sections = Array.from(column.children);
    const mayorSection = sections.find(section =>
      section.querySelector(".section-title")?.textContent?.includes("Gejala dan Tanda Mayor")
    );
    const minorSection = sections.find(section =>
      section.querySelector(".section-title")?.textContent?.includes("Gejala dan Tanda Minor")
    );

    if (mayorSection && minorSection && mayorSection.compareDocumentPosition(minorSection) & Node.DOCUMENT_POSITION_PRECEDING) {
      column.insertBefore(mayorSection, minorSection);
    }
  }

  function syncDiagnosisDetail() {
    if (!document.body.classList.contains("page-diagnosis-detail")) return;

    reorderDesktopClinicalSections();

    const actionRow = document.querySelector("#heroArea .action-row");
    if (!actionRow) return;

    const quickAskepButton = actionRow.querySelector(
      'button[onclick*="goQuickAskep"], a[href*="quick-askep"]'
    );

    if (quickAskepButton) quickAskepButton.remove();
    actionRow.classList.add("detail-single-action");
  }

  function syncSlkiDetail() {
    if (!document.body.classList.contains("page-slki-detail")) return;

    const hero = document.querySelector("#heroArea .hero-card");
    const detailArea = document.getElementById("detailArea");
    if (!hero || !detailArea) return;

    createCopyAction(
      hero,
      () => {
        const title = normalizeCopiedText(
          hero.querySelector(".hero-title")?.textContent || "Luaran SLKI"
        );
        const detail = getVisibleText(detailArea);
        return `SLKI\n${title}\n\n${detail}`;
      },
      "Detail SLKI berhasil disalin."
    );
  }

  function syncSikiDetail() {
    if (!document.body.classList.contains("page-siki-detail")) return;

    const detailArea = document.getElementById("detailArea");
    const hero = detailArea?.querySelector(".hero-card");
    if (!hero || !detailArea) return;

    createCopyAction(
      hero,
      () => {
        const title = normalizeCopiedText(
          hero.querySelector(".hero-title")?.textContent || "Intervensi SIKI"
        );
        const detail = getVisibleText(detailArea, { removeHero: true });
        return `SIKI\n${title}\n\n${detail}`;
      },
      "Detail SIKI berhasil disalin."
    );
  }

  function syncActions() {
    syncDiagnosisDetail();
    syncSlkiDetail();
    syncSikiDetail();
  }

  function allowNativeTextSelection(event) {
    if (!isDetailPage()) return;

    const interactive = event.target.closest(
      "button, input, textarea, select, .bottom-nav, .global-guide-menu-wrapper, .guide-menu-wrapper"
    );

    if (interactive) return;

    event.stopPropagation();
  }

  function init() {
    ensureStyle();
    document.addEventListener("click", captureCopyAction, true);
    syncActions();

    document.addEventListener("selectstart", allowNativeTextSelection, true);

    const observer = new MutationObserver(syncActions);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
