/* =========================
   KONFIGURASI API
========================= */
const API_BASE = "https://askep.mkhoirulzed.workers.dev";

const API_ENDPOINTS = {
  sdki: `${API_BASE}/api/sdki`,
  slki: `${API_BASE}/api/slki`,
  siki: `${API_BASE}/api/siki`,
  relations: `${API_BASE}/api/relations`
};

const PER_PAGE = 20;

/* =========================
   ELEMENT
========================= */
const loadingEl = document.getElementById("loading");
const listArea = document.getElementById("listArea");
const paginationEl = document.getElementById("pagination");
const searchInput = document.getElementById("searchInput");
const clearSearch = document.getElementById("clearSearch");
const resultCount = document.getElementById("resultCount");
const pageCount = document.getElementById("pageCount");
const pageNumber = document.getElementById("pageNumber");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const headerSub = document.getElementById("headerSub");
const categoryTags = document.getElementById("categoryTags");

/* =========================
   STATE
========================= */
let allOutcomes = [];
let filteredOutcomes = [];
let currentPage = 1;
let activeCategory = "Semua";

/* =========================
   HELPER
========================= */
function normalizeText(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(obj, keys) {
  for (const key of keys) {
    if (
      obj &&
      obj[key] !== undefined &&
      obj[key] !== null &&
      obj[key] !== ""
    ) {
      return obj[key];
    }
  }

  return "";
}

function toArray(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== "object") {
    return [];
  }

  const possibleArrays = [
    data.data,
    data.items,
    data.luaran,
    data.outcomes,
    data.slki,
    data.result,
    data.results
  ];

  for (const value of possibleArrays) {
    if (Array.isArray(value)) {
      return value;
    }
  }

  /*
   * Jangan langsung memakai Object.values(data) jika respons API
   * memiliki properti seperti success, message, dan data.
   */
  const values = Object.values(data);

  if (
    values.length &&
    values.every(
      value =>
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
    )
  ) {
    return values;
  }

  return [];
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stringifyDeep(value) {
  if (value === null || value === undefined) {
    return "";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(stringifyDeep).join(" ");
  }

  if (typeof value === "object") {
    return Object.values(value)
      .map(stringifyDeep)
      .join(" ");
  }

  return "";
}

function getOutcomeId(item) {
  return pick(item, [
    "id",
    "slug",
    "kode",
    "kodeSlki",
    "code",
    "nomor",
    "no"
  ]);
}

function getOutcomeCode(item) {
  return pick(item, [
    "kode",
    "kodeSlki",
    "code",
    "nomor",
    "no"
  ]);
}

function getOutcomeTitle(item) {
  return pick(item, [
    "nama",
    "namaLuaran",
    "judulSlki",
    "luaran",
    "outcome",
    "judul",
    "title",
    "label",
    "name"
  ]);
}

function getOutcomeDesc(item) {
  return pick(item, [
    "definisi",
    "deskripsi",
    "description",
    "keterangan",
    "ekspektasi"
  ]);
}

function getOutcomeCategory(item) {
  return pick(item, [
    "kategori",
    "category",
    "domain",
    "kelompok"
  ]);
}

function getOutcomeSubCategory(item) {
  return pick(item, [
    "subkategori",
    "subKategori",
    "sub_category",
    "subCategory",
    "kelas",
    "class"
  ]);
}

function getOutcomeExpectation(item) {
  return pick(item, [
    "ekspektasi",
    "harapan",
    "expectation",
    "target"
  ]);
}

function makeSearchText(item) {
  return normalizeText(
    [
      getOutcomeId(item),
      getOutcomeCode(item),
      getOutcomeTitle(item),
      getOutcomeDesc(item),
      getOutcomeCategory(item),
      getOutcomeSubCategory(item),
      getOutcomeExpectation(item),
      stringifyDeep(item)
    ].join(" ")
  );
}

function makeDetailUrl(item) {
  const id =
    getOutcomeId(item) ||
    getOutcomeCode(item) ||
    getOutcomeTitle(item);

  return `slki-detail.html?id=${encodeURIComponent(id)}`;
}

async function fetchJsonSafe(url) {
  try {
    const separator = url.includes("?") ? "&" : "?";

    const response = await fetch(
      `${url}${separator}v=${Date.now()}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      }
    );

    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}: ${rawText || response.statusText}`
      );
    }

    if (!rawText.trim()) {
      throw new Error("Respons API kosong.");
    }

    let json;

    try {
      json = JSON.parse(rawText);
    } catch {
      throw new Error("Respons API bukan JSON yang valid.");
    }

    if (
      json &&
      typeof json === "object" &&
      json.success === false
    ) {
      throw new Error(
        json.message || "API mengembalikan status gagal."
      );
    }

    return json;
  } catch (error) {
    console.error("Gagal mengambil data SLKI:", error);
    throw error;
  }
}

