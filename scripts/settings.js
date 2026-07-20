(function () {
  "use strict";

  const STORAGE_KEY = "askep_ui_settings";

  const DEFAULTS = Object.freeze({
    theme: "light",
    accent: "blue",
    fontSize: "normal",
    density: "comfortable",
    reduceMotion: false,
  });

  const VALID_VALUES = Object.freeze({
    theme: ["light", "dark", "system"],
    accent: ["blue", "green", "purple", "teal", "orange"],
    fontSize: ["small", "normal", "large"],
    density: ["comfortable", "compact"],
  });

  const PALETTES = Object.freeze({
    blue: {
      light: {
        primary: "#2563eb",
        primaryDark: "#1d4ed8",
        primarySoft: "#dbeafe",
        primaryLight: "#eff6ff",
      },
      dark: {
        primary: "#60a5fa",
        primaryDark: "#3b82f6",
        primarySoft: "#172554",
        primaryLight: "#111f3d",
      },
    },
    green: {
      light: {
        primary: "#16a34a",
        primaryDark: "#15803d",
        primarySoft: "#dcfce7",
        primaryLight: "#f0fdf4",
      },
      dark: {
        primary: "#4ade80",
        primaryDark: "#22c55e",
        primarySoft: "#15351f",
        primaryLight: "#10291a",
      },
    },
    purple: {
      light: {
        primary: "#7c3aed",
        primaryDark: "#6d28d9",
        primarySoft: "#ede9fe",
        primaryLight: "#f5f3ff",
      },
      dark: {
        primary: "#a78bfa",
        primaryDark: "#8b5cf6",
        primarySoft: "#2e2052",
        primaryLight: "#241a3f",
      },
    },
    teal: {
      light: {
        primary: "#0f766e",
        primaryDark: "#115e59",
        primarySoft: "#ccfbf1",
        primaryLight: "#f0fdfa",
      },
      dark: {
        primary: "#2dd4bf",
        primaryDark: "#14b8a6",
        primarySoft: "#123d39",
        primaryLight: "#102f2d",
      },
    },
    orange: {
      light: {
        primary: "#ea580c",
        primaryDark: "#c2410c",
        primarySoft: "#ffedd5",
        primaryLight: "#fff7ed",
      },
      dark: {
        primary: "#fb923c",
        primaryDark: "#f97316",
        primarySoft: "#4a2715",
        primaryLight: "#362014",
      },
    },
  });

  const DARK_SURFACE = Object.freeze({
    bg: "#0b1220",
    card: "#111827",
    text: "#f8fafc",
    muted: "#94a3b8",
    border: "#263244",
    shadowSm: "0 4px 14px rgba(0, 0, 0, 0.24)",
    shadowMd: "0 10px 28px rgba(0, 0, 0, 0.34)",
  });

  const LIGHT_SURFACE = Object.freeze({
    bg: "#f8fafc",
    card: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    border: "#e2e8f0",
    shadowSm: "0 4px 14px rgba(15, 23, 42, 0.07)",
    shadowMd: "0 10px 28px rgba(15, 23, 42, 0.10)",
  });

  const systemDarkMedia = window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;

  let currentSettings = loadSettings();

  function safeParse(value) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  function isValid(key, value) {
    return Boolean(VALID_VALUES[key] && VALID_VALUES[key].includes(value));
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};

    return {
      theme: isValid("theme", source.theme) ? source.theme : DEFAULTS.theme,
      accent: isValid("accent", source.accent) ? source.accent : DEFAULTS.accent,
      fontSize: isValid("fontSize", source.fontSize)
        ? source.fontSize
        : DEFAULTS.fontSize,
      density: isValid("density", source.density)
        ? source.density
        : DEFAULTS.density,
      reduceMotion:
        typeof source.reduceMotion === "boolean"
          ? source.reduceMotion
          : DEFAULTS.reduceMotion,
    };
  }

  function loadSettings() {
    try {
      return normalizeSettings(safeParse(localStorage.getItem(STORAGE_KEY)));
    } catch (error) {
      return { ...DEFAULTS };
    }
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      return false;
    }
  }

  function resolveTheme(theme) {
    if (theme === "system") {
      return systemDarkMedia && systemDarkMedia.matches ? "dark" : "light";
    }

    return theme;
  }

  function setVariable(root, name, value) {
    root.style.setProperty(name, value);
  }

  function ensureGlobalStyle() {
    if (document.getElementById("askep-settings-runtime-style")) return;

    const style = document.createElement("style");
    style.id = "askep-settings-runtime-style";
    style.textContent = `
      :root {
        --askep-font-small: 0.94;
        --askep-font-normal: 1;
        --askep-font-large: 1.07;
        --askep-font-scale: 1;
      }

      html[data-resolved-theme="dark"] {
        color-scheme: dark;
      }

      html[data-resolved-theme="light"] {
        color-scheme: light;
      }

      html[data-font-size="small"] {
        --askep-font-scale: var(--askep-font-small);
      }

      html[data-font-size="normal"] {
        --askep-font-scale: var(--askep-font-normal);
      }

      html[data-font-size="large"] {
        --askep-font-scale: var(--askep-font-large);
      }

      html[data-font-size="small"] body {
        font-size: 14px;
      }

      html[data-font-size="normal"] body {
        font-size: 16px;
      }

      html[data-font-size="large"] body {
        font-size: 17px;
      }

      html[data-font-size="small"] :where(.brand-title, .page-title, .section-title, .card-title, .item-title, .feature-title) {
        letter-spacing: -0.01em;
      }

      html[data-font-size="large"] :where(.brand-title, .page-title, .section-title, .card-title, .item-title, .feature-title) {
        letter-spacing: -0.02em;
      }

      html[data-density="compact"] .header {
        padding-top: 14px;
        padding-bottom: 10px;
      }

      html[data-density="compact"] .content {
        padding-top: 14px;
      }

      html[data-density="compact"] .section {
        margin-bottom: 20px;
      }

      html[data-density="compact"] :where(.quick-card, .feature-card, .flow-card, .card) {
        padding-top: 11px;
        padding-bottom: 11px;
      }

      html[data-density="compact"] :where(.quick-grid, .feature-list, .list, .card-list) {
        gap: 10px;
      }

      html[data-density="compact"] .bottom-item {
        gap: 2px;
      }

      html[data-reduce-motion="true"] {
        scroll-behavior: auto !important;
      }

      html[data-reduce-motion="true"] *,
      html[data-reduce-motion="true"] *::before,
      html[data-reduce-motion="true"] *::after {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }

      html[data-reduce-motion="true"] .native-click:hover,
      html[data-reduce-motion="true"] .native-click:active {
        transform: none !important;
      }

      html[data-reduce-motion="true"] .ripple {
        display: none !important;
      }

      html[data-resolved-theme="dark"] body,
      html[data-resolved-theme="dark"] .app {
        background-color: var(--bg);
        color: var(--text);
      }

      html[data-resolved-theme="dark"] .app {
        background-image: linear-gradient(180deg, var(--primary-light) 0%, var(--bg) 420px);
      }

      html[data-resolved-theme="dark"] :where(input, textarea, select) {
        color-scheme: dark;
      }

      html[data-resolved-theme="dark"] :where(.guide-dropdown, .menu-dropdown, .dropdown-menu) {
        border-color: var(--border) !important;
        background: var(--card) !important;
        color: var(--text) !important;
      }

      html[data-resolved-theme="dark"] :where(.guide-dropdown-title, .guide-menu-item, .menu-item) {
        color: var(--text) !important;
      }

      html[data-resolved-theme="dark"] :where(.guide-dropdown-subtitle, .guide-menu-description) {
        color: var(--muted) !important;
      }

      html[data-resolved-theme="dark"] :where(.guide-dropdown-divider) {
        background: var(--border) !important;
      }

      html[data-resolved-theme="dark"] :where(.guide-menu-item:hover, .menu-item:hover) {
        background: rgba(148, 163, 184, 0.10) !important;
      }

      @media (min-width: 900px) {
        html[data-resolved-theme="dark"] .bottom-nav {
          border-right-color: var(--border);
          background: rgba(17, 24, 39, 0.97);
          box-shadow: 8px 0 30px rgba(0, 0, 0, 0.20);
        }

        html[data-density="compact"] .bottom-nav {
          gap: 5px;
        }

        html[data-density="compact"] .bottom-item {
          height: 48px;
          min-height: 48px;
          flex-basis: 48px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function updateThemeColor(resolvedTheme, palette) {
    let meta = document.querySelector('meta[name="theme-color"]');

    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }

    meta.content = resolvedTheme === "dark" ? "#0b1220" : palette.primaryLight;
  }

  function applySettings(settings, options) {
    const normalized = normalizeSettings(settings);
    const resolvedTheme = resolveTheme(normalized.theme);
    const paletteSet = PALETTES[normalized.accent] || PALETTES.blue;
    const palette = paletteSet[resolvedTheme];
    const surface = resolvedTheme === "dark" ? DARK_SURFACE : LIGHT_SURFACE;
    const root = document.documentElement;

    ensureGlobalStyle();

    root.dataset.theme = normalized.theme;
    root.dataset.resolvedTheme = resolvedTheme;
    root.dataset.accent = normalized.accent;
    root.dataset.fontSize = normalized.fontSize;
    root.dataset.density = normalized.density;
    root.dataset.reduceMotion = String(normalized.reduceMotion);

    setVariable(root, "--primary", palette.primary);
    setVariable(root, "--primary-dark", palette.primaryDark);
    setVariable(root, "--primary-soft", palette.primarySoft);
    setVariable(root, "--primary-light", palette.primaryLight);

    setVariable(root, "--bg", surface.bg);
    setVariable(root, "--card", surface.card);
    setVariable(root, "--text", surface.text);
    setVariable(root, "--muted", surface.muted);
    setVariable(root, "--border", surface.border);
    setVariable(root, "--shadow-sm", surface.shadowSm);
    setVariable(root, "--shadow-md", surface.shadowMd);

    updateThemeColor(resolvedTheme, palette);
    currentSettings = normalized;

    const shouldDispatch = !options || options.dispatch !== false;

    if (shouldDispatch) {
      window.dispatchEvent(
        new CustomEvent("askep:settingschange", {
          detail: {
            settings: { ...normalized },
            resolvedTheme,
          },
        })
      );
    }

    return { ...normalized };
  }

  function setSettings(partialSettings) {
    const nextSettings = normalizeSettings({
      ...currentSettings,
      ...(partialSettings || {}),
    });

    saveSettings(nextSettings);
    return applySettings(nextSettings);
  }

  function resetSettings() {
    const nextSettings = { ...DEFAULTS };
    saveSettings(nextSettings);
    return applySettings(nextSettings);
  }

  function getSettings() {
    return { ...currentSettings };
  }

  function handleSystemThemeChange() {
    if (currentSettings.theme === "system") {
      applySettings(currentSettings);
    }
  }

  function handleStorageChange(event) {
    if (event.key !== STORAGE_KEY) return;

    currentSettings = normalizeSettings(safeParse(event.newValue));
    applySettings(currentSettings);
  }

  if (systemDarkMedia) {
    if (typeof systemDarkMedia.addEventListener === "function") {
      systemDarkMedia.addEventListener("change", handleSystemThemeChange);
    } else if (typeof systemDarkMedia.addListener === "function") {
      systemDarkMedia.addListener(handleSystemThemeChange);
    }
  }

  window.addEventListener("storage", handleStorageChange);

  window.AskepSettings = Object.freeze({
    defaults: { ...DEFAULTS },
    get: getSettings,
    set: setSettings,
    reset: resetSettings,
    apply: function () {
      return applySettings(currentSettings);
    },
  });

  applySettings(currentSettings, { dispatch: false });
})();
