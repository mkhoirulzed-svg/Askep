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

/* =========================
   ELEMENTS
========================= */
const loadingEl = document.getElementById("loading");
const detailArea = document.getElementById("detailArea");
const headerSub = document.getElementById("headerSub");

/* =========================
   PARAMS
========================= */
const params = new URLSearchParams(window.location.search);

const detailId =
  params.get("id") ||
  params.get("kode") ||
  params.get("q") ||
  "";

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

function normalizeCode(value){
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
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

/*
  Mengubah berbagai kemungkinan format respons API menjadi array.

  Format yang didukung:
  [
    {...}
  ]

  {
    "success": true,
    "data": [...]
  }

  {
    "items": [...]
  }

  {
    "siki": [...]
  }

  {
    "relations": [...]
  }
*/
function toArray(data){
  if(Array.isArray(data)){
    return data;
  }

  if(!data || typeof data !== "object"){
    return [];
  }

  const possibleKeys = [
    "data",
    "items",
    "results",
    "records",
    "sdki",
    "slki",
    "siki",
    "relations",
    "relation",
    "diagnosis",
    "diagnosa",
    "intervensi",
    "outcomes"
  ];

  for(const key of possibleKeys){
    if(Array.isArray(data[key])){
      return data[key];
    }

    if(data[key] && typeof data[key] === "object"){
      const nestedResult = toArray(data[key]);

      if(nestedResult.length){
        return nestedResult;
      }
    }
  }

  /*
    Jangan langsung memakai Object.values pada respons API yang
    hanya berisi success dan message.
  */
  const values = Object.values(data);

  if(
    values.length &&
    values.every(value => value && typeof value === "object")
  ){
    return values;
  }

  return [];
}

function stringifyDeep(value){
  if(value === null || value === undefined){
    return "";
  }

  if(
    typeof value === "string" ||
    typeof value === "number"
  ){
    return String(value);
  }

  if(Array.isArray(value)){
    return value
      .map(stringifyDeep)
      .join(" ");
  }

  if(typeof value === "object"){
    return Object.values(value)
      .map(stringifyDeep)
      .join(" ");
  }

  return "";
}

function escapeHtml(text){
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getItemId(item){
  return pick(item, [
    "id",
    "kode",
    "code",
    "nomor",
    "no",
    "kodeSiki",
    "kode_siki"
  ]);
}

function getItemTitle(item){
  return pick(item, [
    "title",
    "judul",
    "nama",
    "intervensi",
    "namaIntervensi",
    "nama_intervensi",
    "label",
    "name"
  ]);
}

function getItemDesc(item){
  return pick(item, [
    "definisi",
    "deskripsi",
    "description",
    "keterangan"
  ]);
}

function getItemCategory(item){
  return pick(item, [
    "kategori",
    "category",
    "kelompok",
    "domain"
  ]);
}

function getItemSubCategory(item){
  return pick(item, [
    "subkategori",
    "sub_category",
    "subCategory",
    "kelas",
    "class"
  ]);
}

/*
  Mengubah string, array, atau object menjadi array teks.
*/
function arrayFromUnknown(value){
  if(
    value === undefined ||
    value === null ||
    value === ""
  ){
    return [];
  }

  if(Array.isArray(value)){
    return value
      .map(item => {
        if(
          typeof item === "string" ||
          typeof item === "number"
        ){
          return String(item).trim();
        }

        if(item && typeof item === "object"){
          return String(
            pick(item, [
              "tindakan",
              "aktivitas",
              "nama",
              "judul",
              "label",
              "text",
              "description",
              "deskripsi"
            ]) || stringifyDeep(item)
          ).trim();
        }

        return "";
      })
      .filter(Boolean);
  }

  if(typeof value === "string"){
    return value
      .split(/\n|;|\|/g)
      .map(item => item.trim())
      .filter(Boolean);
  }

  if(typeof value === "object"){
    return Object.values(value)
      .flatMap(arrayFromUnknown)
      .filter(Boolean);
  }

  return [String(value).trim()].filter(Boolean);
}

/*
  Mencari kelompok tindakan baik secara langsung maupun
  di dalam object tindakan/aktivitas.
*/
function getNestedAction(item, keys){
  for(const key of keys){
    if(
      item &&
      item[key] !== undefined &&
      item[key] !== null
    ){
      const result = arrayFromUnknown(item[key]);

      if(result.length){
        return result;
      }
    }
  }

  const actionContainers = [
    item?.tindakan,
    item?.aktivitas,
    item?.activities,
    item?.action,
    item?.intervensi,
    item?.tindakanKeperawatan,
    item?.tindakan_keperawatan
  ];

  for(const container of actionContainers){
    if(!container || typeof container !== "object"){
      continue;
    }

    for(const key of keys){
      if(
        container[key] !== undefined &&
        container[key] !== null
      ){
        const result = arrayFromUnknown(container[key]);

        if(result.length){
          return result;
        }
      }
    }
  }

  return [];
}

/* =========================
   FETCH API
========================= */
async function fetchJsonSafe(url){
  try{
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      cache: "no-cache"
    });

    if(!response.ok){
      throw new Error(
        `HTTP ${response.status} saat memuat ${url}`
      );
    }

    const result = await response.json();

    if(
      result &&
      typeof result === "object" &&
      result.success === false
    ){
      throw new Error(
        result.message ||
        `API mengembalikan status gagal: ${url}`
      );
    }

    return result;
  }catch(error){
    console.error("Gagal memuat API:", url, error);
    throw error;
  }
}