/* =========================
   RENDER
========================= */
function renderEmpty(title, description) {
  listArea.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fa-solid fa-circle-exclamation"></i>
      </div>

      <div class="empty-title">
        ${escapeHtml(title)}
      </div>

      <div class="empty-desc">
        ${escapeHtml(description)}
      </div>
    </div>
  `;
}

function getUniqueCategories() {
  const categories = allOutcomes
    .map(item => getOutcomeCategory(item))
    .filter(Boolean)
    .map(category => String(category).trim())
    .filter(Boolean);

  return [
    "Semua",
    ...Array.from(new Set(categories)).sort((a, b) =>
      a.localeCompare(b, "id")
    )
  ];
}

function renderCategoryTags() {
  const categories = getUniqueCategories();

  categoryTags.innerHTML = categories
    .map(category => {
      const isActive = category === activeCategory;

      return `
        <button
          type="button"
          class="category-chip native-click ${
            isActive ? "active" : ""
          }"
          data-category="${escapeHtml(category)}"
        >
          ${escapeHtml(category)}
        </button>
      `;
    })
    .join("");
}

function renderList() {
  const totalItems = filteredOutcomes.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / PER_PAGE)
  );

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  if (currentPage < 1) {
    currentPage = 1;
  }

  const startIndex = (currentPage - 1) * PER_PAGE;
  const pageItems = filteredOutcomes.slice(
    startIndex,
    startIndex + PER_PAGE
  );

  resultCount.textContent = totalItems
    ? `${totalItems} luaran ditemukan`
    : "Tidak ada luaran";

  pageCount.textContent = `Halaman ${currentPage}`;
  pageNumber.textContent = `${currentPage} / ${totalPages}`;

  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  paginationEl.style.display =
    totalItems > PER_PAGE ? "flex" : "none";

  if (!totalItems) {
    renderEmpty(
      "Luaran tidak ditemukan",
      "Coba gunakan kata kunci lain seperti nyeri, mobilitas, perfusi, kode SLKI, atau kategori."
    );

    return;
  }

  listArea.innerHTML = pageItems
    .map(item => {
      const id = getOutcomeId(item);
      const code = getOutcomeCode(item);
      const title =
        getOutcomeTitle(item) || "Luaran SLKI";

      const description =
        getOutcomeDesc(item) ||
        getOutcomeExpectation(item) ||
        "Ketuk untuk melihat detail luaran.";

      const category = getOutcomeCategory(item);
      const subCategory = getOutcomeSubCategory(item);
      const expectation = getOutcomeExpectation(item);
      const url = makeDetailUrl(item);

      const categoryText =
        [category, subCategory]
          .filter(Boolean)
          .join(" • ") || "SLKI";

      const descriptionText = [
        expectation
          ? `Ekspektasi: ${expectation}`
          : "",
        description
      ]
        .filter(Boolean)
        .join(" — ");

      return `
        <a
          href="${escapeHtml(url)}"
          class="outcome-card native-click"
        >
          <div class="outcome-icon">
            <i class="fa-solid fa-chart-simple"></i>
          </div>

          <div class="outcome-body">
            <div class="outcome-top">
              <span class="outcome-code">
                ${escapeHtml(code || id || "-")}
              </span>

              <span class="outcome-category">
                ${escapeHtml(categoryText)}
              </span>
            </div>

            <div class="outcome-title">
              ${escapeHtml(title)}
            </div>

            <div class="outcome-desc">
              ${escapeHtml(descriptionText)}
            </div>
          </div>

          <i class="fa-solid fa-chevron-right chevron"></i>
        </a>
      `;
    })
    .join("");
}

function applySearch() {
  const query = normalizeText(searchInput.value);

  clearSearch.style.display = query ? "flex" : "none";

  const categoryFiltered =
    activeCategory === "Semua"
      ? [...allOutcomes]
      : allOutcomes.filter(item => {
          return (
            normalizeText(getOutcomeCategory(item)) ===
            normalizeText(activeCategory)
          );
        });

  if (!query) {
    filteredOutcomes = categoryFiltered;
    currentPage = 1;
    renderList();
    return;
  }

  const keywords = query
    .split(/\s+/)
    .filter(Boolean);

  filteredOutcomes = categoryFiltered
    .map(item => {
      const searchText = makeSearchText(item);
      const title = normalizeText(
        getOutcomeTitle(item)
      );
      const code = normalizeText(
        getOutcomeCode(item)
      );

      let score = 0;

      for (const keyword of keywords) {
        if (code === keyword) {
          score += 50;
        }

        if (code.includes(keyword)) {
          score += 30;
        }

        if (title.includes(keyword)) {
          score += 25;
        }

        if (searchText.includes(keyword)) {
          score += 10;
        }
      }

      const matched = keywords.every(keyword =>
        searchText.includes(keyword)
      );

      return {
        item,
        score,
        matched
      };
    })
    .filter(row => row.matched)
    .sort((a, b) => b.score - a.score)
    .map(row => row.item);

  currentPage = 1;
  renderList();
}

/* =========================
   LOAD DATA SLKI
========================= */
async function loadSlki() {
  loadingEl.style.display = "flex";
  listArea.innerHTML = "";
  paginationEl.style.display = "none";

  try {
    const slkiJson = await fetchJsonSafe(
      API_ENDPOINTS.slki
    );

    allOutcomes = toArray(slkiJson).filter(
      item =>
        item &&
        typeof item === "object" &&
        !Array.isArray(item)
    );

    filteredOutcomes = [...allOutcomes];

    renderCategoryTags();

    headerSub.textContent = allOutcomes.length
      ? `${allOutcomes.length} luaran tersedia`
      : "Standar Luaran Keperawatan Indonesia";

    if (!allOutcomes.length) {
      resultCount.textContent = "Data kosong";
      pageCount.textContent = "Halaman 1";

      renderEmpty(
        "Data SLKI kosong",
        "Endpoint API berhasil dibuka, tetapi tidak menemukan daftar data SLKI."
      );

      return;
    }

    renderList();
  } catch (error) {
    console.error(error);

    resultCount.textContent = "Gagal memuat data";
    pageCount.textContent = "Halaman 1";
    headerSub.textContent =
      "Standar Luaran Keperawatan Indonesia";

    renderEmpty(
      "Data SLKI gagal dimuat",
      error.message ||
        "Periksa endpoint API SLKI dan console browser."
    );
  } finally {
    loadingEl.style.display = "none";
  }
}

/* =========================
   EVENT
========================= */
searchInput.addEventListener("input", applySearch);

clearSearch.addEventListener("click", () => {
  searchInput.value = "";
  searchInput.focus();
  applySearch();
});

prevBtn.addEventListener("click", () => {
  if (currentPage <= 1) {
    return;
  }

  currentPage -= 1;
  renderList();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

nextBtn.addEventListener("click", () => {
  const totalPages = Math.max(
    1,
    Math.ceil(filteredOutcomes.length / PER_PAGE)
  );

  if (currentPage >= totalPages) {
    return;
  }

  currentPage += 1;
  renderList();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

categoryTags.addEventListener("click", event => {
  const button = event.target.closest(
    ".category-chip"
  );

  if (!button) {
    return;
  }

  activeCategory =
    button.dataset.category || "Semua";

  categoryTags
    .querySelectorAll(".category-chip")
    .forEach(chip => {
      chip.classList.toggle(
        "active",
        chip.dataset.category === activeCategory
      );
    });

  currentPage = 1;
  applySearch();
});

/* =========================
   RIPPLE EFFECT
========================= */
document.addEventListener("click", event => {
  const element = event.target.closest(
    ".native-click"
  );

  if (!element || element.disabled) {
    return;
  }

  const oldRipple =
    element.querySelector(".ripple");

  if (oldRipple) {
    oldRipple.remove();
  }

  const ripple =
    document.createElement("span");

  ripple.className = "ripple";

  const rect =
    element.getBoundingClientRect();

  const size = Math.max(
    rect.width,
    rect.height
  );

  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;

  ripple.style.left = `${
    event.clientX -
    rect.left -
    size / 2
  }px`;

  ripple.style.top = `${
    event.clientY -
    rect.top -
    size / 2
  }px`;

  element.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 600);
});

/* =========================
   BLOKIR SELECT
========================= */
document.addEventListener(
  "selectstart",
  event => {
    const allowed = event.target.closest(
      "input, textarea, select"
    );

    if (!allowed) {
      event.preventDefault();
    }
  }
);

/* =========================
   INIT
========================= */
loadSlki();
