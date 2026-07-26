(function () {
  "use strict";

  const STYLE_ID = "askep-global-guide-style";
  const WRAPPER_CLASS = "global-guide-menu-wrapper";

  function isRootPage() {
    const path = window.location.pathname.replace(/\/+$/, "");
    const file = path.split("/").pop() || "";
    return !file || file === "Askep" || file === "index.html";
  }

  function pageHref(fileName) {
    return isRootPage() ? `pages/${fileName}` : fileName;
  }

  function currentFile() {
    return window.location.pathname.split("/").pop() || "index.html";
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .global-guide-menu-wrapper{position:relative;z-index:1200;flex:0 0 auto}
      .global-guide-menu-button{position:relative;display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;min-width:44px;padding:0;overflow:hidden;border:0;border-radius:15px;background:var(--card,#fff);box-shadow:var(--shadow-sm,0 4px 14px rgba(15,23,42,.07));color:var(--primary,#2563eb);font:inherit;cursor:pointer;touch-action:manipulation}
      .global-guide-menu-button.active{background:var(--primary-light,#eff6ff);color:var(--primary,#2563eb)}
      .global-guide-dropdown{position:absolute;top:calc(100% + 10px);right:0;width:min(290px,calc(100vw - 32px));padding:8px;border:1px solid var(--border,#e2e8f0);border-radius:18px;background:var(--card,#fff);box-shadow:var(--shadow-md,0 10px 28px rgba(15,23,42,.12));color:var(--text,#0f172a);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(-8px) scale(.98);transform-origin:top right;transition:opacity .2s ease,visibility .2s ease,transform .2s ease}
      .global-guide-dropdown.show{opacity:1;visibility:visible;pointer-events:auto;transform:translateY(0) scale(1)}
      .global-guide-dropdown-header{padding:10px 12px 8px}.global-guide-dropdown-title{margin:0;color:var(--text,#0f172a);font-size:14px;font-weight:800}.global-guide-dropdown-subtitle{margin:3px 0 0;color:var(--muted,#64748b);font-size:10px;line-height:1.5}.global-guide-dropdown-divider{height:1px;margin:5px 6px;background:var(--border,#e2e8f0)}
      .global-guide-menu-list{display:flex;flex-direction:column;gap:3px}.global-guide-menu-item{position:relative;display:flex;align-items:center;min-height:50px;gap:12px;padding:9px 10px;overflow:hidden;border-radius:13px;color:var(--text,#0f172a);text-decoration:none}.global-guide-menu-item:hover,.global-guide-menu-item:focus-visible,.global-guide-menu-item.current{background:var(--primary-light,#eff6ff)}
      .global-guide-menu-icon{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;flex:0 0 34px;border-radius:11px;background:var(--primary-light,#eff6ff);color:var(--primary,#2563eb);font-size:14px}.global-guide-menu-content{min-width:0;flex:1}.global-guide-menu-label{display:block;font-size:13px;font-weight:700;line-height:1.3}.global-guide-menu-description{display:block;margin-top:2px;color:var(--muted,#64748b);font-size:9px;line-height:1.45}.global-guide-menu-chevron{flex:0 0 auto;color:var(--muted,#64748b);font-size:10px}
      .global-guide-floating{position:fixed;top:max(16px,env(safe-area-inset-top));right:16px;z-index:1500}
      html[data-resolved-theme="dark"] .global-guide-dropdown{border-color:var(--border);background:var(--card);color:var(--text)}
      @media(max-width:380px){.global-guide-dropdown{position:fixed;top:72px;right:16px;left:16px;width:auto}}
    `;
    document.head.appendChild(style);
  }

  function menuItem(file, icon, label, description) {
    const active = currentFile() === file;
    return `<a href="${pageHref(file)}" class="global-guide-menu-item native-click${active ? " current" : ""}"${active ? ' aria-current="page"' : ""}><span class="global-guide-menu-icon"><i class="${icon}" aria-hidden="true"></i></span><span class="global-guide-menu-content"><span class="global-guide-menu-label">${label}</span><span class="global-guide-menu-description">${description}</span></span><i class="fa-solid ${active ? "fa-check" : "fa-chevron-right"} global-guide-menu-chevron" aria-hidden="true"></i></a>`;
  }

  function createMenu() {
    const wrapper = document.createElement("div");
    wrapper.className = WRAPPER_CLASS;
    wrapper.innerHTML = `<button class="global-guide-menu-button native-click" type="button" aria-label="Buka menu aplikasi" aria-haspopup="true" aria-expanded="false"><i class="fa-solid fa-gear" aria-hidden="true"></i></button><div class="global-guide-dropdown" aria-hidden="true"><div class="global-guide-dropdown-header"><p class="global-guide-dropdown-title">Menu Aplikasi</p><p class="global-guide-dropdown-subtitle">Pengaturan, petunjuk, dan informasi aplikasi.</p></div><div class="global-guide-dropdown-divider"></div><div class="global-guide-menu-list">${menuItem("pengaturan.html","fa-solid fa-sliders","Pengaturan","Sesuaikan tema dan tampilan aplikasi.")}${menuItem("petunjuk.html","fa-regular fa-circle-question","Petunjuk","Pelajari cara menggunakan aplikasi.")}${menuItem("kontak.html","fa-regular fa-envelope","Kontak","Hubungi pengembang aplikasi.")}${menuItem("privasi.html","fa-solid fa-shield-halved","Kebijakan Privasi","Informasi penggunaan dan perlindungan data.")}</div></div>`;

    const button = wrapper.querySelector(".global-guide-menu-button");
    const dropdown = wrapper.querySelector(".global-guide-dropdown");
    const setOpen = open => {
      dropdown.classList.toggle("show", open);
      button.classList.toggle("active", open);
      button.setAttribute("aria-expanded", String(open));
      dropdown.setAttribute("aria-hidden", String(!open));
    };

    button.addEventListener("click", event => {
      event.stopPropagation();
      setOpen(!dropdown.classList.contains("show"));
    });
    dropdown.addEventListener("click", event => event.stopPropagation());
    document.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        setOpen(false);
        button.focus();
      }
    });

    return wrapper;
  }

  function existingMenuPresent() {
    return Boolean(document.getElementById("guideMenuButton") || document.querySelector(`.${WRAPPER_CLASS}`));
  }

  function findHeaderRow() {
    const selectors = [
      ".detail-topbar",
      ".info-topbar",
      ".petunjuk-topbar",
      ".chat-topbar",
      ".tool-topbar",
      ".topbar",
      ".header-row",
      ".page-topbar",
      ".toolbar",
      "header .header-content",
      "header"
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  function replaceableRightAction(headerRow) {
    const directActions = Array.from(headerRow.children).filter(element => element.matches("a,button,.icon-btn,.nav-btn"));

    for (let index = directActions.length - 1; index >= 0; index -= 1) {
      const element = directActions[index];
      const label = `${element.getAttribute("aria-label") || ""} ${element.title || ""}`.toLowerCase();
      const replaceableIcon = element.querySelector(".fa-magnifying-glass,.fa-house,.fa-ellipsis-vertical,.fa-bars");
      const isBack = element.querySelector(".fa-arrow-left,.fa-chevron-left") || label.includes("kembali");
      const preserveAction = element.matches("#clearChatBtn") || label.includes("hapus percakapan");

      if (!isBack && !preserveAction && (replaceableIcon || /cari|search|home|menu/.test(label))) return element;
    }
    return null;
  }

  function mountMenu() {
    if (existingMenuPresent()) return true;
    ensureStyle();

    const wrapper = createMenu();
    const headerRow = findHeaderRow();

    if (headerRow) {
      const replaceable = replaceableRightAction(headerRow);
      if (replaceable) replaceable.replaceWith(wrapper);
      else headerRow.appendChild(wrapper);
      return true;
    }

    wrapper.classList.add("global-guide-floating");
    document.body.appendChild(wrapper);
    return true;
  }

  function init() {
    mountMenu();
    const observer = new MutationObserver(() => {
      if (!existingMenuPresent()) mountMenu();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 8000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