/* =========================
   CARI DATA SIKI
========================= */
function findSikiItem(list, id){
  const targetCode = normalizeCode(id);
  const targetText = normalizeText(id);

  if(!targetCode && !targetText){
    return null;
  }

  /*
    Prioritas pertama: kode sama persis.
  */
  const exactCode = list.find(item => {
    return normalizeCode(getItemId(item)) === targetCode;
  });

  if(exactCode){
    return exactCode;
  }

  /*
    Prioritas kedua: judul sama persis.
  */
  const exactTitle = list.find(item => {
    return normalizeText(getItemTitle(item)) === targetText;
  });

  if(exactTitle){
    return exactTitle;
  }

  /*
    Prioritas ketiga: pencarian sebagian.
  */
  return list.find(item => {
    const itemId = normalizeText(getItemId(item));
    const itemTitle = normalizeText(getItemTitle(item));

    return (
      itemId.includes(targetText) ||
      itemTitle.includes(targetText)
    );
  }) || null;
}

/* =========================
   RELATIONS HELPERS
========================= */
function getRelationDiagnosisCode(row){
  return pick(row, [
    "kodeSdki",
    "kode_sdki",
    "kodeDiagnosis",
    "kode_diagnosis",
    "idDiagnosis",
    "id_diagnosis",
    "kode",
    "id"
  ]);
}

function getRelationDiagnosisTitle(row){
  return pick(row, [
    "judulSdki",
    "judul_sdki",
    "diagnosis",
    "diagnosa",
    "namaDiagnosis",
    "nama_diagnosis",
    "judulDiagnosis",
    "judul_diagnosis",
    "judul",
    "nama",
    "sdki",
    "label"
  ]) || "Diagnosis terkait";
}

/*
  Mengambil seluruh SIKI yang terdapat dalam sebuah relation.

  Mendukung:
  - sikiUtama
  - sikiPendukung
  - siki
  - intervensi
*/
function getRelationSikiItems(row){
  const possibleFields = [
    "sikiUtama",
    "siki_utama",
    "sikiPendukung",
    "siki_pendukung",
    "siki",
    "intervensi",
    "interventions"
  ];

  const results = [];

  for(const field of possibleFields){
    const value = row?.[field];

    if(value === undefined || value === null){
      continue;
    }

    if(Array.isArray(value)){
      results.push(...value);
    }else{
      results.push(value);
    }
  }

  return results;
}

function relationSikiMatches(relationItem, sikiItem){
  const targetCode = normalizeCode(getItemId(sikiItem));
  const targetTitle = normalizeText(getItemTitle(sikiItem));

  if(
    typeof relationItem === "string" ||
    typeof relationItem === "number"
  ){
    const relationCode = normalizeCode(relationItem);
    const relationText = normalizeText(relationItem);

    return (
      (targetCode && relationCode === targetCode) ||
      (targetTitle && relationText === targetTitle)
    );
  }

  if(!relationItem || typeof relationItem !== "object"){
    return false;
  }

  const relationCode = normalizeCode(
    pick(relationItem, [
      "kode",
      "id",
      "code",
      "kodeSiki",
      "kode_siki"
    ])
  );

  const relationTitle = normalizeText(
    pick(relationItem, [
      "judul",
      "nama",
      "title",
      "label",
      "intervensi",
      "namaIntervensi",
      "nama_intervensi"
    ])
  );

  if(targetCode && relationCode === targetCode){
    return true;
  }

  if(targetTitle && relationTitle === targetTitle){
    return true;
  }

  /*
    Fallback jika struktur objek relation berbeda.
  */
  const completeText = normalizeText(
    stringifyDeep(relationItem)
  );

  return Boolean(
    (targetCode && normalizeCode(completeText).includes(targetCode)) ||
    (targetTitle && completeText.includes(targetTitle))
  );
}

