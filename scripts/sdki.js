/* =========================
   CONFIG PATH
========================= */
const DATA_PATHS = {
  sdki: "https://askep.mkhoirulzed.workers.dev/api/sdki"
};

const PER_PAGE = 20;

/* =========================
   ELEMENTS
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
let allDiagnoses = [];
let filteredDiagnoses = [];
let currentPage = 1;
let activeCategory = "Semua";

/* =========================
   HELPERS
========================= */
function normalizeText(text){
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pick(obj, keys){
  for(const key of keys){
    if(obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== ""){
      return obj[key];
    }
  }
  return "";
}

function toArray(data){
  if(Array.isArray(data)) return data;

  if(data && Array.isArray(data.data)) return data.data;
  if(data && Array.isArray(data.items)) return data.items;
  if(data && Array.isArray(data.diagnosis)) return data.diagnosis;
  if(data && Array.isArray(data.diagnosa)) return data.diagnosa;
  if(data && Array.isArray(data.sdki)) return data.sdki;

  if(data && typeof data === "object"){
    return Object.values(data);
  }

  return [];
}

function escapeHtml(text){
  return String(text || "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

function stringifyDeep(value){
  if(value === null || value === undefined) return "";
  if(typeof value === "string" || typeof value === "number") return String(value);
  if(Array.isArray(value)) return value.map(stringifyDeep).join(" ");
  if(typeof value === "object") return Object.values(value).map(stringifyDeep).join(" ");
  return "";
}

function getDiagnosisId(item){
  return pick(item, ["id", "slug", "kode", "code", "nomor", "no"]);
}

function getDiagnosisCode(item){
  return pick(item, ["kode", "code", "nomor", "no"]);
}

function getDiagnosisTitle(item){
  return pick(item, [
    "nama",
    "diagnosis",
    "diagnosa",
    "judul",
    "title",
    "label",
    "name"
  ]);
}

function getDiagnosisDesc(item){
  return pick(item, [
    "definisi",
    "deskripsi",
    "description",
    "keterangan"
  ]);
}

function getDiagnosisCategory(item){
  return pick(item, [
    "kategori",
    "category",
    "domain",
    "kelompok"
  ]);
}

function getDiagnosisSubCategory(item){
  return pick(item, [
    "subkategori",
    "sub_category",
    "subCategory",
    "kelas",
    "class"
  ]);
}

function makeSearchText(item){
  return normalizeText([
    getDiagnosisId(item),
    getDiagnosisCode(item),
    getDiagnosisTitle(item),
    getDiagnosisDesc(item),
    getDiagnosisCategory(item),
    getDiagnosisSubCategory(item),
    stringifyDeep(item)
  ].join(" "));
}

function makeDetailUrl(item){
  const id = getDiagnosisId(item) || getDiagnosisCode(item) || getDiagnosisTitle(item);
  return "diagnosis-detail.html?id=" + encodeURIComponent(id);
}

async function fetchJsonSafe(path){
  try{
    const res = await fetch(path + "?v=" + Date.now());
    if(!res.ok) throw new Error("Gagal memuat " + path);
    return await res.json();
  }catch(err){
    console.warn(err.message);
    return [];
  }
}

/* =========================
   RENDER
========================= */
function renderEmpty(title, desc){
  listArea.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">
        <i class="fa-solid fa-circle-exclamation"></i>
      </div>
      <div class="empty-title">${escapeHtml(title)}</div>
      <div class="empty-desc">${escapeHtml(desc)}</div>
    </div>
  `;
}

function getUniqueCategories(){
  const categories = allDiagnoses
    .map(item => getDiagnosisCategory(item))
    .filter(Boolean)
    .map(item => String(item).trim())
    .filter(Boolean);

  return ["Semua", ...Array.from(new Set(categories)).sort((a,b) => a.localeCompare(b))];
}

function renderCategoryTags(){
  const categories = getUniqueCategories();

  categoryTags.innerHTML = categories.map(category => `
    <button
      type="button"
      class="category-chip native-click ${category === activeCategory ? "active" : ""}"
      data-category="${escapeHtml(category)}"
    >
      ${escapeHtml(category)}
    </button>
  `).join("");
}  

function renderList(){
  const totalItems = filteredDiagnoses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PER_PAGE));

  if(currentPage > totalPages) currentPage = totalPages;
  if(currentPage < 1) currentPage = 1;

  const startIndex = (currentPage - 1) * PER_PAGE;
  const pageItems = filteredDiagnoses.slice(startIndex, startIndex + PER_PAGE);

  resultCount.textContent = totalItems
    ? `${totalItems} diagnosis ditemukan`
    : "Tidak ada diagnosis";

  pageCount.textContent = `Halaman ${currentPage}`;
  pageNumber.textContent = `${currentPage} / ${totalPages}`;

  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  paginationEl.style.display = totalItems > PER_PAGE ? "flex" : "none";

  if(!totalItems){
    renderEmpty(
      "Diagnosis tidak ditemukan",
      "Coba gunakan kata kunci lain, misalnya nyeri, napas, perfusi, D.0004, atau kategori."
    );
    return;
  }

  listArea.innerHTML = pageItems.map(item => {
    const id = getDiagnosisId(item);
    const code = getDiagnosisCode(item);
    const title = getDiagnosisTitle(item) || "Diagnosis SDKI";
    const desc = getDiagnosisDesc(item) || "Ketuk untuk melihat detail diagnosis.";
    const category = getDiagnosisCategory(item);
    const subCategory = getDiagnosisSubCategory(item);
    const url = makeDetailUrl(item);

    return `
      <a href="${url}" class="diagnosis-card native-click">
        <div class="diagnosis-icon">
          <i class="fa-solid fa-notes-medical"></i>
        </div>

        <div class="diagnosis-body">
          <div class="diagnosis-top">
            <span class="diagnosis-code">${escapeHtml(code || id || "-")}</span>
            <span class="diagnosis-category">
              ${escapeHtml([category, subCategory].filter(Boolean).join(" • ") || "SDKI")}
            </span>
          </div>

          <div class="diagnosis-title">${escapeHtml(title)}</div>
          <div class="diagnosis-desc">${escapeHtml(desc)}</div>
        </div>

        <i class="fa-solid fa-chevron-right chevron"></i>
      </a>
    `;
  }).join("");
}

function applySearch(){
  const q = normalizeText(searchInput.value);

  clearSearch.style.display = q ? "flex" : "none";

  const categoryFiltered = activeCategory === "Semua"
    ? [...allDiagnoses]
    : allDiagnoses.filter(item => {
        return normalizeText(getDiagnosisCategory(item)) === normalizeText(activeCategory);
      });

  if(!q){
    filteredDiagnoses = categoryFiltered;
    currentPage = 1;
    renderList();
    return;
  }

  const keywords = q
    .split(/\s+/)
    .filter(Boolean);

  filteredDiagnoses = categoryFiltered
    .map(item => {
      const text = makeSearchText(item);
      const title = normalizeText(getDiagnosisTitle(item));
      const code = normalizeText(getDiagnosisCode(item));
      let score = 0;

      for(const key of keywords){
        if(code === key) score += 50;
        if(code.includes(key)) score += 30;
        if(title.includes(key)) score += 25;
        if(text.includes(key)) score += 10;
      }

      const matched = keywords.every(key => text.includes(key));

      return { item, score, matched };
    })
    .filter(row => row.matched)
    .sort((a,b) => b.score - a.score)
    .map(row => row.item);

  currentPage = 1;
  renderList();
}

/* =========================
   LOAD DATA
========================= */
async function loadSdki(){
  loadingEl.style.display = "flex";
  listArea.innerHTML = "";

  const sdkiJson = await fetchJsonSafe(DATA_PATHS.sdki);
  allDiagnoses = toArray(sdkiJson).filter(item => item && typeof item === "object");
  filteredDiagnoses = [...allDiagnoses];
  
  renderCategoryTags();

  loadingEl.style.display = "none";

  headerSub.textContent = allDiagnoses.length
    ? `${allDiagnoses.length} diagnosis tersedia`
    : "Standar Diagnosis Keperawatan Indonesia";

  if(!allDiagnoses.length){
    resultCount.textContent = "Data kosong";
    pageCount.textContent = "Halaman 1";
    renderEmpty(
      "Data SDKI belum terbaca",
     "Data SDKI belum tersedia atau gagal dimuat dari server."
    );
    return;
  }

  renderList();
}

/* =========================
   EVENTS
========================= */
searchInput.addEventListener("input", applySearch);

clearSearch.addEventListener("click", function(){
  searchInput.value = "";
  searchInput.focus();
  applySearch();
});

prevBtn.addEventListener("click", function(){
  if(currentPage <= 1) return;
  currentPage--;
  renderList();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

nextBtn.addEventListener("click", function(){
  const totalPages = Math.max(1, Math.ceil(filteredDiagnoses.length / PER_PAGE));
  if(currentPage >= totalPages) return;
  currentPage++;
  renderList();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

categoryTags.addEventListener("click", function(e){
  const btn = e.target.closest(".category-chip");
  if(!btn) return;

  activeCategory = btn.dataset.category || "Semua";

  categoryTags.querySelectorAll(".category-chip").forEach(chip => {
    chip.classList.toggle("active", chip.dataset.category === activeCategory);
  });

  currentPage = 1;
  applySearch();
});  
/* =========================
   RIPPLE EFFECT
========================= */
document.addEventListener("click", function(e){
  const el = e.target.closest(".native-click");
  if(!el || el.disabled) return;

  const oldRipple = el.querySelector(".ripple");
  if(oldRipple) oldRipple.remove();

  const ripple = document.createElement("span");
  ripple.className = "ripple";

  const rect = el.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);

  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = (e.clientX - rect.left - size / 2) + "px";
  ripple.style.top = (e.clientY - rect.top - size / 2) + "px";

  el.appendChild(ripple);

  setTimeout(() => ripple.remove(), 600);
});

/* =========================
   BLOKIR SELECT
========================= */
document.addEventListener("selectstart", function(e){
  const allow = e.target.closest("input, textarea, select");
  if(!allow) e.preventDefault();
});

/* =========================
   INIT
========================= */
loadSdki().catch(err => {
  console.error(err);
  loadingEl.style.display = "none";
  resultCount.textContent = "Gagal memuat data";
  renderEmpty(
    "Terjadi kesalahan",
    "Data SDKI gagal dimuat. Cek path file JSON dan console browser."
  );
});
