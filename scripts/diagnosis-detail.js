const DATA_PATHS = {
  sdki: "https://askep.mkhoirulzed.workers.dev/api/sdki",
  slki: "https://askep.mkhoirulzed.workers.dev/api/slki",
  siki: "https://askep.mkhoirulzed.workers.dev/api/siki",
  relations: "https://askep.mkhoirulzed.workers.dev/api/relations"
};

let DB = {
  sdki: [],
  slki: [],
  siki: [],
  relations: []
};

let diagnosis = null;
let currentId = "";
let currentQuery = "";

const heroArea = document.getElementById("heroArea");
const contentArea = document.getElementById("contentArea");
const favBtn = document.getElementById("favBtn");

/* =========================
   HELPER DASAR
========================= */
function normalizeText(text){
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g," ")
    .trim();
}

function toArray(data){
  if(Array.isArray(data)) return data;
  if(data && Array.isArray(data.data)) return data.data;
  if(data && Array.isArray(data.items)) return data.items;
  if(data && Array.isArray(data.diagnosis)) return data.diagnosis;
  if(data && Array.isArray(data.diagnoses)) return data.diagnoses;
  if(data && typeof data === "object") return Object.values(data);
  return [];
}

function pick(obj, keys){
  for(const key of keys){
    if(obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== ""){
      return obj[key];
    }
  }
  return "";
}

function stringifyDeep(value){
  if(value === null || value === undefined) return "";
  if(typeof value === "string" || typeof value === "number") return String(value);
  if(Array.isArray(value)) return value.map(stringifyDeep).join(" ");
  if(typeof value === "object") return Object.values(value).map(stringifyDeep).join(" ");
  return "";
}

