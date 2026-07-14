/* =========================
   CONFIG API
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

/* =========================
   STATE
========================= */
let allInterventions = [];
let filteredInterventions = [];
let currentPage = 1;

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
    if(
      obj &&
      obj[key] !== undefined &&
      obj[key] !== null &&
      obj[key] !== ""
    ){
      return obj[key];
    }
  }

  return "";
}

function toArray(data){
  if(Array.isArray(data)){
    return data;
  }

  if(data && Array.isArray(data.data)){
    return data.data;
  }

  if(data && Array.isArray(data.items)){
    return data.items;
  }

  if(data && Array.isArray(data.intervensi)){
    return data.intervensi;
  }

  if(data && Array.isArray(data.interventions)){
    return data.interventions;
  }

  if(data && Array.isArray(data.siki)){
    return data.siki;
  }

  if(data && typeof data === "object"){
    const values = Object.values(data);

    if(values.every(item => item && typeof item === "object")){
      return values;
    }
  }

  return [];
}

function escapeHtml(text){
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function stringifyDeep(value){
  if(value === null || value === undefined){
    return "";
  }

  if(typeof value === "string" || typeof value === "number"){
    return String(value);
  }

  if(Array.isArray(value)){
    return value.map(stringifyDeep).join(" ");
  }

  if(typeof value === "object"){
    return Object.values(value).map(stringifyDeep).join(" ");
  }

  return "";
}

function getInterventionId(item){
  return pick(item, [
    "id",
    "slug",
    "kode",
    "code",
    "nomor",
    "no",
    "kodeSiki"
  ]);
}

function getInterventionCode(item){
  return pick(item, [
    "kode",
    "code",
    "nomor",
    "no",
    "kodeSiki"
  ]);
}

function getInterventionTitle(item){
  return pick(item, [
    "nama",
    "intervensi",
    "intervention",
    "judul",
    "title",
    "label",
    "name",
    "judulSiki"
  ]);
}

function getInterventionDesc(item){
  return pick(item, [
    "definisi",
    "deskripsi",
    "description",
    "keterangan"
  ]);
}

function getInterventionCategory(item){
  return pick(item, [
    "kategori",
    "category",
    "kelompok",
    "jenis"
  ]);
}

function getInterventionSubCategory(item){
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
    getInterventionId(item),
    getInterventionCode(item),
    getInterventionTitle(item),
    getInterventionDesc(item),
    getInterventionCategory(item),
    getInterventionSubCategory(item),
    stringifyDeep(item)
  ].join(" "));
}

function makeDetailUrl(item){
  const id =
    getInterventionId(item) ||
    getInterventionCode(item) ||
    getInterventionTitle(item);

  return "siki-detail.html?id=" + encodeURIComponent(id);
}

