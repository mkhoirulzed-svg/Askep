/* =========================================================
   SERVICE WORKER ASKEP
   SDKI • SLKI • SIKI
   ========================================================= */

/*
 * Naikkan nomor versi setiap kali ada perubahan besar.
 * Contoh:
 * askep-v1.0.0 → askep-v1.0.1
 */
const APP_VERSION = "askep-v1.0.0";

const APP_CACHE = `${APP_VERSION}-app`;
const RUNTIME_CACHE = `${APP_VERSION}-runtime`;
const API_CACHE = `${APP_VERSION}-api`;

/*
 * API Cloudflare Worker ASKEP.
 */
const API_ORIGINS = [
  "https://askep.mkhoirulzed.workers.dev"
];

/*
 * Seluruh file utama yang akan disimpan ketika aplikasi
 * pertama kali dipasang.
 *
 * Path relatif membuatnya tetap bekerja di:
 * https://mkhoirulzed-svg.github.io/Askep/
 */
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",

  /* Ikon aplikasi */
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon.png",

  /* Halaman */
  "./pages/askep-lengkap.html",
  "./pages/cari-gejala.html",
  "./pages/diagnosis-detail.html",
  "./pages/favorit.html",
  "./pages/kasus.html",
  "./pages/profil.html",
  "./pages/quick-askep.html",
  "./pages/sdki.html",
  "./pages/search.html",
  "./pages/siki-detail.html",
  "./pages/siki.html",
  "./pages/slki-detail.html",
  "./pages/slki.html",
  "./pages/soap.html",

  /* JavaScript */
  "./scripts/cari-gejala.js",
  "./scripts/diagnosis-detail.js",
  "./scripts/sdki.js",
  "./scripts/siki-detail.js",
  "./scripts/siki.js",
  "./scripts/slki.js",

  /* CSS */
  "./styles/cari-gejala.css",
  "./styles/components.css",
  "./styles/daftar-standar.css",
  "./styles/detail-standar.css",
  "./styles/diagnosis-detail.css",
  "./styles/global.css",
  "./styles/layout.css",
  "./styles/profil.css",
  "./styles/responsive.css",
  "./styles/search.css",
  "./styles/siki-detail.css"
];

/* =========================================================
   INSTALL
   Menyimpan file inti aplikasi.
   ========================================================= */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_CACHE);

      /*
       * Menggunakan Promise.allSettled agar satu file yang gagal
       * tidak menggagalkan pemasangan seluruh service worker.
       */
      const results = await Promise.allSettled(
        APP_SHELL.map(async (path) => {
          const url = new URL(path, self.registration.scope);

          const request = new Request(url.href, {
            cache: "reload"
          });

          const response = await fetch(request);

          if (!response.ok) {
            throw new Error(
              `Gagal memuat ${path}. Status: ${response.status}`
            );
          }

          await cache.put(request, response);
        })
      );

      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.warn(
            `[Service Worker] Gagal menyimpan ${APP_SHELL[index]}`,
            result.reason
          );
        }
      });

      /*
       * Meminta service worker baru langsung masuk tahap aktif.
       */
      await self.skipWaiting();
    })()
  );
});

/* =========================================================
   ACTIVATE
   Menghapus cache versi lama.
   ========================================================= */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const activeCaches = [
        APP_CACHE,
        RUNTIME_CACHE,
        API_CACHE
      ];

      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames.map((cacheName) => {
          /*
           * Hanya menghapus cache milik aplikasi ASKEP.
           */
          if (
            cacheName.startsWith("askep-") &&
            !activeCaches.includes(cacheName)
          ) {
            console.log(
              `[Service Worker] Menghapus cache lama: ${cacheName}`
            );

            return caches.delete(cacheName);
          }

          return Promise.resolve();
        })
      );

      /*
       * Service worker langsung mengontrol halaman terbuka.
       */
      await self.clients.claim();
    })()
  );
});

/* =========================================================
   FETCH
   Mengatur strategi cache.
   ========================================================= */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  /*
   * Service worker hanya menangani request GET.
   */
  if (request.method !== "GET") {
    return;
  }

  /*
   * Range request biasanya digunakan untuk video atau audio.
   */
  if (request.headers.has("range")) {
    return;
  }

  const url = new URL(request.url);

  if (!["http:", "https:"].includes(url.protocol)) {
    return;
  }

  /*
   * Halaman HTML:
   * network-first agar aplikasi mencoba mengambil versi terbaru.
   */
  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  /*
   * Request API:
   * network-first, lalu cache ketika offline.
   */
  if (isAskepAPI(url)) {
    event.respondWith(handleAPIRequest(request));
    return;
  }

  /*
   * CSS, JavaScript, ikon, gambar, font, dan manifest:
   * tampilkan cache dahulu sambil memperbarui cache.
   */
  if (isStaticAsset(request, url)) {
    event.respondWith(
      handleStaticAsset(event, request)
    );
    return;
  }

  /*
   * Request GET lain menggunakan network-first.
   */
  event.respondWith(
    networkFirst(request, RUNTIME_CACHE)
  );
});

/* =========================================================
   HALAMAN HTML
   ========================================================= */

async function handleNavigationRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetchWithTimeout(request, 8000);

    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
      await trimCache(RUNTIME_CACHE, 60);
    }

    return response;
  } catch (error) {
    /*
     * Cari URL halaman yang sama dalam cache runtime.
     */
    const runtimePage = await cache.match(request);

    if (runtimePage) {
      return runtimePage;
    }

    /*
     * Cari halaman dalam cache aplikasi.
     */
    const appPage = await caches.match(request);

    if (appPage) {
      return appPage;
    }

    /*
     * Tampilkan halaman offline bawaan.
     */
    return createOfflineResponse();
  }
}