function escapeHtml(text){
  return String(text || "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getId(item){
  return pick(item, [
    "id",
    "kode",
    "code",
    "nomor",
    "no",
    "kodeDiagnosis",
    "kode_diagnosis",
    "kodeSdki",
    "kode_sdki"
  ]);
}

function getSdkiCode(item){
  return pick(item, [
    "kode",
    "kodeDiagnosis",
    "kode_diagnosis",
    "kodeSdki",
    "kode_sdki",
    "code",
    "nomor",
    "no"
  ]);
}

function getJenis(item){
  return pick(item, [
    "jenis",
    "tipe",
    "type",
    "jenisDiagnosis",
    "jenis_diagnosis"
  ]);
}

function getKategori(item){
  return pick(item, [
    "kategori",
    "category"
  ]);
}

function getSubkategori(item){
  return pick(item, [
    "subkategori",
    "subKategori",
    "sub_kategori",
    "subcategory"
  ]);
}                

function getTitle(item){
  return pick(item, [
    "title",
    "judul",
    "nama",
    "diagnosis",
    "diagnosa",
    "label",
    "name",
    "namaDiagnosis",
    "nama_diagnosis"
  ]);
}

function getDesc(item){
  return pick(item, [
    "definisi",
    "deskripsi",
    "description",
    "keterangan"
  ]);
}

function getArrayField(item, keys){
  for(const key of keys){
    const value = item?.[key];

    if(Array.isArray(value)) return value;

    if(value && typeof value === "object"){
      return Object.values(value).flat();
    }

    if(typeof value === "string" && value.trim()){
      return value
        .split(/\n|;|•|- /)
        .map(x => x.trim())
        .filter(Boolean);
    }
  }

  return [];
}

async function fetchJsonSafe(path){
  try{
    const res = await fetch(path + "?v=" + Date.now());

    if(!res.ok){
      throw new Error("Gagal memuat " + path);
    }

    return await res.json();

  }catch(err){
    console.warn(err.message);
    return [];
  }
}

/* =========================
   LOAD DATA
========================= */
async function loadData(){
  const params = new URLSearchParams(location.search);

  currentId = params.get("id") || params.get("diagnosis") || "";
  currentQuery = params.get("q") || "";

  if(!currentId && !currentQuery){
    renderNotFound("ID diagnosis tidak ditemukan.");
    return;
  }

  const [sdki, slki, siki, relations] = await Promise.all([
    fetchJsonSafe(DATA_PATHS.sdki),
    fetchJsonSafe(DATA_PATHS.slki),
    fetchJsonSafe(DATA_PATHS.siki),
    fetchJsonSafe(DATA_PATHS.relations)
  ]);

  DB.sdki = toArray(sdki);
  DB.slki = toArray(slki);
  DB.siki = toArray(siki);
  DB.relations = toArray(relations);

  diagnosis = findDiagnosis(currentId, currentQuery);

  if(!diagnosis){
    renderNotFound("Diagnosis tidak ditemukan di sdki.json.");
    return;
  }

  renderPage();
  updateFavIcon();
}

function findDiagnosis(id, q){
  const targetId = normalizeCode(id);
  const targetText = normalizeText(q || id);

  return DB.sdki.find(item => {
    const itemId = normalizeCode(getId(item));
    const itemCode = normalizeCode(getSdkiCode(item));
    const itemTitle = normalizeText(getTitle(item));

    return (
      itemId === targetId ||
      itemCode === targetId ||
      itemTitle === targetText ||
      itemTitle.includes(targetText) ||
      targetText.includes(itemTitle)
    );
  }) || null;
}

/* =========================
   RENDER HALAMAN
========================= */
function renderPage(){
  const id = getId(diagnosis);
  const kode = getSdkiCode(diagnosis);
  const title = getTitle(diagnosis);
  const desc = getDesc(diagnosis);

  const jenis = getJenis(diagnosis) || "Diagnosis Keperawatan";
  const kategori = getKategori(diagnosis);
  const subkategori = getSubkategori(diagnosis);

  heroArea.innerHTML = `
    <section class="hero-card">
      <div class="badge">
        <i class="fa-solid fa-stethoscope"></i>
        SDKI
      </div>

      <div class="diag-title">${escapeHtml(title || "Diagnosis")}</div>

      <div class="action-row">
        <button class="action-btn native-click" onclick="goQuickAskep()">
          <i class="fa-solid fa-bolt"></i>
          Quick Askep
        </button>

        <button class="action-btn native-click" onclick="copyDiagnosis()">
          <i class="fa-regular fa-copy"></i>
          Salin
        </button>
      </div>
    </section>
  `;

  const penyebab = getArrayField(diagnosis, [
    "penyebab",
    "etiologi",
    "cause",
    "causes"
  ]);

  const mayor = getArrayField(diagnosis, [
    "gejalaMayor",
    "gejala_mayor",
    "mayor",
    "dataMayor",
    "tandaMayor",
    "tanda_gejala_mayor"
  ]);

  const minor = getArrayField(diagnosis, [
    "gejalaMinor",
    "gejala_minor",
    "minor",
    "dataMinor",
    "tandaMinor",
    "tanda_gejala_minor"
  ]);

  const faktorRisiko = getArrayField(diagnosis, [
    "faktorRisiko",
    "faktor_risiko",
    "faktorResiko",
    "faktor_resiko",
    "riskFactors",
    "risk_factors"
  ]);

 const kondisi = getArrayField(diagnosis, [
  "kondisiKlinis",
  "kondisi_klinis",
  "kondisiKlinisTerkait",
  "kondisi_klinis_terkait",
  "kondisiTerkait",
  "kondisi_terkait",
  "kondisi"
]);

  const slkiLinks = getRelatedSlki();
  const sikiLinks = getRelatedSiki();

  const isDiagnosisRisiko =
    normalizeText(jenis).includes("risiko") ||
    normalizeText(title).startsWith("risiko");

  // Pada sebagian data SDKI, faktor risiko disimpan di field "penyebab".
  // Prioritaskan field faktor risiko khusus; jika kosong, gunakan penyebab.
  const faktorRisikoTampil = faktorRisiko.length ? faktorRisiko : penyebab;

  contentArea.innerHTML = `
    ${renderTextSection("Definisi", "fa-circle-info", desc || "Definisi belum tersedia.")}

    ${renderInfoGrid()}

    ${
      isDiagnosisRisiko
        ? renderListSection("Faktor Risiko", "fa-triangle-exclamation", faktorRisikoTampil)
        : `
            ${renderListSection("Penyebab", "fa-link", penyebab)}
            ${renderListSection("Gejala dan Tanda Mayor", "fa-circle-check", mayor)}
            ${renderListSection("Gejala dan Tanda Minor", "fa-list-check", minor)}
          `
    }

    ${renderListSection("Kondisi Klinis Terkait", "fa-hospital-user", kondisi)}

    ${renderRelatedSection("Luaran SLKI Terkait", "fa-chart-line", slkiLinks, "slki")}

    ${renderRelatedSection("Intervensi SIKI Terkait", "fa-hand-holding-medical", sikiLinks, "siki")}
  `;
}

function renderTextSection(title, icon, text){
  return `
    <section class="card">
      <h2 class="section-title">
        <i class="fa-solid ${icon}"></i>
        ${escapeHtml(title)}
      </h2>
      <div class="text copy-text">${escapeHtml(text)}</div>
    </section>
  `;
}  

function renderInfoGrid(){
  const kode = getSdkiCode(diagnosis);
  const jenis = getJenis(diagnosis) || "Diagnosis Keperawatan";
  const kategori = getKategori(diagnosis);
  const subkategori = getSubkategori(diagnosis);

  return `
    <section class="card">
      <h2 class="section-title">
        <i class="fa-solid fa-id-card-clip"></i>
        Informasi Diagnosis
      </h2>

      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">Kode</div>
          <div class="info-value">${escapeHtml(kode || "-")}</div>
        </div>

        <div class="info-box">
          <div class="info-label">Jenis</div>
          <div class="info-value">${escapeHtml(jenis || "-")}</div>
        </div>

        <div class="info-box">
          <div class="info-label">Kategori</div>
          <div class="info-value">${escapeHtml(kategori || "-")}</div>
        </div>

        <div class="info-box">
          <div class="info-label">Subkategori</div>
          <div class="info-value">${escapeHtml(subkategori || "-")}</div>
        </div>
      </div>
    </section>
  `;
}
  
function renderListSection(title, icon, items){
  return `
    <section class="card">
      <h2 class="section-title">
        <i class="fa-solid ${icon}"></i>
        ${escapeHtml(title)}
      </h2>

      ${
        items.length
          ? `<ul class="list copy-text">${items.map(item => `<li>${escapeHtml(stringifyDeep(item))}</li>`).join("")}</ul>`
          : `<div class="empty">Data belum tersedia.</div>`
      }
    </section>
  `;
}

function renderRelatedSection(title, icon, items, type){
  return `
    <section class="card">
      <h2 class="section-title">
        <i class="fa-solid ${icon}"></i>
        ${escapeHtml(title)}
      </h2>

      ${
        items.length
          ? `<div class="link-list">${items.map(item => renderRelatedCard(item, type)).join("")}</div>`
          : `<div class="empty">Belum ada tautan terkait.</div>`
      }
    </section>
  `;
}

function renderRelatedCard(item, type){
  const id = getId(item);
  const title = getTitle(item);
  const desc = getDesc(item);

  const hasDetail = id && !item._noDetail;

  const url = type === "siki"
    ? `siki-detail.html?id=${encodeURIComponent(id)}`
    : `slki-detail.html?id=${encodeURIComponent(id)}`;

  const tag = hasDetail ? "a" : "div";
  const attr = hasDetail ? `href="${url}"` : "";

  const subText = item._kategori
    ? item._kategori + (id ? " • Kode: " + id : " • dari tautansiki.json")
    : id
      ? "Kode: " + id
      : desc || "Lihat detail";

  return `
    <${tag} ${attr} class="link-card native-click">
      <div class="link-icon">
        <i class="fa-solid ${type === "siki" ? "fa-hand-holding-medical" : "fa-chart-line"}"></i>
      </div>

      <div class="link-body">
        <div class="link-title">${escapeHtml(title || "Tanpa Judul")}</div>
        <div class="link-sub">${escapeHtml(subText)}</div>
      </div>

      ${hasDetail ? `<i class="fa-solid fa-chevron-right chevron"></i>` : ``}
    </${tag}>
  `;
}
/* =========================
   RELASI SDKI → SLKI / SIKI
   Sumber utama: master-relations.json
   File slki.json dan siki.json hanya melengkapi detail.
========================= */
function getCurrentRelation(){
  if(!diagnosis) return null;

  const kodeDiagnosis = normalizeCodeSafe(
    getSdkiCode(diagnosis) || getId(diagnosis)
  );

  const judulDiagnosis = normalizeNameSafe(getTitle(diagnosis));

  return DB.relations.find(row => {
    const kodeRelasi = normalizeCodeSafe(
      pick(row, ["kodeSdki", "kode_sdki", "sdkiKode", "kode"])
    );

    const judulRelasi = normalizeNameSafe(
      pick(row, ["judulSdki", "judul_sdki", "judul", "nama"])
    );

    return (
      (kodeDiagnosis && kodeRelasi === kodeDiagnosis) ||
      (judulDiagnosis && judulRelasi === judulDiagnosis)
    );
  }) || null;
}

function mergeRelationDetail(ref, masterItems, type, kategori){
  const refKode = normalizeCodeSafe(
    pick(ref, ["kode", "id", "code"])
  );

  const refJudul = String(
    pick(ref, ["judul", "nama", "title", "judul_pdf"]) || ""
  ).trim();

  const matched = masterItems.find(item => {
    const itemKode = normalizeCodeSafe(getId(item));
    const itemJudul = normalizeNameSafe(getTitle(item));

    return (
      (refKode && itemKode === refKode) ||
      (refJudul && itemJudul === normalizeNameSafe(refJudul))
    );
  });

  if(matched){
    return {
      ...matched,
      // Fallback bila judul pada file detail kosong.
      judul: getTitle(matched) || refJudul || refKode,
      kode: getId(matched) || refKode,
      _kategori: kategori,
      _sourcePage: ref.page ?? null,
      _matchMethod: ref.match_method ?? null,
      _score: ref.score ?? null,
      _noDetail: false
    };
  }

  // Relasi tetap ditampilkan walaupun detail belum ada di slki/siki.json.
  return {
    id: refKode,
    kode: refKode,
    judul: refJudul || refKode || (type === "siki" ? "Intervensi" : "Luaran"),
    nama: refJudul || refKode,
    _kategori: kategori,
    _sourcePage: ref.page ?? null,
    _matchMethod: ref.match_method ?? null,
    _score: ref.score ?? null,
    _noDetail: true
  };
}

function getRelatedSiki(){
  const relation = getCurrentRelation();
  if(!relation) return [];

  const utama = Array.isArray(relation.sikiUtama)
    ? relation.sikiUtama.map(ref =>
        mergeRelationDetail(ref, DB.siki, "siki", "Intervensi Utama")
      )
    : [];

  const pendukung = Array.isArray(relation.sikiPendukung)
    ? relation.sikiPendukung.map(ref =>
        mergeRelationDetail(ref, DB.siki, "siki", "Intervensi Pendukung")
      )
    : [];

  return uniqueByIdOrTitle([...utama, ...pendukung]);
}

function getRelatedSlki(){
  const relation = getCurrentRelation();
  if(!relation || !Array.isArray(relation.slki)) return [];

  return uniqueByIdOrTitle(
    relation.slki.map(ref =>
      mergeRelationDetail(ref, DB.slki, "slki", "Luaran SLKI")
    )
  );
}

function normalizeNameSafe(text){
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCodeSafe(text){
  return String(text || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^\w.]/g, "")
    .trim();
}

function normalizeCode(text){
  return normalizeCodeSafe(text);
}

function uniqueByIdOrTitle(items){
  const seen = new Set();

  return items.filter(item => {
    const key = normalizeCodeSafe(getId(item)) || normalizeNameSafe(getTitle(item));
    if(!key || seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

/* =========================
   NOT FOUND
========================= */
function renderNotFound(message){
  heroArea.innerHTML = "";

  contentArea.innerHTML = `
    <div class="empty-state">
      <div style="font-size:34px;color:var(--primary);margin-bottom:10px;">
        <i class="fa-solid fa-circle-exclamation"></i>
      </div>

      <strong>${escapeHtml(message)}</strong>

      <br><br>

      <a href="search.html" style="color:var(--primary);font-weight:800;">
        Kembali ke pencarian
      </a>
    </div>
  `;
}

/* =========================
   FAVORIT
========================= */
function getFavs(){
  try{
    return JSON.parse(localStorage.getItem("nurselink_favorites") || "[]");
  }catch{
    return [];
  }
}

function saveFavs(favs){
  localStorage.setItem("nurselink_favorites", JSON.stringify(favs));
}

function updateFavIcon(){
  const favs = getFavs();
 const id = getSdkiCode(diagnosis) || getId(diagnosis);

  const exists = favs.some(item => item.type === "sdki" && item.id === id);

  favBtn.innerHTML = exists
    ? `<i class="fa-solid fa-bookmark"></i>`
    : `<i class="fa-regular fa-bookmark"></i>`;
}

favBtn.addEventListener("click", () => {
  if(!diagnosis) return;

  let favs = getFavs();
  const id = getSdkiCode(diagnosis) || getId(diagnosis);

  const exists = favs.some(item => item.type === "sdki" && item.id === id);

  if(exists){
    favs = favs.filter(item => !(item.type === "sdki" && item.id === id));
  }else{
    favs.unshift({
      type:"sdki",
      id,
      title:getTitle(diagnosis),
      url:`diagnosis-detail.html?id=${encodeURIComponent(id)}`
    });
  }

  saveFavs(favs);
  updateFavIcon();
});

/* =========================
   ACTION
========================= */
function copyDiagnosis(){
  if(!diagnosis) return;

  const sikiLinks = getRelatedSiki();

  const text = [
    `Diagnosis Keperawatan: ${getTitle(diagnosis)}`,
    `Kode: ${getSdkiCode(diagnosis) || "-"}`,
    ``,
    `Definisi:`,
    getDesc(diagnosis) || "-",
    ``,
    `Intervensi SIKI Terkait:`,
    sikiLinks.length
      ? sikiLinks.map(item => `- ${getTitle(item)}${getId(item) ? " (" + getId(item) + ")" : ""}`).join("\n")
      : "-"
  ].join("\n");

  navigator.clipboard.writeText(text).then(() => {
    alert("Diagnosis berhasil disalin.");
  });
}

function goQuickAskep(){
  if(!diagnosis) return;

  const kode = getSdkiCode(diagnosis) || getId(diagnosis);
  const title = getTitle(diagnosis);

  location.href =
    `quick-askep.html?diagnosis=${encodeURIComponent(kode)}&q=${encodeURIComponent(title)}`;
}

/* =========================
   RIPPLE
========================= */
document.addEventListener("click", function(e){
  const el = e.target.closest(".native-click");
  if(!el) return;

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

/* Blokir text select kecuali area copy */
document.addEventListener("selectstart", function(e){
  const allow = e.target.closest("input, textarea, select, .copy-text");
  if(!allow) e.preventDefault();
});

/* =========================
   INIT
========================= */
loadData();
