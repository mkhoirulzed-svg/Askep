import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PAGES_DIR = path.join(ROOT, "pages");
const FIX_CSS_PATH = path.join(ROOT, "styles", "settings-fixes.css");

const DARK_FIX_CSS = `/* Dibuat/diperbarui otomatis oleh scripts/sync-page-settings.mjs */

/* Elemen formulir mengikuti warna tema aplikasi. */
:where(input, textarea, select) {
  background-color: var(--card);
  color: var(--text);
  border-color: var(--border);
  caret-color: var(--primary);
}

:where(input, textarea, select)::placeholder {
  color: var(--muted);
  opacity: 1;
}

:where(input, textarea, select):focus {
  border-color: var(--primary);
  outline: 3px solid color-mix(in srgb, var(--primary) 18%, transparent);
}

/* Mencegah browser mempertahankan latar putih pada autofill. */
:where(input, textarea, select):-webkit-autofill,
:where(input, textarea, select):-webkit-autofill:hover,
:where(input, textarea, select):-webkit-autofill:focus {
  -webkit-text-fill-color: var(--text);
  caret-color: var(--text);
  box-shadow: 0 0 0 1000px var(--card) inset;
  transition: background-color 9999s ease-out 0s;
}

/* Perbaikan eksplisit untuk mode gelap. */
html[data-resolved-theme="dark"] :where(
  input,
  textarea,
  select,
  .search-input,
  .search-box input,
  .form-control,
  .input-field,
  .textarea-field
) {
  background: var(--card) !important;
  color: var(--text) !important;
  border-color: var(--border) !important;
  -webkit-text-fill-color: var(--text);
}

html[data-resolved-theme="dark"] :where(
  input,
  textarea,
  select,
  .search-input,
  .search-box input,
  .form-control,
  .input-field,
  .textarea-field
)::placeholder {
  color: var(--muted) !important;
  opacity: 1;
}

html[data-resolved-theme="dark"] textarea[readonly],
html[data-resolved-theme="dark"] input[readonly],
html[data-resolved-theme="dark"] textarea:disabled,
html[data-resolved-theme="dark"] input:disabled {
  background: color-mix(in srgb, var(--card) 88%, var(--bg)) !important;
  color: var(--text) !important;
  opacity: 1;
}

/* Search cancel button pada browser WebKit. */
html[data-resolved-theme="dark"] input[type="search"]::-webkit-search-cancel-button {
  filter: invert(1);
}
`;

function listHtmlFiles() {
  const files = [];

  const indexPath = path.join(ROOT, "index.html");
  if (fs.existsSync(indexPath)) files.push(indexPath);

  if (fs.existsSync(PAGES_DIR)) {
    for (const entry of fs.readdirSync(PAGES_DIR, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith(".html")) {
        files.push(path.join(PAGES_DIR, entry.name));
      }
    }
  }

  return files.sort();
}

function relativePrefix(filePath) {
  const dir = path.dirname(filePath);
  let prefix = path.relative(dir, ROOT).replaceAll(path.sep, "/");

  if (!prefix || prefix === ".") return "";
  return `${prefix}/`;
}

function removeDuplicateTag(html, pattern) {
  let found = false;

  return html.replace(pattern, (match) => {
    if (found) return "";
    found = true;
    return match;
  });
}

function ensureBeforeHeadClose(html, tag) {
  if (html.includes(tag)) return html;

  const closeHead = /<\/head\s*>/i;
  if (!closeHead.test(html)) {
    throw new Error("Tag </head> tidak ditemukan.");
  }

  return html.replace(closeHead, `  ${tag}\n</head>`);
}

function ensurePageTags(filePath) {
  let html = fs.readFileSync(filePath, "utf8");
  const original = html;
  const prefix = relativePrefix(filePath);

  const manifestHref = `${prefix}manifest.webmanifest`;
  const faviconHref = `${prefix}icons/favicon.png`;
  const appleHref = `${prefix}icons/apple-touch-icon.png`;
  const cssHref = `${prefix}styles/settings-fixes.css`;
  const settingsSrc = `${prefix}scripts/settings.js`;

  // Hapus duplikasi untuk aset yang dikelola workflow.
  html = removeDuplicateTag(
    html,
    /[ \t]*<link\b[^>]*rel=["']manifest["'][^>]*>\s*/gi
  );
  html = removeDuplicateTag(
    html,
    /[ \t]*<link\b[^>]*rel=["']icon["'][^>]*>\s*/gi
  );
  html = removeDuplicateTag(
    html,
    /[ \t]*<link\b[^>]*rel=["']apple-touch-icon["'][^>]*>\s*/gi
  );
  html = removeDuplicateTag(
    html,
    /[ \t]*<link\b[^>]*href=["'][^"']*settings-fixes\.css["'][^>]*>\s*/gi
  );
  html = removeDuplicateTag(
    html,
    /[ \t]*<script\b[^>]*src=["'][^"']*settings\.js["'][^>]*>\s*<\/script>\s*/gi
  );

  const tags = [
    `<link rel="manifest" href="${manifestHref}">`,
    `<link rel="icon" href="${faviconHref}">`,
    `<link rel="apple-touch-icon" href="${appleHref}">`,
    `<link rel="stylesheet" href="${cssHref}">`,
    `<script src="${settingsSrc}"></script>`,
  ];

  // Masukkan sebelum </head>, dengan settings.js terakhir supaya tema aktif sedini mungkin.
  for (const tag of tags) {
    html = ensureBeforeHeadClose(html, tag);
  }

  if (html !== original) {
    fs.writeFileSync(filePath, html, "utf8");
    console.log(`Diperbarui: ${path.relative(ROOT, filePath)}`);
    return true;
  }

  console.log(`Sudah sesuai: ${path.relative(ROOT, filePath)}`);
  return false;
}

function ensureDarkFixCss() {
  fs.mkdirSync(path.dirname(FIX_CSS_PATH), { recursive: true });

  const existing = fs.existsSync(FIX_CSS_PATH)
    ? fs.readFileSync(FIX_CSS_PATH, "utf8")
    : "";

  if (existing !== DARK_FIX_CSS) {
    fs.writeFileSync(FIX_CSS_PATH, DARK_FIX_CSS, "utf8");
    console.log("Diperbarui: styles/settings-fixes.css");
    return true;
  }

  console.log("Sudah sesuai: styles/settings-fixes.css");
  return false;
}

function main() {
  const htmlFiles = listHtmlFiles();

  if (htmlFiles.length === 0) {
    throw new Error("Tidak ada file HTML yang ditemukan.");
  }

  let changed = ensureDarkFixCss();

  for (const filePath of htmlFiles) {
    changed = ensurePageTags(filePath) || changed;
  }

  console.log(
    changed
      ? "\nSinkronisasi selesai. Perubahan siap di-commit."
      : "\nSemua halaman sudah konsisten. Tidak ada perubahan."
  );
}

main();