/*
  Mencari diagnosis SDKI yang memiliki intervensi SIKI ini.
*/
function findRelatedDiagnoses(relations, sikiItem){
  const matched = relations.filter(row => {
    const relatedSiki = getRelationSikiItems(row);

    return relatedSiki.some(item => {
      return relationSikiMatches(item, sikiItem);
    });
  });

  /*
    Menghapus diagnosis duplikat.
  */
  const unique = new Map();

  matched.forEach(row => {
    const code = getRelationDiagnosisCode(row);
    const title = getRelationDiagnosisTitle(row);

    const key =
      normalizeCode(code) ||
      normalizeText(title);

    if(key && !unique.has(key)){
      unique.set(key, row);
    }
  });

  return Array.from(unique.values()).slice(0, 20);
}

/* =========================
   RENDER
========================= */
function renderEmpty(title, desc){
  detailArea.innerHTML = `
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

function renderTextSection(title, icon, text){
  if(!text){
    return "";
  }

  return `
    <section>
      <div class="section-title">
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(title)}</span>
      </div>

      <div class="detail-card">
        <div class="detail-text">
          ${escapeHtml(text)}
        </div>
      </div>
    </section>
  `;
}

function renderSimpleList(title, icon, items){
  if(!items || !items.length){
    return "";
  }

  return `
    <section>
      <div class="section-title">
        <i class="fa-solid ${icon}"></i>
        <span>${escapeHtml(title)}</span>
      </div>

      <div class="simple-list">
        ${items.map(item => `
          <div class="simple-item">
            ${escapeHtml(item)}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderActionSection(
  title,
  icon,
  className,
  items
){
  if(!items || !items.length){
    return "";
  }

  return `
    <div class="action-card">
      <div class="action-head">
        <div class="action-icon ${className}">
          <i class="fa-solid ${icon}"></i>
        </div>

        <div class="action-title">
          ${escapeHtml(title)}
        </div>
      </div>

      <ol class="action-list">
        ${items.map(item => `
          <li>${escapeHtml(item)}</li>
        `).join("")}
      </ol>
    </div>
  `;
}

function renderRelatedDiagnoses(items){
  if(!items.length){
    return "";
  }

  return `
    <section>
      <div class="section-title">
        <i class="fa-solid fa-link"></i>
        <span>Tautan Diagnosis SDKI</span>
      </div>

      ${items.map(row => {
        const title = getRelationDiagnosisTitle(row);
        const code = getRelationDiagnosisCode(row);

        /*
          Sesuaikan diagnosis-detail.html jika nama halaman
          detail SDKI di repo berbeda.
        */
        const url = code
          ? `diagnosis-detail.html?id=${encodeURIComponent(code)}`
          : "#";

        return `
          <a
            href="${url}"
            class="related-card native-click"
          >
            <div class="related-icon">
              <i class="fa-solid fa-stethoscope"></i>
            </div>

            <div class="related-body">
              <div class="related-title">
                ${escapeHtml(title)}
              </div>

              <div class="related-desc">
                ${
                  code
                    ? `Kode: ${escapeHtml(code)}`
                    : "Diagnosis SDKI terkait"
                }
              </div>
            </div>

            <i class="fa-solid fa-chevron-right chevron"></i>
          </a>
        `;
      }).join("")}
    </section>
  `;
}

function renderMetaGrid(id, category, subCategory){
  return `
    <section class="meta-grid detail-panel">
      <div class="meta-card">
        <div class="meta-label">Kode</div>
        <div class="meta-value">${escapeHtml(id || "-")}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Jenis</div>
        <div class="meta-value">Intervensi</div>
      </div>
      ${category ? `
        <div class="meta-card">
          <div class="meta-label">Kategori</div>
          <div class="meta-value">${escapeHtml(category)}</div>
        </div>` : ""}
      ${subCategory ? `
        <div class="meta-card">
          <div class="meta-label">Subkategori</div>
          <div class="meta-value">${escapeHtml(subCategory)}</div>
        </div>` : ""}
    </section>
  `;
}

function renderActions(observasi, terapeutik, edukasi, kolaborasi, aktivitas){
  return `
    <section class="detail-section">
      <div class="section-title">
        <i class="fa-solid fa-clipboard-list"></i>
        <span>Tindakan Keperawatan</span>
      </div>
      <div class="action-group">
        ${renderActionSection("Observasi", "fa-eye", "observasi", observasi)}
        ${renderActionSection("Terapeutik", "fa-hand-holding-heart", "terapeutik", terapeutik)}
        ${renderActionSection("Edukasi", "fa-person-chalkboard", "edukasi", edukasi)}
        ${renderActionSection("Kolaborasi", "fa-user-doctor", "kolaborasi", kolaborasi)}
        ${!observasi.length && !terapeutik.length && !edukasi.length && !kolaborasi.length
          ? renderActionSection("Aktivitas / Tindakan", "fa-list-ul", "observasi", aktivitas)
          : ""}
        ${!observasi.length && !terapeutik.length && !edukasi.length && !kolaborasi.length && !aktivitas.length
          ? `<div class="detail-card"><div class="detail-text">Data tindakan keperawatan belum tersedia.</div></div>`
          : ""}
      </div>
    </section>
  `;
}

function renderDetail(item, relatedDiagnoses){
  const id = getItemId(item);
  const title = getItemTitle(item) || "Intervensi SIKI";
  const desc = getItemDesc(item);
  const category = getItemCategory(item);
  const subCategory = getItemSubCategory(item);
  const tujuan = pick(item, ["tujuan", "goal", "target"]);
  const kriteria = arrayFromUnknown(pick(item, [
    "kriteria", "kriteriaHasil", "kriteria_hasil", "outcome", "indikator"
  ]));
  const observasi = getNestedAction(item, ["observasi", "observation", "observations"]);
  const terapeutik = getNestedAction(item, ["terapeutik", "therapeutic", "terapi", "therapy"]);
  const edukasi = getNestedAction(item, ["edukasi", "education", "pendidikan"]);
  const kolaborasi = getNestedAction(item, ["kolaborasi", "collaboration", "kolaboratif"]);
  const aktivitas = getNestedAction(item, [
    "aktivitas", "tindakan", "intervensi_tindakan", "actions", "activities"
  ]);

  document.title = `${title} - Detail SIKI`;
  headerSub.textContent = id
    ? `${id} • Standar Intervensi Keperawatan Indonesia`
    : "Standar Intervensi Keperawatan Indonesia";

  const hero = `
    <section class="hero-card">
      <div class="badge"><i class="fa-solid fa-hand-holding-medical"></i><span>SIKI</span></div>
      <div class="hero-title">${escapeHtml(title)}</div>
      ${desc ? `<div class="hero-desc">${escapeHtml(desc)}</div>` : ""}
    </section>`;

  const meta = renderMetaGrid(id, category, subCategory);
  const definition = renderTextSection("Definisi", "fa-circle-info", desc);
  const goal = renderTextSection("Tujuan", "fa-bullseye", tujuan);
  const criteria = renderSimpleList("Kriteria / Indikator", "fa-list-check", kriteria);
  const actions = renderActions(observasi, terapeutik, edukasi, kolaborasi, aktivitas);
  const related = renderRelatedDiagnoses(relatedDiagnoses);

  detailArea.innerHTML = `
    ${hero}

    <div class="siki-mobile-flow">
      ${meta}
      ${definition}
      ${goal}
      ${criteria}
      ${actions}
      ${related}
    </div>

    <div class="siki-desktop-layout">
      <div class="detail-column">
        ${definition}
        ${goal}
        ${criteria}
        ${actions}
      </div>
      <div class="detail-column">
        ${meta}
        ${related}
      </div>
    </div>
  `;
}

/* =========================
   LOAD DETAIL
========================= */
async function loadDetail(){
  loadingEl.style.display = "flex";
  detailArea.innerHTML = "";

  if(!detailId){
    loadingEl.style.display = "none";

    renderEmpty(
      "ID intervensi tidak ditemukan",
      "Halaman ini membutuhkan parameter id. Contoh: siki-detail.html?id=I.01011"
    );

    return;
  }

  try{
    /*
      Halaman detail SIKI hanya membutuhkan:
      1. Data SIKI
      2. Data relations

      Endpoint SDKI dan SLKI belum perlu dimuat di halaman ini.
    */
    const [sikiResponse, relationsResponse] =
      await Promise.all([
        fetchJsonSafe(API_ENDPOINTS.siki),
        fetchJsonSafe(API_ENDPOINTS.relations)
      ]);

    const sikiList = toArray(sikiResponse);
    const relationsList = toArray(relationsResponse);

    console.log("Jumlah data SIKI:", sikiList.length);
    console.log("Jumlah data relations:", relationsList.length);

    const item = findSikiItem(
      sikiList,
      detailId
    );

    loadingEl.style.display = "none";

    if(!item){
      renderEmpty(
        "Intervensi tidak ditemukan",
        `Data SIKI dengan kode atau kata kunci "${detailId}" tidak ditemukan.`
      );

      return;
    }

    const relatedDiagnoses = findRelatedDiagnoses(
      relationsList,
      item
    );

    console.log(
      "Diagnosis terkait:",
      relatedDiagnoses
    );

    renderDetail(
      item,
      relatedDiagnoses
    );
  }catch(error){
    console.error("Load detail gagal:", error);

    loadingEl.style.display = "none";

    renderEmpty(
      "Data gagal dimuat",
      "Tidak dapat terhubung ke API ASKEP. Periksa endpoint Worker, pengaturan CORS, dan isi respons API."
    );
  }
}

/* =========================
   RIPPLE EFFECT
========================= */
document.addEventListener("click", function(event){
  const element = event.target.closest(".native-click");

  if(!element){
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

  window.setTimeout(() => {
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
loadDetail();