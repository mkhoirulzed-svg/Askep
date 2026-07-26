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

  function syncDiagnosisDetail() {
    if (!document.body.classList.contains("page-diagnosis-detail")) return;

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

    /*
     * Listener halaman lama memblokir selectstart pada fase bubble.
     * Menghentikan propagasi di fase capture membuat seleksi bawaan browser
     * tetap berjalan tanpa menjalankan pemblokir lama tersebut.
     */
    event.stopPropagation();
  }

  function init() {
    ensureStyle();
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