async function fetchJsonSafe(url){
  const separator = url.includes("?") ? "&" : "?";

  const response = await fetch(
    `${url}${separator}v=${Date.now()}`,
    {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      cache: "no-store"
    }
  );

  const responseText = await response.text();

  if(!response.ok){
    throw new Error(
      `HTTP ${response.status}: ${responseText || "Gagal memuat data"}`
    );
  }

  try{
    return JSON.parse(responseText);
  }catch(error){
    console.error("Respons API:", responseText);
    throw new Error("Respons API bukan JSON yang valid.");
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

      <div class="empty-title">
        ${escapeHtml(title)}
      </div>

      <div class="empty-desc">
        ${escapeHtml(desc)}
      </div>
    </div>
  `;
}

function renderList(){
  const totalItems = filteredInterventions.length;
  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / PER_PAGE)
  );

  if(currentPage > totalPages){
    currentPage = totalPages;
  }

  if(currentPage < 1){
    currentPage = 1;
  }

  const startIndex = (currentPage - 1) * PER_PAGE;

  const pageItems = filteredInterventions.slice(
    startIndex,
    startIndex + PER_PAGE
  );

  resultCount.textContent = totalItems
    ? `${totalItems} intervensi ditemukan`
    : "Tidak ada intervensi";

  pageCount.textContent = `Halaman ${currentPage}`;
  pageNumber.textContent = `${currentPage} / ${totalPages}`;

  prevBtn.disabled = currentPage <= 1;
  nextBtn.disabled = currentPage >= totalPages;

  paginationEl.style.display =
    totalItems > PER_PAGE ? "flex" : "none";

  if(!totalItems){
    renderEmpty(
      "Intervensi tidak ditemukan",
      "Coba gunakan kata kunci lain, misalnya nyeri, napas, edukasi, monitor, atau kode intervensi."
    );

    return;
  }

  listArea.innerHTML = pageItems.map(item => {
    const id = getInterventionId(item);
    const code = getInterventionCode(item);

    const title =
      getInterventionTitle(item) ||
      "Intervensi SIKI";

    const desc =
      getInterventionDesc(item) ||
      "Ketuk untuk melihat detail intervensi.";

    const category = getInterventionCategory(item);
    const subCategory = getInterventionSubCategory(item);
    const url = makeDetailUrl(item);

    return `
      <a
        href="${escapeHtml(url)}"
        class="intervention-card native-click"
      >
        <div class="intervention-icon">
          <i class="fa-solid fa-clipboard-list"></i>
        </div>

        <div class="intervention-body">
          <div class="intervention-top">
            <span class="intervention-code">
              ${escapeHtml(code || id || "-")}
            </span>

            <span class="intervention-category">
              ${escapeHtml(
                [category, subCategory]
                  .filter(Boolean)
                  .join(" • ") || "SIKI"
              )}
            </span>
          </div>

          <div class="intervention-title">
            ${escapeHtml(title)}
          </div>

          <div class="intervention-desc">
            ${escapeHtml(desc)}
          </div>
        </div>

        <i class="fa-solid fa-chevron-right chevron"></i>
      </a>
    `;
  }).join("");
}

function applySearch(){
  const q = normalizeText(searchInput.value);

  clearSearch.style.display = q ? "flex" : "none";

  if(!q){
    filteredInterventions = [...allInterventions];
    currentPage = 1;
    renderList();
    return;
  }

  const keywords = q
    .split(/\s+/)
    .filter(Boolean);

  filteredInterventions = allInterventions
    .map(item => {
      const text = makeSearchText(item);
      const title = normalizeText(
        getInterventionTitle(item)
      );
      const code = normalizeText(
        getInterventionCode(item)
      );

      let score = 0;

      for(const keyword of keywords){
        if(code === keyword){
          score += 50;
        }

        if(code.includes(keyword)){
          score += 30;
        }

        if(title.includes(keyword)){
          score += 25;
        }

        if(text.includes(keyword)){
          score += 10;
        }
      }

      const matched = keywords.every(keyword =>
        text.includes(keyword)
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
   LOAD DATA
========================= */
async function loadSiki(){
  loadingEl.style.display = "flex";
  listArea.innerHTML = "";
  paginationEl.style.display = "none";

  try{
    const sikiJson = await fetchJsonSafe(
      API_ENDPOINTS.siki
    );

    console.log("Respons API SIKI:", sikiJson);

    allInterventions = toArray(sikiJson)
      .filter(item => item && typeof item === "object");

    filteredInterventions = [...allInterventions];

    loadingEl.style.display = "none";

    headerSub.textContent = allInterventions.length
      ? `${allInterventions.length} intervensi tersedia`
      : "Standar Intervensi Keperawatan Indonesia";

    if(!allInterventions.length){
      resultCount.textContent = "Data kosong";
      pageCount.textContent = "Halaman 1";

      renderEmpty(
        "Data SIKI belum terbaca",
        "Endpoint API berhasil diakses, tetapi data intervensi tidak ditemukan."
      );

      return;
    }

    renderList();
  }catch(error){
    console.error("Gagal memuat SIKI:", error);

    loadingEl.style.display = "none";
    resultCount.textContent = "Gagal memuat data";
    pageCount.textContent = "Halaman 1";
    headerSub.textContent =
      "Standar Intervensi Keperawatan Indonesia";

    renderEmpty(
      "Terjadi kesalahan",
      error.message || "Data SIKI gagal dimuat."
    );
  }
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
  if(currentPage <= 1){
    return;
  }

  currentPage--;
  renderList();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

nextBtn.addEventListener("click", function(){
  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredInterventions.length / PER_PAGE
    )
  );

  if(currentPage >= totalPages){
    return;
  }

  currentPage++;
  renderList();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

/* =========================
   RIPPLE EFFECT
========================= */
document.addEventListener("click", function(event){
  const element = event.target.closest(".native-click");

  if(!element || element.disabled){
    return;
  }

  const oldRipple = element.querySelector(".ripple");

  if(oldRipple){
    oldRipple.remove();
  }

  const ripple = document.createElement("span");
  ripple.className = "ripple";

  const rect = element.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);

  ripple.style.width = `${size}px`;
  ripple.style.height = `${size}px`;
  ripple.style.left =
    `${event.clientX - rect.left - size / 2}px`;
  ripple.style.top =
    `${event.clientY - rect.top - size / 2}px`;

  element.appendChild(ripple);

  setTimeout(() => {
    ripple.remove();
  }, 600);
});

/* =========================
   BLOKIR SELECT
========================= */
document.addEventListener("selectstart", function(event){
  const allowedElement = event.target.closest(
    "input, textarea, select"
  );

  if(!allowedElement){
    event.preventDefault();
  }
});

/* =========================
   INIT
========================= */
loadSiki();
