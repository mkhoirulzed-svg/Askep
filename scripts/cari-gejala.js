const DATA_PATH =
  "https://askep.mkhoirulzed.workers.dev/api/sdki";

let SDKI = [];

const symptomInput = document.getElementById("symptomInput");
const searchBtn = document.getElementById("searchBtn");
const clearBtn = document.getElementById("clearBtn");
const statusBox = document.getElementById("statusBox");
const resultList = document.getElementById("resultList");
const resultCount = document.getElementById("resultCount");

function setStatus(message, show = true){
  statusBox.classList.toggle("show", show);

  const statusText = statusBox.querySelector("span");

  if(statusText){
    statusText.textContent = message || "";
  }
}

function normalizeText(text){
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text){
  const stopWords = new Set([
    "dan",
    "atau",
    "yang",
    "dengan",
    "pada",
    "dari",
    "ke",
    "di",
    "ini",
    "itu",
    "pasien",
    "klien",
    "mengeluh",
    "merasa",
    "terasa",
    "ada",
    "tampak",
    "terlihat",
    "mengalami",
    "keluhan",
    "gejala"
  ]);

  return normalizeText(text)
    .split(" ")
    .filter(word => {
      return word.length >= 3 && !stopWords.has(word);
    });
}

function uniqueArray(arr){
  return [
    ...new Set(
      arr.filter(Boolean)
    )
  ];
}

function toArray(value){
  if(Array.isArray(value)){
    return value;
  }

  if(!value){
    return [];
  }

  if(typeof value === "string"){
    return [value];
  }

  if(typeof value === "object"){
    return Object.values(value).flatMap(item => {
      return toArray(item);
    });
  }

  return [];
}

function getGejalaMayor(item){
  return uniqueArray([
    ...toArray(item.gejalaMayor),
    ...toArray(item.tandaGejalaMayor),
    ...toArray(item.tanda_dan_gejala_mayor),
    ...toArray(item.tandaMayor),
    ...toArray(item.mayor)
  ]);
}

function getGejalaMinor(item){
  return uniqueArray([
    ...toArray(item.gejalaMinor),
    ...toArray(item.tandaGejalaMinor),
    ...toArray(item.tanda_dan_gejala_minor),
    ...toArray(item.tandaMinor),
    ...toArray(item.minor)
  ]);
}

function buildSearchSources(item){
  const mayor = getGejalaMayor(item);
  const minor = getGejalaMinor(item);

  const penyebab = uniqueArray([
    ...toArray(item.penyebab),
    ...toArray(item.etiologi)
  ]);

  const kondisiKlinis = uniqueArray([
    ...toArray(item.kondisiKlinis),
    ...toArray(item.kondisi_klinis)
  ]);

  return {
    mayor,
    minor,
    penyebab,
    kondisiKlinis
  };
}

function matchDiagnosis(item, query){
  const queryTokens = tokenize(query);
  const sources = buildSearchSources(item);

  const mayorText = normalizeText(
    sources.mayor.join(" ")
  );

  const minorText = normalizeText(
    sources.minor.join(" ")
  );

  const penyebabText = normalizeText(
    sources.penyebab.join(" ")
  );

  const kondisiText = normalizeText(
    sources.kondisiKlinis.join(" ")
  );

  const namaText = normalizeText(`
    ${item.nama || ""}
    ${item.judul || ""}
    ${item.definisi || ""}
  `);

  let score = 0;

  const matchedMayor = [];
  const matchedMinor = [];
  const matchedOther = [];

  queryTokens.forEach(token => {
    if(mayorText.includes(token)){
      score += 5;
      matchedMayor.push(token);
    }

    if(minorText.includes(token)){
      score += 3;
      matchedMinor.push(token);
    }

    if(
      penyebabText.includes(token) ||
      kondisiText.includes(token) ||
      namaText.includes(token)
    ){
      score += 1;
      matchedOther.push(token);
    }
  });

  const fullQuery = normalizeText(query);

  sources.mayor.forEach(gejala => {
    const normalizedGejala = normalizeText(gejala);

    if(
      normalizedGejala &&
      (
        fullQuery.includes(normalizedGejala) ||
        normalizedGejala.includes(fullQuery)
      )
    ){
      score += 8;
      matchedMayor.push(gejala);
    }
  });

  sources.minor.forEach(gejala => {
    const normalizedGejala = normalizeText(gejala);

    if(
      normalizedGejala &&
      (
        fullQuery.includes(normalizedGejala) ||
        normalizedGejala.includes(fullQuery)
      )
    ){
      score += 5;
      matchedMinor.push(gejala);
    }
  });

  return {
    item,
    score,
    matchedMayor:uniqueArray(matchedMayor),
    matchedMinor:uniqueArray(matchedMinor),
    matchedOther:uniqueArray(matchedOther)
  };
}