/* =========================================================
   REQUEST API
   ========================================================= */

async function handleAPIRequest(request) {
  const cache = await caches.open(API_CACHE);

  try {
    const response = await fetchWithTimeout(request, 12000);

    /*
     * Simpan hanya respons API yang berhasil.
     */
    if (response.ok) {
      await cache.put(request, response.clone());
      await trimCache(API_CACHE, 40);
    }

    /*
     * Ketika server mengalami error, coba gunakan data lama.
     */
    if (response.status >= 500) {
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }
    }

    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        data: [],
        message:
          "Tidak ada koneksi internet dan data belum pernah disimpan."
      }),
      {
        status: 503,
        statusText: "Offline",
        headers: {
          "Content-Type": "application/json; charset=UTF-8"
        }
      }
    );
  }
}

/* =========================================================
   ASET STATIS
   Stale While Revalidate
   ========================================================= */

async function handleStaticAsset(event, request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cachedResponse = await cache.match(request);

  const networkPromise = fetch(request)
    .then(async (response) => {
      if (isCacheableResponse(response)) {
        await cache.put(request, response.clone());
        await trimCache(RUNTIME_CACHE, 120);
      }

      return response;
    })
    .catch((error) => {
      console.warn(
        `[Service Worker] Aset gagal diperbarui: ${request.url}`,
        error
      );

      return null;
    });

  /*
   * Jika cache tersedia, tampilkan langsung.
   * Pembaruan jaringan tetap berjalan.
   */
  if (cachedResponse) {
    event.waitUntil(networkPromise);

    return cachedResponse;
  }

  /*
   * Jika belum ada dalam cache, tunggu hasil jaringan.
   */
  const networkResponse = await networkPromise;

  if (networkResponse) {
    return networkResponse;
  }

  return new Response("", {
    status: 504,
    statusText: "Aset Tidak Tersedia"
  });
}

/* =========================================================
   NETWORK FIRST
   ========================================================= */

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetchWithTimeout(request, 8000);

    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
      await trimCache(cacheName, 100);
    }

    return response;
  } catch (error) {
    const cachedResponse = await cache.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response(
      "Konten belum tersedia saat perangkat offline.",
      {
        status: 503,
        statusText: "Offline",
        headers: {
          "Content-Type": "text/plain; charset=UTF-8"
        }
      }
    );
  }
}

/* =========================================================
   HELPER
   ========================================================= */

function isAskepAPI(url) {
  return API_ORIGINS.includes(url.origin);
}

function isStaticAsset(request, url) {
  const staticDestinations = [
    "style",
    "script",
    "image",
    "font",
    "manifest"
  ];

  if (staticDestinations.includes(request.destination)) {
    return true;
  }

  return /\.(?:css|js|png|jpg|jpeg|webp|svg|gif|ico|woff|woff2|ttf|webmanifest)$/i.test(
    url.pathname
  );
}

function isCacheableResponse(response) {
  if (!response) {
    return false;
  }

  /*
   * Partial response tidak disimpan.
   */
  if (response.status === 206) {
    return false;
  }

  /*
   * Opaque response diperlukan untuk font atau CDN eksternal.
   */
  return response.ok || response.type === "opaque";
}

/*
 * Membatasi jumlah file agar cache tidak membesar terus.
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();

  while (keys.length > maxItems) {
    const oldestRequest = keys.shift();

    if (oldestRequest) {
      await cache.delete(oldestRequest);
    }
  }
}

/*
 * Membatalkan fetch apabila terlalu lama.
 */
async function fetchWithTimeout(request, timeout = 8000) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);

  try {
    return await fetch(request, {
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/* =========================================================
   FALLBACK OFFLINE
   Tidak membutuhkan file offline.html terpisah.
   ========================================================= */

function createOfflineResponse() {
  const html = `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">

      <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0,
        viewport-fit=cover"
      >

      <meta name="theme-color" content="#2563eb">

      <title>ASKEP Offline</title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          min-height: 100vh;
          margin: 0;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family:
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
          background: #eff6ff;
          color: #0f172a;
        }

        .offline-card {
          width: 100%;
          max-width: 420px;
          padding: 32px 24px;
          text-align: center;
          background: #ffffff;
          border: 1px solid #dbeafe;
          border-radius: 24px;
          box-shadow:
            0 18px 45px rgba(15, 23, 42, 0.1);
        }

        .offline-icon {
          width: 72px;
          height: 72px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 22px;
          background: #dbeafe;
          color: #2563eb;
          font-size: 32px;
          font-weight: 800;
        }

        h1 {
          margin: 0 0 12px;
          font-size: 24px;
        }

        p {
          margin: 0 0 24px;
          color: #64748b;
          line-height: 1.6;
        }

        button {
          width: 100%;
          padding: 14px 18px;
          border: 0;
          border-radius: 14px;
          background: #2563eb;
          color: #ffffff;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        button:active {
          transform: scale(0.98);
        }
      </style>
    </head>

    <body>
      <main class="offline-card">
        <div class="offline-icon">!</div>

        <h1>Kamu sedang offline</h1>

        <p>
          Halaman ini belum pernah dibuka atau disimpan.
          Periksa koneksi internet, lalu coba lagi.
        </p>

        <button
          type="button"
          onclick="location.reload()"
        >
          Coba Lagi
        </button>
      </main>
    </body>
    </html>
  `;

  return new Response(html, {
    status: 503,
    statusText: "Offline",
    headers: {
      "Content-Type": "text/html; charset=UTF-8"
    }
  });
}

/* =========================================================
   MESSAGE
   ========================================================= */

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