function highlightMatchedSymptoms(
  symptoms,
  tokens,
  max = 4
){
  const normalizedTokens = tokens.map(normalizeText);

  return symptoms
    .filter(symptom => {
      const normalizedSymptom = normalizeText(symptom);

      return normalizedTokens.some(token => {
        return (
          normalizedSymptom.includes(token) ||
          token.includes(normalizedSymptom)
        );
      });
    })
    .slice(0, max);
}

function getDetailUrl(item){
  const key =
    item.id ||
    item.kode ||
    item.nama ||
    item.judul ||
    "";

  return `diagnosis-detail.html?id=${encodeURIComponent(key)}`;
}

function escapeHtml(text){
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderEmpty(
  title,
  message,
  icon = "fa-magnifying-glass"
){
  resultList.innerHTML = `
    <div class="empty">
      <i class="fa-solid ${icon}"></i>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;

  resultCount.textContent = "0 diagnosis";
}

function renderResults(results, query){
  if(!query.trim()){
    renderEmpty(
      "Masukkan gejala terlebih dahulu",
      "Contoh: nyeri dada, sesak napas, gelisah, sulit tidur.",
      "fa-keyboard"
    );

    return;
  }

  if(!results.length){
    renderEmpty(
      "Belum ada diagnosis yang cocok",
      "Coba gunakan kata kunci lain atau masukkan beberapa gejala sekaligus.",
      "fa-circle-exclamation"
    );

    return;
  }

  resultCount.textContent =
    `${results.length} diagnosis`;

  resultList.innerHTML = results
    .map(result => {
      const item = result.item;
      const sources = buildSearchSources(item);

      const mayorHits = highlightMatchedSymptoms(
        sources.mayor,
        [
          ...result.matchedMayor,
          ...tokenize(query)
        ]
      );

      const minorHits = highlightMatchedSymptoms(
        sources.minor,
        [
          ...result.matchedMinor,
          ...tokenize(query)
        ]
      );

      const nama =
        item.nama ||
        item.judul ||
        "Diagnosis tanpa nama";

      const kode =
        item.kode ||
        item.id ||
        "-";

      const kategori =
        item.kategori ||
        "Tanpa kategori";

      const subkategori =
        item.subkategori ||
        item.subKategori ||
        "";

      const matchItems = [];

      if(mayorHits.length){
        matchItems.push(`
          <b>Mayor:</b>

          <ul class="match-list">
            ${mayorHits
              .map(gejala => {
                return `
                  <li>${escapeHtml(gejala)}</li>
                `;
              })
              .join("")}
          </ul>
        `);
      }

      if(minorHits.length){
        matchItems.push(`
          <b>Minor:</b>

          <ul class="match-list">
            ${minorHits
              .map(gejala => {
                return `
                  <li>${escapeHtml(gejala)}</li>
                `;
              })
              .join("")}
          </ul>
        `);
      }

      if(!matchItems.length){
        const matchedWords = uniqueArray([
          ...result.matchedMayor,
          ...result.matchedMinor,
          ...result.matchedOther
        ])
          .slice(0, 8)
          .join(", ");

        matchItems.push(`
          <b>Kata cocok:</b>
          ${escapeHtml(matchedWords || query)}
        `);
      }

      return `
        <article
          class="dx-card native-click"
          data-url="${escapeHtml(getDetailUrl(item))}"
          tabindex="0"
          role="link"
        >
          <div class="dx-top">

            <div class="dx-title">
              <span class="dx-code">
                ${escapeHtml(kode)}
              </span>

              <h4>
                ${escapeHtml(nama)}
              </h4>
            </div>

            <div class="score-badge">
              <i class="fa-solid fa-check"></i>
              ${result.score}
            </div>

          </div>

          <div class="meta-row">
            <span class="meta">
              ${escapeHtml(kategori)}
            </span>

            ${
              subkategori
                ? `
                  <span class="meta">
                    ${escapeHtml(subkategori)}
                  </span>
                `
                : ""
            }
          </div>

          <div class="match-box">
            ${matchItems.join("")}
          </div>
        </article>
      `;
    })
    .join("");

  activateResultCards();
}

function activateResultCards(){
  document
    .querySelectorAll(".dx-card[data-url]")
    .forEach(card => {
      card.addEventListener("click", () => {
        const url = card.dataset.url;

        if(url){
          location.href = url;
        }
      });

      card.addEventListener("keydown", event => {
        if(
          event.key === "Enter" ||
          event.key === " "
        ){
          event.preventDefault();

          const url = card.dataset.url;

          if(url){
            location.href = url;
          }
        }
      });
    });
}

function doSearch(){
  const query = symptomInput.value.trim();

  if(!SDKI.length){
    renderEmpty(
      "Data SDKI belum tersedia",
      "Data SDKI belum berhasil dimuat dari server.",
      "fa-database"
    );

    return;
  }

  const results = SDKI
    .map(item => {
      return matchDiagnosis(item, query);
    })
    .filter(result => {
      return result.score > 0;
    })
    .sort((a, b) => {
      return b.score - a.score;
    })
    .slice(0, 30);

  renderResults(results, query);
}

async function loadData(){
  try{
    setStatus("Memuat data SDKI...");

    const response = await fetch(DATA_PATH, {
      cache:"no-store"
    });

    if(!response.ok){
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    const responseData = await response.json();

    if(Array.isArray(responseData)){
      SDKI = responseData;
    }else if(Array.isArray(responseData.data)){
      SDKI = responseData.data;
    }else if(Array.isArray(responseData.sdkis)){
      SDKI = responseData.sdkis;
    }else{
      SDKI = [];
    }

    setStatus(
      `Data SDKI siap digunakan: ${SDKI.length} diagnosis.`,
      true
    );

    window.setTimeout(() => {
      setStatus("", false);
    }, 1800);

    renderEmpty(
      "Masukkan gejala pasien",
      "Sistem akan mencocokkan gejala dengan data mayor dan minor SDKI.",
      "fa-stethoscope"
    );
  }catch(error){
    console.error(
      "Gagal memuat data SDKI:",
      error
    );

    setStatus(
      "Gagal memuat data SDKI dari server.",
      true
    );

    renderEmpty(
      "Gagal memuat data",
      "Periksa koneksi internet dan endpoint API SDKI.",
      "fa-triangle-exclamation"
    );
  }
}

searchBtn.addEventListener("click", doSearch);

symptomInput.addEventListener("keydown", event => {
  if(
    event.key === "Enter" &&
    (
      event.ctrlKey ||
      event.metaKey
    )
  ){
    event.preventDefault();
    doSearch();
  }
});

symptomInput.addEventListener("input", () => {
  clearTimeout(window.__symptomTimer);

  window.__symptomTimer = setTimeout(() => {
    doSearch();
  }, 400);
});

clearBtn.addEventListener("click", () => {
  symptomInput.value = "";

  renderEmpty(
    "Masukkan gejala pasien",
    "Contoh: nyeri dada, sesak napas, gelisah, sulit tidur.",
    "fa-stethoscope"
  );

  symptomInput.focus();
});

document
  .querySelectorAll(".chip[data-example]")
  .forEach(chip => {
    chip.addEventListener("click", () => {
      symptomInput.value =
        chip.dataset.example || "";

      doSearch();
    });
  });

loadData();
