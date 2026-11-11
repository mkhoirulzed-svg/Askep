const FILE_ROUTES = {
  "/api/sdki": "data/sdkislki/sdki.json",
  "/api/slki": "data/sdkislki/slki.json",
  "/api/siki": "data/sdkislki/siki.json",
  "/api/relations": "data/sdkislki/master-relations.json",
  "/api/kasus": "data/sdkislki/kasus.json",
};

const KIOSAPI_API_URL = "https://api.kiosapi.id/v1/chat/completions";
const DEFAULT_KIOSAPI_MODEL = "deepseek/deepseek-v4-flash";

function getKiosApiModel(env) {
  const configured = typeof env.KIOSAPI_MODEL === "string"
    ? env.KIOSAPI_MODEL.trim()
    : "";
  return configured.slice(0, 120) || DEFAULT_KIOSAPI_MODEL;
}
const DATABASE_CACHE_TTL_MS = 5 * 60 * 1000;

let databaseMemoryCache = null;
let databaseMemoryCacheTime = 0;

const SYSTEM_PROMPT = `
Anda adalah Asisten Keperawatan ASKEP berbahasa Indonesia.

TUGAS UTAMA:
Membantu perawat menganalisis data pasien, menentukan masalah aktif yang perlu
diprioritaskan, menemukan kandidat diagnosis keperawatan, dan menjelaskan data
yang masih perlu dikaji.

Anda boleh menggunakan pengetahuan keperawatan dan klinis umum untuk:
- memahami bahasa sehari-hari, singkatan, dan istilah awam pasien;
- menganalisis data subjektif dan objektif;
- menjelaskan hubungan antara penyakit, terapi, gejala, dan respons pasien;
- menjelaskan kemungkinan penyebab masalah;
- menyarankan data tambahan yang perlu dikaji;
- menjelaskan tanda bahaya dan kebutuhan evaluasi segera.

Jangan menampilkan proses berpikir internal. Berikan kesimpulan dan alasan klinis
secara ringkas, jelas, dan dapat diverifikasi.

PRIORITAS MASALAH:
1. Prioritaskan keluhan, gejala, atau perubahan kondisi yang sedang aktif.
2. Penyakit dasar, diagnosis medis, dan terapi adalah konteks klinis, bukan
   otomatis masalah utama.
3. Masalah kegawatdaruratan tetap didahulukan bila terdapat data pendukung.
4. Jangan memilih diagnosis hanya karena nama penyakit atau riwayat medis muncul.
5. Bila keluhan aktif adalah gangguan fungsi tertentu, prioritaskan kandidat
   diagnosis yang paling langsung menggambarkan gangguan fungsi tersebut.

Contoh prinsip:
- Pasien TB on OAT dengan kulit melepuh: fokus awal adalah perubahan kulit;
  masalah jalan napas hanya diprioritaskan bila ada data pernapasan aktif.
- Ibu setelah melahirkan dengan ASI tidak keluar: fokus awal adalah proses
  menyusui/laktasi, bukan masalah postpartum lain tanpa data pendukung.
- Pasien CKD dengan kedua kaki bengkak: pertimbangkan masalah keseimbangan cairan
  sebagai kandidat utama; gangguan perfusi perifer hanya dipilih bila data
  perfusi memang mendukung.

ATURAN KHUSUS STANDAR KEPERAWATAN:
Aturan ketat berikut hanya berlaku ketika menyebut standar resmi.
1. Setiap diagnosis SDKI yang disebut harus tersedia dalam konteks database.
2. Setiap luaran SLKI yang disebut harus tersedia dalam konteks database.
3. Setiap intervensi SIKI yang disebut harus tersedia dalam konteks database.
4. Kode dan judul harus ditulis persis seperti di dalam konteks database.
5. Jangan membuat, menebak, mengubah, menerjemahkan, memperbaiki, atau
   melengkapi kode dan judul standar sendiri.
6. Setiap standar resmi yang disebut harus disertai kodenya.
7. Hubungan SDKI-SLKI-SIKI yang disebut sebagai hubungan resmi harus mengikuti
   bagian RELASI TERVERIFIKASI dalam konteks.
8. Jangan memasangkan SLKI atau SIKI dengan SDKI berdasarkan dugaan bila relasi
   tersebut tidak tersedia dalam konteks.
9. Penjelasan klinis umum boleh diberikan, tetapi jangan menyamarkannya sebagai
   isi resmi SDKI, SLKI, atau SIKI.

KANDIDAT DIAGNOSIS:
- Konteks database berisi kandidat, bukan berarti seluruh kandidat sama relevan.
- Pilih kandidat yang paling sesuai dengan masalah aktif sebagai kandidat utama.
- Kandidat yang hanya berkaitan dengan penyakit dasar tetapi tidak dengan keluhan
  aktif jangan dijadikan diagnosis utama.
- Bila data belum lengkap, sebutkan sebagai "kandidat diagnosis SDKI yang perlu
  divalidasi", bukan diagnosis pasti.
- Bila kandidat terdekat tersedia, boleh menyebutkannya beserta keterbatasan dan
  data tambahan yang diperlukan.
- Bila tidak ada kandidat yang cukup relevan, katakan bahwa diagnosis SDKI yang
  sesuai belum ditemukan dalam konteks database. Tetap boleh menjelaskan arah
  masalah dan fokus pengkajian secara umum tanpa menciptakan standar baru.

KEAMANAN:
- Jangan memberikan diagnosis medis definitif.
- Jangan menyarankan penghentian atau perubahan dosis obat secara mandiri.
- Bila ada tanda bahaya, prioritaskan evaluasi segera sesuai kewenangan tenaga
  kesehatan.
- Jangan meminta identitas pribadi pasien.
- Hasil analisis adalah bantuan keputusan dan harus diverifikasi oleh perawat.

FORMAT JAWABAN UNTUK KASUS, BILA RELEVAN:
1. Ringkasan kondisi
2. Masalah utama saat ini
3. Kandidat diagnosis SDKI utama
4. Alasan pemilihan
5. Diagnosis pembanding yang benar-benar relevan
6. Data tambahan yang perlu dikaji
7. Luaran SLKI dan intervensi SIKI dari relasi terverifikasi
8. Catatan keamanan dan verifikasi

Tidak semua bagian harus ditampilkan. Jawab jelas, praktis, dan tidak bertele-tele.
`.trim();

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const isAiRoute = pathname.startsWith("/api/ai/") || pathname.startsWith("/api/payment/") || pathname.startsWith("/api/account/");
    const corsHeaders = isAiRoute
      ? getAiCorsHeaders(request, env)
      : getPublicCorsHeaders();

    if (request.method === "OPTIONS") {
      if (isAiRoute && !isAiOriginAllowed(request, env)) {
        return sendJson(
          { success: false, message: "Origin website tidak diizinkan." },
          403,
          corsHeaders
        );
      }

      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (pathname === "/") {
      if (request.method !== "GET") {
        return methodNotAllowed(corsHeaders, ["GET"]);
      }

      return sendJson(
        {
          success: true,
          name: "ASKEP API",
          message: "API aktif.",
          bindingDetected: Boolean(env.ASKEP_DATA),
          kiosapiConfigured: Boolean(env.KIOSAPI_API_KEY),
          aiEnabled: String(env.AI_ENABLED || "true") !== "false",
          turnstileConfigured: Boolean(env.TURNSTILE_SECRET_KEY),
          aiModel: getKiosApiModel(env),
          endpoints: [
            "/api/sdki",
            "/api/slki",
            "/api/siki",
            "/api/relations",
            "/api/kasus",
            "/api/test-r2",
            "/api/ai/status",
            "/api/ai/chat",
            "/api/account/status",
            "/api/payment/create",
            "/api/payment/notification",
          ],
        },
        200,
        corsHeaders
      );
    }


    if (pathname === "/api/payment/notification") {
      if (request.method !== "POST") return methodNotAllowed(corsHeaders, ["POST"]);
      return handleMidtransNotification(request, env, corsHeaders);
    }

    if (pathname === "/api/payment/create") {
      if (request.method !== "POST") return methodNotAllowed(corsHeaders, ["POST"]);
      if (!isAiOriginAllowed(request, env)) {
        return sendJson({ success: false, code: "ORIGIN_NOT_ALLOWED", message: "Origin website tidak diizinkan." }, 403, corsHeaders);
      }
      const auth = await authenticateFirebaseRequest(request, env);
      if (!auth.ok) return sendJson({ success: false, code: "UNAUTHORIZED", message: auth.message }, 401, corsHeaders);
      return handleCreatePayment(request, env, corsHeaders, auth.user);
    }

    if (pathname === "/api/account/status") {
      if (request.method !== "GET") return methodNotAllowed(corsHeaders, ["GET"]);
      if (!isAiOriginAllowed(request, env)) {
        return sendJson({ success: false, code: "ORIGIN_NOT_ALLOWED", message: "Origin website tidak diizinkan." }, 403, corsHeaders);
      }
      const auth = await authenticateFirebaseRequest(request, env);
      if (!auth.ok) return sendJson({ success: false, code: "UNAUTHORIZED", message: auth.message }, 401, corsHeaders);
      return handleAccountStatus(env, corsHeaders, auth.user);
    }

    if (pathname === "/api/ai/status") {
      if (request.method !== "GET") {
        return methodNotAllowed(corsHeaders, ["GET"]);
      }

      if (!isAiOriginAllowed(request, env)) {
        return sendJson(
          { success: false, message: "Origin website tidak diizinkan." },
          403,
          corsHeaders
        );
      }

      return sendJson(
        {
          success: true,
          service: "Kios API",
          configured: Boolean(env.KIOSAPI_API_KEY),
          enabled: String(env.AI_ENABLED || "true") !== "false",
          model: getKiosApiModel(env),
          thinkingMode: "model-default",
          databaseRetrieval: true,
          turnstileConfigured: Boolean(env.TURNSTILE_SECRET_KEY),
        },
        200,
        corsHeaders
      );
    }

    if (pathname === "/api/ai/chat") {
      if (request.method !== "POST") {
        return methodNotAllowed(corsHeaders, ["POST"]);
      }

      if (!isAiOriginAllowed(request, env)) {
        return sendJson(
          {
            success: false,
            code: "ORIGIN_NOT_ALLOWED",
            message: "Website ini tidak diizinkan menggunakan layanan AI.",
          },
          403,
          corsHeaders
        );
      }

      const auth = await authenticateFirebaseRequest(request, env);
      if (!auth.ok) {
        return sendJson({ success: false, code: "UNAUTHORIZED", message: auth.message }, 401, corsHeaders);
      }
      const quota = await consumeAiQuota(env, auth.user.uid);
      if (!quota.ok) {
        return sendJson({
          success: false,
          code: quota.code,
          message: quota.message,
          premium: quota.premium,
          dailyLimit: quota.limit,
          usedToday: quota.used,
          resetDateUtc: quota.date,
        }, quota.status, corsHeaders);
      }
      const aiResponse = await handleAiChat(request, env, corsHeaders);
      return aiResponse;
    }

    if (pathname === "/api/test-r2") {
      if (request.method !== "GET") {
        return methodNotAllowed(corsHeaders, ["GET"]);
      }

      if (!env.ASKEP_DATA) {
        return sendJson(
          { success: false, message: "Binding ASKEP_DATA tidak ditemukan." },
          500,
          corsHeaders
        );
      }

      try {
        const result = await env.ASKEP_DATA.list({ limit: 100 });

        return sendJson(
          {
            success: true,
            message: "R2 berhasil terhubung.",
            objects: result.objects.map((item) => ({
              key: item.key,
              size: item.size,
              uploaded: item.uploaded,
            })),
          },
          200,
          corsHeaders
        );
      } catch (error) {
        console.error("R2 list error:", error);
        return sendJson(
          { success: false, message: "Gagal membaca bucket R2." },
          500,
          corsHeaders
        );
      }
    }

    const objectKey = FILE_ROUTES[pathname];

    if (objectKey) {
      if (request.method !== "GET") {
        return methodNotAllowed(corsHeaders, ["GET"]);
      }

      return handleR2File(env, objectKey, corsHeaders);
    }

    return sendJson(
      {
        success: false,
        message: "Endpoint tidak ditemukan.",
        pathname,
      },
      404,
      corsHeaders
    );
  },
};



// ---- Firebase authentication, D1 entitlement, AI quota, and Midtrans ----
let firebaseJwkCache = null;
let firebaseJwkCacheUntil = 0;

function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJwtPart(value) {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(value)));
}

async function getFirebaseJwks() {
  if (firebaseJwkCache && Date.now() < firebaseJwkCacheUntil) return firebaseJwkCache;
  const response = await fetch("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com");
  if (!response.ok) throw new Error("Firebase public keys unavailable");
  const data = await response.json();
  firebaseJwkCache = data.keys || [];
  firebaseJwkCacheUntil = Date.now() + 60 * 60 * 1000;
  return firebaseJwkCache;
}

async function authenticateFirebaseRequest(request, env) {
  const header = request.headers.get("Authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false, message: "Silakan login kembali untuk melanjutkan." };

  try {
    const parts = match[1].split(".");
    if (parts.length !== 3) throw new Error("Invalid token");
    const headerData = decodeJwtPart(parts[0]);
    const claims = decodeJwtPart(parts[1]);
    const projectId = String(env.FIREBASE_PROJECT_ID || "sdki-a3960");
    const now = Math.floor(Date.now() / 1000);

    if (headerData.alg !== "RS256" || !headerData.kid) throw new Error("Invalid algorithm");
    if (claims.aud !== projectId || claims.iss !== "https://securetoken.google.com/" + projectId) throw new Error("Invalid issuer");
    if (!claims.sub || claims.sub.length > 128 || claims.exp <= now || claims.iat > now + 300) throw new Error("Expired token");

    const jwks = await getFirebaseJwks();
    const jwk = jwks.find((key) => key.kid === headerData.kid);
    if (!jwk) throw new Error("Unknown signing key");
    const publicKey = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const signingInput = new TextEncoder().encode(parts[0] + "." + parts[1]);
    const signature = decodeBase64Url(parts[2]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signingInput);
    if (!valid) throw new Error("Invalid signature");

    return { ok: true, user: { uid: claims.sub, email: typeof claims.email === "string" ? claims.email : "" } };
  } catch (error) {
    console.warn("Firebase token verification failed:", error?.message || error);
    return { ok: false, message: "Sesi login tidak valid atau sudah kedaluwarsa. Silakan login kembali." };
  }
}

function requireD1(env) {
  return Boolean(env.ASKEP_DB && typeof env.ASKEP_DB.prepare === "function");
}

function utcDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function getPremiumState(env, uid) {
  const row = await env.ASKEP_DB.prepare(
    "SELECT uid, status, activated_at, payment_order_id FROM premium_users WHERE uid = ? LIMIT 1"
  ).bind(uid).first();
  return Boolean(row && row.status === "active");
}

async function handleAccountStatus(env, corsHeaders, user) {
  if (!requireD1(env)) return sendJson({ success: false, code: "D1_NOT_CONFIGURED", message: "Binding D1 ASKEP_DB belum tersedia." }, 500, corsHeaders);
  try {
    const premium = await getPremiumState(env, user.uid);
    const date = utcDateString();
    const usage = await env.ASKEP_DB.prepare(
      "SELECT question_count FROM ai_daily_usage WHERE uid = ? AND usage_date = ?"
    ).bind(user.uid, date).first();
    const limit = premium
      ? Math.max(1, Number(env.PREMIUM_AI_DAILY_LIMIT || 50))
      : Math.max(1, Number(env.FREE_AI_DAILY_LIMIT || 5));
    const used = Number(usage?.question_count || 0);
    return sendJson({
      success: true,
      uid: user.uid,
      premium,
      premiumPlan: premium ? "lifetime" : null,
      aiQuota: { dateUtc: date, dailyLimit: limit, used, remaining: Math.max(0, limit - used) },
    }, 200, corsHeaders);
  } catch (error) {
    console.error("Account status D1 error:", error);
    return sendJson({ success: false, code: "D1_QUERY_ERROR", message: "Status akun belum dapat dibaca dari database." }, 500, corsHeaders);
  }
}

async function consumeAiQuota(env, uid) {
  if (!requireD1(env)) {
    return { ok: false, status: 503, code: "D1_NOT_CONFIGURED", message: "Kuota AI belum dapat diverifikasi. Silakan coba lagi nanti." };
  }
  try {
    const premium = await getPremiumState(env, uid);
    const date = utcDateString();
    const limit = premium
      ? Math.max(1, Number(env.PREMIUM_AI_DAILY_LIMIT || 50))
      : Math.max(1, Number(env.FREE_AI_DAILY_LIMIT || 5));
    const result = await env.ASKEP_DB.prepare(
      "INSERT INTO ai_daily_usage (uid, usage_date, question_count, updated_at) VALUES (?, ?, 1, datetime('now')) " +
      "ON CONFLICT(uid, usage_date) DO UPDATE SET question_count = question_count + 1, updated_at = datetime('now') " +
      "WHERE question_count < ? RETURNING question_count"
    ).bind(uid, date, limit).first();

    if (!result) {
      return {
        ok: false, status: 429, code: "AI_DAILY_QUOTA_EXCEEDED",
        message: premium ? "Kuota AI Premium hari ini sudah habis." : "Kuota gratis 5 pertanyaan hari ini sudah habis. Upgrade ke Premium untuk kuota lebih besar.",
        premium, limit, used: limit, date,
      };
    }
    return { ok: true, premium, limit, used: Number(result.question_count), date };
  } catch (error) {
    console.error("AI quota D1 error:", error);
    return { ok: false, status: 503, code: "AI_QUOTA_UNAVAILABLE", message: "Kuota AI tidak dapat diverifikasi. Silakan coba lagi." };
  }
}

async function handleCreatePayment(request, env, corsHeaders, user) {
  if (!requireD1(env)) return sendJson({ success: false, code: "D1_NOT_CONFIGURED", message: "Binding D1 ASKEP_DB belum tersedia." }, 500, corsHeaders);
  if (!env.MIDTRANS_SERVER_KEY) return sendJson({ success: false, code: "PAYMENT_NOT_CONFIGURED", message: "Midtrans Server Key belum dikonfigurasi di Worker." }, 503, corsHeaders);

  try {
    if (await getPremiumState(env, user.uid)) {
      return sendJson({ success: true, alreadyPremium: true, message: "Akun ini sudah Premium." }, 200, corsHeaders);
    }

    const orderId = "ASKEP-" + user.uid.slice(0, 8) + "-" + Date.now() + "-" + crypto.randomUUID().slice(0, 8);
    const amount = Math.max(1, Number(env.PREMIUM_PRICE_IDR || 9000));
    if (amount !== 9000) throw new Error("Configured Premium price must remain IDR 9000");

    await env.ASKEP_DB.prepare(
      "INSERT INTO payment_transactions (order_id, uid, amount, status) VALUES (?, ?, ?, 'pending')"
    ).bind(orderId, user.uid, amount).run();

    const credentials = btoa(env.MIDTRANS_SERVER_KEY + ":");
    const endpoint = String(env.MIDTRANS_IS_PRODUCTION || "true") === "true"
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: "Basic " + credentials, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: "ASKEP-PREMIUM-LIFETIME", price: amount, quantity: 1, name: "ASKEP Premium Lifetime" }],
        customer_details: user.email ? { email: user.email } : undefined,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.token) {
      await env.ASKEP_DB.prepare("UPDATE payment_transactions SET status = 'failure', updated_at = datetime('now') WHERE order_id = ?").bind(orderId).run();
      console.error("Midtrans Snap create failed:", response.status, payload);
      return sendJson({ success: false, code: "MIDTRANS_CREATE_FAILED", message: "Midtrans belum dapat membuat transaksi. Silakan coba kembali." }, 502, corsHeaders);
    }

    return sendJson({ success: true, orderId, token: payload.token, redirectUrl: payload.redirect_url, amount, currency: "IDR" }, 200, corsHeaders);
  } catch (error) {
    console.error("Create payment error:", error);
    return sendJson({ success: false, code: "PAYMENT_CREATE_ERROR", message: "Transaksi belum dapat dibuat." }, 500, corsHeaders);
  }
}

async function sha512Hex(value) {
  const digest = await crypto.subtle.digest("SHA-512", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeStringEqual(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function handleMidtransNotification(request, env, corsHeaders) {
  if (!requireD1(env)) return sendJson({ success: false, code: "D1_NOT_CONFIGURED" }, 500, corsHeaders);
  if (!env.MIDTRANS_SERVER_KEY) return sendJson({ success: false, code: "PAYMENT_NOT_CONFIGURED" }, 503, corsHeaders);

  let notification;
  try { notification = await request.json(); }
  catch { return sendJson({ success: false, code: "INVALID_JSON" }, 400, corsHeaders); }

  try {
    const orderId = String(notification.order_id || "");
    const statusCode = String(notification.status_code || "");
    const grossAmount = String(notification.gross_amount || "");
    const signature = String(notification.signature_key || "");
    const expected = await sha512Hex(orderId + statusCode + grossAmount + env.MIDTRANS_SERVER_KEY);
    if (!constantTimeStringEqual(signature.toLowerCase(), expected)) {
      return sendJson({ success: false, code: "INVALID_SIGNATURE" }, 401, corsHeaders);
    }

    const transaction = await env.ASKEP_DB.prepare(
      "SELECT order_id, uid, amount, status FROM payment_transactions WHERE order_id = ? LIMIT 1"
    ).bind(orderId).first();
    if (!transaction) return sendJson({ success: false, code: "ORDER_NOT_FOUND" }, 404, corsHeaders);

    const numericAmount = Number(grossAmount);
    if (!Number.isFinite(numericAmount) || numericAmount !== Number(transaction.amount) || numericAmount !== 9000) {
      return sendJson({ success: false, code: "AMOUNT_MISMATCH" }, 400, corsHeaders);
    }

    const txStatus = String(notification.transaction_status || "").toLowerCase();
    const fraudStatus = String(notification.fraud_status || "").toLowerCase();
    const grantPremium = txStatus === "settlement" || (txStatus === "capture" && fraudStatus === "accept");
    const values = [
      txStatus || "pending",
      String(notification.transaction_id || ""),
      String(notification.payment_type || ""),
      fraudStatus,
      JSON.stringify(notification).slice(0, 12000),
      orderId,
    ];

    await env.ASKEP_DB.prepare(
      "UPDATE payment_transactions SET status = ?, transaction_id = ?, payment_type = ?, fraud_status = ?, raw_notification = ?, updated_at = datetime('now') WHERE order_id = ?"
    ).bind(...values).run();

    if (grantPremium) {
      await env.ASKEP_DB.prepare(
        "INSERT INTO premium_users (uid, status, activated_at, payment_order_id, created_at, updated_at) " +
        "VALUES (?, 'active', datetime('now'), ?, datetime('now'), datetime('now')) " +
        "ON CONFLICT(uid) DO UPDATE SET status = 'active', activated_at = COALESCE(premium_users.activated_at, excluded.activated_at), payment_order_id = excluded.payment_order_id, updated_at = datetime('now')"
      ).bind(transaction.uid, orderId).run();
    } else if (txStatus === "refund" || txStatus === "chargeback") {
      await env.ASKEP_DB.prepare(
        "DELETE FROM premium_users WHERE uid = ? AND payment_order_id = ?"
      ).bind(transaction.uid, orderId).run();
    }

    return sendJson({ success: true, received: true }, 200, corsHeaders);
  } catch (error) {
    console.error("Midtrans notification error:", error);
    return sendJson({ success: false, code: "NOTIFICATION_PROCESSING_ERROR" }, 500, corsHeaders);
  }
}

async function handleAiChat(request, env, corsHeaders) {
  if (String(env.AI_ENABLED || "true") === "false") {
    return sendJson(
      {
        success: false,
        code: "AI_DISABLED",
        message: "Fitur AI sedang dinonaktifkan oleh administrator.",
      },
      503,
      corsHeaders
    );
  }

  if (!env.KIOSAPI_API_KEY) {
    return sendJson(
      {
        success: false,
        code: "AI_NOT_CONFIGURED",
        message: "Secret KIOSAPI_API_KEY belum tersedia di Cloudflare.",
      },
      500,
      corsHeaders
    );
  }

  if (!env.ASKEP_DATA) {
    return sendJson(
      {
        success: false,
        code: "DATABASE_NOT_CONFIGURED",
        message: "Binding R2 ASKEP_DATA belum tersedia.",
      },
      500,
      corsHeaders
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return sendJson(
      {
        success: false,
        code: "INVALID_JSON",
        message: "Body permintaan harus berupa JSON yang valid.",
      },
      400,
      corsHeaders
    );
  }

  const message = cleanString(body?.message, 4000);
  const selectedSdkiCode = cleanString(body?.selectedSdkiCode, 30);
  const history = cleanHistory(body?.history);

  if (!message) {
    return sendJson(
      {
        success: false,
        code: "EMPTY_MESSAGE",
        message: "Pertanyaan tidak boleh kosong.",
      },
      400,
      corsHeaders
    );
  }

  const turnstileValidation = await validateTurnstileIfConfigured(
    request,
    env,
    body?.turnstileToken
  );

  if (!turnstileValidation.success) {
    return sendJson(
      {
        success: false,
        code: "TURNSTILE_FAILED",
        message: "Verifikasi keamanan gagal. Silakan muat ulang dan coba kembali.",
      },
      403,
      corsHeaders
    );
  }

  let databases;

  try {
    databases = await loadDatabases(env);
  } catch (error) {
    console.error("Database load error:", error);
    return sendJson(
      {
        success: false,
        code: "DATABASE_LOAD_ERROR",
        message: "Database ASKEP tidak dapat dibaca.",
      },
      500,
      corsHeaders
    );
  }

  let retrievalResult;

  try {
    retrievalResult = await retrieveRelevantData(
      databases,
      message,
      selectedSdkiCode,
      env
    );
  } catch (error) {
    console.error("Retrieval error:", error);
    return sendJson(
      {
        success: false,
        code: "RETRIEVAL_ERROR",
        message: "Pencarian konteks database gagal diproses.",
      },
      500,
      corsHeaders
    );
  }

  const matches = retrievalResult.matches;
  const databaseContext = buildDatabaseContext(matches, retrievalResult);
  const sources = buildSourceList(matches);

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "system",
      content: `
Berikut hasil pencarian internal database ASKEP.

CARA MEMAKAI KONTEKS:
- Pesan asli pengguna tetap menjadi sumber utama untuk menentukan fokus masalah.
- RENCANA PENCARIAN hanya membantu memahami istilah awam dan bukan diagnosis final.
- Daftar SDKI berisi kandidat yang sudah dirangking oleh Worker.
- Kandidat pertama biasanya paling relevan, tetapi tetap nilai berdasarkan data
  pasien dan jangan memaksakannya jika data tidak mendukung.
- Gunakan hanya kode dan judul standar yang benar-benar tersedia di konteks.
- Gunakan SLKI dan SIKI sebagai pasangan resmi hanya bila tercantum di bagian
  RELASI TERVERIFIKASI.
- Bila konteks belum cukup, berikan analisis keperawatan umum dan data tambahan
  yang perlu dikaji tanpa membuat standar baru.

=== KONTEKS DATABASE ASKEP ===
${databaseContext}
=== AKHIR KONTEKS DATABASE ASKEP ===
      `.trim(),
    },
    ...history,
    { role: "user", content: message },
  ];

  let result;
  let continuationUsage = emptyUsage();
  let continuationUsed = false;
  let answerFinishReason = null;
  const answerTokenBudget = getAnswerTokenBudget(message, matches);

  try {
    result = await callKiosApi(env, {
      messages,
      maxTokens: answerTokenBudget,
    });
  } catch (error) {
    console.error("Kios API final answer error:", error);

    if (error?.providerStatus) {
      return handleKiosApiError(
        error.providerStatus,
        error.providerResult || {},
        corsHeaders
      );
    }

    return sendJson(
      {
        success: false,
        code: "AI_CONNECTION_ERROR",
        message: "Tidak dapat terhubung ke layanan AI. Silakan coba kembali.",
      },
      502,
      corsHeaders
    );
  }

  let answer = result?.choices?.[0]?.message?.content?.trim() || "";
  answerFinishReason = getFinishReason(result);

  // Lanjutkan hanya jika provider secara eksplisit menyatakan output terpotong
  // karena batas token. Ini menghindari pemanggilan AI tambahan pada jawaban normal.
  if (answer && isLengthFinishReason(answerFinishReason)) {
    try {
      const continuation = await callKiosApi(env, {
        messages: [
          { role: "system", content: "Anda melanjutkan jawaban ASKEP yang terpotong. Jangan mengulang bagian sebelumnya. Pertahankan bahasa, format, dan kehati-hatian klinis. Selesaikan kata atau kalimat terakhir yang terputus, lalu lanjutkan sampai jawaban tuntas. Jika kata terakhir sebelumnya sudah lengkap dan Anda memulai kata baru, awali dengan spasi atau baris baru. Jika kata terakhir terpotong, keluarkan hanya sisa kata tersebut tanpa mengulang huruf yang sudah ada." },
          { role: "assistant", content: answer },
          { role: "user", content: "Lanjutkan tepat dari bagian terakhir jawaban sebelumnya. Jangan mengulang isi yang sudah ada dan jangan membuat kesimpulan baru sebelum seluruh bagian yang diperlukan selesai." },
        ],
        maxTokens: 1600,
        temperature: 0.2,
      });
      const continuationText = continuation?.choices?.[0]?.message?.content || "";
      if (continuationText.trim()) {
        answer = appendContinuation(answer, continuationText);
        continuationUsage = extractUsage(continuation);
        continuationUsed = true;
      }
      answerFinishReason = getFinishReason(continuation);
    } catch (error) {
      console.error("Kios API answer continuation error:", error);
    }
  }

  const answerComplete = !isLengthFinishReason(answerFinishReason);

  if (!answer) {
    return sendJson(
      {
        success: false,
        code: "EMPTY_AI_RESPONSE",
        message: "AI tidak menghasilkan jawaban. Silakan ulangi pertanyaan.",
      },
      502,
      corsHeaders
    );
  }

  const validation = validateAnswerCodes(answer, matches);
  let repairUsage = emptyUsage();

  if (!validation.valid) {
    console.warn("AI answer contains codes outside context:", validation.invalidCodes);

    try {
      const repaired = await repairAnswerStandards(
        env,
        answer,
        message,
        databaseContext,
        validation.invalidCodes
      );

      const repairedAnswer =
        repaired?.choices?.[0]?.message?.content?.trim() || "";

      if (repairedAnswer) {
        answer = repairedAnswer;
        repairUsage = extractUsage(repaired);
      }
    } catch (error) {
      console.error("Answer repair error:", error);
    }
  }

  const plannerUsage = retrievalResult.plannerUsage || emptyUsage();
  const finalUsage = extractUsage(result);
  const totalUsage = addUsages(
    plannerUsage,
    finalUsage,
    continuationUsage,
    repairUsage
  );

  return sendJson(
    {
      success: true,
      answer,
      answerComplete,
      sources,
      retrieval: {
        selectedSdkiCode: selectedSdkiCode || null,
        usedAiQueryExpansion: retrievalResult.usedAiQueryExpansion,
        localExpansionRules: retrievalResult.localExpansionRules,
        activeProblem: retrievalResult.queryPlan.activeProblem || null,
        clinicalConcepts: retrievalResult.queryPlan.clinicalConcepts,
        searchTerms: retrievalResult.queryPlan.searchTerms,
        sdkiMatches: matches.sdki.length,
        slkiMatches: matches.slki.length,
        sikiMatches: matches.siki.length,
        relationMatches: matches.relations.length,
        topSdkiCandidates: matches.sdkiEntries.map((entry) => ({
          code: getItemCode(entry.item) || null,
          title: getItemTitle(entry.item) || null,
          score: entry.score,
        })),
        answerRepaired: !validation.valid,
        answerFinishReason,
        answerTokenBudget,
        continuationUsed,
      },
      model: result?.model || getKiosApiModel(env),
      usage: {
        inputTokens: totalUsage.inputTokens,
        outputTokens: totalUsage.outputTokens,
        totalTokens: totalUsage.totalTokens,
        costIdr: Number(totalUsage.costIdr.toFixed(4)),
        plannerTokens: plannerUsage.totalTokens,
        answerTokens: finalUsage.totalTokens,
        continuationTokens: continuationUsage.totalTokens,
        repairTokens: repairUsage.totalTokens,
      },
    },
    200,
    corsHeaders
  );
}

async function loadDatabases(env) {
  const now = Date.now();

  if (
    databaseMemoryCache &&
    now - databaseMemoryCacheTime < DATABASE_CACHE_TTL_MS
  ) {
    return databaseMemoryCache;
  }

  const [sdkiRaw, slkiRaw, sikiRaw, relationsRaw, kasusRaw] = await Promise.all([
    readJsonFromR2(env, FILE_ROUTES["/api/sdki"]),
    readJsonFromR2(env, FILE_ROUTES["/api/slki"]),
    readJsonFromR2(env, FILE_ROUTES["/api/siki"]),
    readJsonFromR2(env, FILE_ROUTES["/api/relations"]),
    readOptionalJsonFromR2(env, FILE_ROUTES["/api/kasus"]),
  ]);

  databaseMemoryCache = {
    sdki: unwrapArray(sdkiRaw),
    slki: unwrapArray(slkiRaw),
    siki: unwrapArray(sikiRaw),
    relations: unwrapArray(relationsRaw),
    kasus: unwrapArray(kasusRaw),
  };

  databaseMemoryCacheTime = now;
  return databaseMemoryCache;
}

async function readOptionalJsonFromR2(env, objectKey) {
  if (!objectKey) return [];

  try {
    return await readJsonFromR2(env, objectKey);
  } catch (error) {
    console.warn(`File opsional R2 tidak dapat dibaca: ${objectKey}`, error);
    return [];
  }
}

async function readJsonFromR2(env, objectKey) {
  const object = await env.ASKEP_DATA.get(objectKey);

  if (!object) {
    throw new Error(`File R2 tidak ditemukan: ${objectKey}`);
  }

  const text = await object.text();
  return JSON.parse(text);
}

function unwrapArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];

  for (const key of ["data", "items", "results", "diagnosa", "diagnosis"]) {
    if (Array.isArray(value[key])) return value[key];
  }

  return [];
}

const RETRIEVAL_CONFIG = {
  initialSdkiCandidates: 12,
  finalSdkiCandidates: 5,
  fullSdkiContext: 3,
  slkiLimit: 8,
  sikiLimit: 12,
  minimumCandidateScore: 50,
  strongTopScore: 240,
  strongScoreMargin: 80,
  maximumDatabaseContextChars: 28000,
};

const CLINICAL_EXPANSION_RULES = [
  {
    id: "skin-damage",
    any: [
      "kulit melepuh", "melepuh", "kulit terkelupas", "kulit mengelupas",
      "lecet", "luka kulit", "kulit rusak", "ruam melepuh"
    ],
    terms: [
      "gangguan integritas kulit jaringan", "kerusakan lapisan kulit",
      "kerusakan jaringan", "integritas kulit"
    ],
  },
  {
    id: "breastfeeding",
    any: [
      "asi tidak keluar", "asi belum keluar", "susu tidak keluar",
      "tidak bisa menyusui", "bayi sulit menyusu", "bayi tidak mau menyusu",
      "laktasi terganggu", "asi sedikit"
    ],
    terms: [
      "menyusui tidak efektif", "proses menyusui", "laktasi",
      "pengeluaran asi", "produksi asi", "perlekatan bayi"
    ],
  },
  {
    id: "fluid-overload-renal",
    allGroups: [
      ["bengkak", "sembab", "edema", "kaki bengkak", "muka bengkak"],
      ["ckd", "gagal ginjal", "penyakit ginjal", "hemodialisa", "hemodialisis"]
    ],
    terms: [
      "hipervolemia", "kelebihan volume cairan", "retensi cairan",
      "edema", "penurunan haluaran urin", "peningkatan berat badan"
    ],
  },
  {
    id: "fluid-overload-general",
    any: [
      "seluruh tubuh bengkak", "edema generalisata", "berat badan cepat naik",
      "cairan berlebih", "kelebihan cairan", "retensi cairan"
    ],
    terms: ["hipervolemia", "kelebihan volume cairan", "retensi cairan"],
  },
  {
    id: "airway-secretions",
    any: [
      "dahak susah keluar", "dahak tidak keluar", "batuk berdahak",
      "sekret banyak", "lendir susah keluar", "batuk tidak kuat"
    ],
    terms: [
      "bersihan jalan napas tidak efektif", "pengeluaran sekret",
      "batuk tidak efektif", "sekret tertahan"
    ],
  },
  {
    id: "breathing-pattern",
    any: [
      "napas cepat", "napas dangkal", "pola napas tidak teratur",
      "menggunakan otot bantu napas"
    ],
    terms: ["pola napas tidak efektif", "ventilasi", "frekuensi napas"],
  },
  {
    id: "activity-intolerance",
    any: [
      "cepat lelah saat aktivitas", "tidak kuat berjalan", "mudah lelah",
      "sesak saat aktivitas", "aktivitas sedikit sudah lelah"
    ],
    terms: ["intoleransi aktivitas", "toleransi aktivitas", "kelelahan saat aktivitas"],
  },
  {
    id: "acute-pain",
    any: ["nyeri tiba tiba", "nyeri akut", "sakit sekali", "nyeri setelah operasi"],
    terms: ["nyeri akut", "pengalaman sensorik emosional", "agen pencedera"],
  },
  {
    id: "nutrition",
    any: [
      "tidak mau makan", "nafsu makan turun", "makan sedikit",
      "berat badan turun", "asupan kurang"
    ],
    terms: ["defisit nutrisi", "asupan nutrisi", "kebutuhan metabolisme"],
  },
  {
    id: "urinary-elimination",
    any: [
      "tidak bisa kencing", "bak sedikit", "urin sedikit", "susah kencing",
      "anyang anyangan", "sering kencing"
    ],
    terms: ["eliminasi urin", "retensi urin", "gangguan eliminasi urin"],
  },
];

const MEDICAL_CONTEXT_TERMS = new Set([
  "tb", "oat", "ckd", "gagal ginjal", "diabetes", "dm", "hipertensi",
  "stroke", "kanker", "pneumonia", "asma", "copd", "ppok", "post operasi",
  "pasca operasi", "postpartum", "setelah melahirkan", "hamil", "hemodialisis",
  "hemodialisa"
]);

async function retrieveRelevantData(
  databases,
  message,
  selectedSdkiCode,
  env
) {
  if (selectedSdkiCode) {
    const exact = findExactItem(databases.sdki, selectedSdkiCode);

    if (exact) {
      return buildMatchesFromSdkiEntries(
        databases,
        [{ item: exact, score: 1000, matchedPriorityTerms: 1 }],
        {
          activeProblem: "Diagnosis SDKI dipilih secara eksplisit oleh pengguna.",
          clinicalConcepts: [],
          searchTerms: [selectedSdkiCode],
          medicalContext: [],
        },
        false,
        []
      );
    }
  }

  const localExpansion = expandClinicalQueryLocally(message);
  const preliminaryPlan = {
    activeProblem: "",
    clinicalConcepts: localExpansion.terms,
    searchTerms: localExpansion.terms,
    medicalContext: detectMedicalContext(message),
  };

  const preliminaryQueryInfo = buildQueryInfo(message, preliminaryPlan);
  let sdkiEntries = searchScoredItems(
    databases.sdki,
    preliminaryQueryInfo,
    RETRIEVAL_CONFIG.initialSdkiCandidates,
    RETRIEVAL_CONFIG.minimumCandidateScore
  );

  let queryPlan = preliminaryPlan;
  let usedAiQueryExpansion = false;
  let plannerUsage = emptyUsage();

  if (shouldUseAiQueryExpansion(sdkiEntries, localExpansion.rules)) {
    try {
      const aiExpansion = await expandClinicalQueryWithAi(message, env);

      if (aiExpansion.plan) {
        queryPlan = mergeQueryPlans(preliminaryPlan, aiExpansion.plan);
        usedAiQueryExpansion = true;
        plannerUsage = aiExpansion.usage;

        const expandedQueryInfo = buildQueryInfo(message, queryPlan);
        sdkiEntries = searchScoredItems(
          databases.sdki,
          expandedQueryInfo,
          RETRIEVAL_CONFIG.initialSdkiCandidates,
          RETRIEVAL_CONFIG.minimumCandidateScore
        );
      }
    } catch (error) {
      console.warn("AI query expansion skipped:", error);
    }
  }

  const caseEntries = searchCaseExamples(
    databases.kasus,
    buildQueryInfo(message, queryPlan),
    5
  );

  const caseSdkiItems = resolveSdkiFromCaseEntries(
    databases.sdki,
    caseEntries
  );

  if (caseSdkiItems.length) {
    const existing = new Map(
      sdkiEntries.map((entry) => [
        normalizeText(getItemCode(entry.item) || getItemTitle(entry.item)),
        entry,
      ])
    );

    for (const item of caseSdkiItems) {
      const key = normalizeText(getItemCode(item) || getItemTitle(item));
      const current = existing.get(key);

      if (current) {
        current.score += 130;
        current.fromCaseDatabase = true;
      } else {
        sdkiEntries.push({
          item,
          score: 130,
          matchedPriorityTerms: 1,
          fromCaseDatabase: true,
        });
      }
    }

    sdkiEntries.sort((a, b) => b.score - a.score);
  }

  sdkiEntries = filterRankedSdkiEntries(
    deduplicateScoredEntries(sdkiEntries),
    RETRIEVAL_CONFIG.finalSdkiCandidates
  );

  return buildMatchesFromSdkiEntries(
    databases,
    sdkiEntries,
    queryPlan,
    usedAiQueryExpansion,
    localExpansion.rules,
    plannerUsage
  );
}

function buildMatchesFromSdkiEntries(
  databases,
  sdkiEntries,
  queryPlan,
  usedAiQueryExpansion,
  localExpansionRules,
  plannerUsage = emptyUsage()
) {
  const sdkiItems = sdkiEntries.map((entry) => entry.item);
  const relationMatches = findRelationsForSdki(
    databases.relations,
    sdkiItems
  ).slice(0, RETRIEVAL_CONFIG.finalSdkiCandidates);

  const relatedSlki = findItemsFromRelationReferences(
    databases.slki,
    relationMatches,
    ["slki"]
  );

  const relatedSiki = findItemsFromRelationReferences(
    databases.siki,
    relationMatches,
    ["sikiUtama", "sikiPendukung", "sikiBelumTerklasifikasi", "siki"]
  );

  const queryInfo = buildQueryInfo(
    [queryPlan.activeProblem, ...queryPlan.searchTerms].filter(Boolean).join(" "),
    queryPlan
  );

  const slkiMatches = relatedSlki.length
    ? deduplicateItems(relatedSlki).slice(0, RETRIEVAL_CONFIG.slkiLimit)
    : searchScoredItems(
        databases.slki,
        queryInfo,
        4,
        40
      ).map((entry) => entry.item);

  const sikiMatches = relatedSiki.length
    ? deduplicateItems(relatedSiki).slice(0, RETRIEVAL_CONFIG.sikiLimit)
    : searchScoredItems(
        databases.siki,
        queryInfo,
        6,
        40
      ).map((entry) => entry.item);

  return {
    matches: {
      sdki: sdkiItems,
      sdkiEntries,
      slki: slkiMatches,
      siki: sikiMatches,
      relations: relationMatches,
    },
    queryPlan,
    usedAiQueryExpansion,
    localExpansionRules,
    plannerUsage,
  };
}

function expandClinicalQueryLocally(message) {
  const normalizedMessage = normalizeText(message);
  const terms = [];
  const matchedRules = [];

  for (const rule of CLINICAL_EXPANSION_RULES) {
    const anyMatched = Array.isArray(rule.any)
      ? rule.any.some((term) => normalizedMessage.includes(normalizeText(term)))
      : false;

    const allGroupsMatched = Array.isArray(rule.allGroups)
      ? rule.allGroups.every((group) =>
          group.some((term) => normalizedMessage.includes(normalizeText(term)))
        )
      : false;

    if (anyMatched || allGroupsMatched) {
      terms.push(...rule.terms);
      matchedRules.push(rule.id);
    }
  }

  return {
    terms: uniqueStrings(terms),
    rules: matchedRules,
  };
}

function detectMedicalContext(message) {
  const normalizedMessage = normalizeText(message);

  return [...MEDICAL_CONTEXT_TERMS].filter((term) =>
    normalizedMessage.includes(normalizeText(term))
  );
}

function shouldUseAiQueryExpansion(entries, matchedRules) {
  if (!entries.length) return true;

  const topScore = entries[0]?.score || 0;
  const secondScore = entries[1]?.score || 0;
  const margin = topScore - secondScore;

  if (topScore >= RETRIEVAL_CONFIG.strongTopScore) return false;

  if (
    matchedRules.length > 0 &&
    topScore >= 170 &&
    margin >= 35
  ) {
    return false;
  }

  return !(
    topScore >= 180 &&
    margin >= RETRIEVAL_CONFIG.strongScoreMargin
  );
}

async function expandClinicalQueryWithAi(message, env) {
  const plannerPrompt = `
Anda membantu mesin pencarian database diagnosis keperawatan.

Tugas Anda BUKAN menetapkan diagnosis dan BUKAN membuat kode standar.
Terjemahkan bahasa pengguna menjadi konsep klinis dan kata pencarian yang dapat
membantu menemukan diagnosis keperawatan yang sudah ada dalam database.

Aturan:
- Bedakan masalah aktif dari penyakit dasar atau terapi.
- Utamakan keluhan yang sedang terjadi.
- Boleh menyebut nama konsep diagnosis yang mungkin sebagai kata pencarian,
  tetapi jangan membuat kode SDKI, SLKI, atau SIKI.
- Jangan memberi jawaban klinis kepada pengguna.
- Keluarkan JSON valid saja tanpa markdown.

Format:
{
  "activeProblem": "ringkasan masalah aktif",
  "clinicalConcepts": ["konsep klinis"],
  "searchTerms": ["kata atau frasa untuk pencarian database"],
  "medicalContext": ["penyakit atau terapi sebagai konteks"]
}

Contoh pemetaan konsep:
- CKD dengan kedua kaki bengkak: fokus edema/retensi cairan/kelebihan volume
  cairan; CKD adalah konteks.
- ASI tidak keluar setelah melahirkan: fokus proses menyusui/laktasi.
- TB on OAT dengan kulit melepuh: fokus kerusakan kulit; TB dan OAT adalah konteks.

Pesan pengguna:
${message}
  `.trim();

  const result = await callKiosApi(env, {
    messages: [
      {
        role: "system",
        content: "Anda adalah perencana kata pencarian klinis. Jawab JSON valid saja.",
      },
      { role: "user", content: plannerPrompt },
    ],
    maxTokens: 350,
    thinking: false,
    temperature: 0,
  });

  const content = result?.choices?.[0]?.message?.content?.trim() || "";
  const parsed = parseJsonObject(content);

  if (!parsed) {
    return { plan: null, usage: extractUsage(result) };
  }

  return {
    plan: sanitizeQueryPlan(parsed),
    usage: extractUsage(result),
  };
}

function sanitizeQueryPlan(value) {
  return {
    activeProblem: cleanString(value?.activeProblem, 500),
    clinicalConcepts: cleanStringArray(value?.clinicalConcepts, 12, 120),
    searchTerms: cleanStringArray(value?.searchTerms, 16, 120),
    medicalContext: cleanStringArray(value?.medicalContext, 10, 120),
  };
}

function mergeQueryPlans(basePlan, newPlan) {
  return {
    activeProblem: newPlan.activeProblem || basePlan.activeProblem || "",
    clinicalConcepts: uniqueStrings([
      ...basePlan.clinicalConcepts,
      ...newPlan.clinicalConcepts,
    ]).slice(0, 16),
    searchTerms: uniqueStrings([
      ...basePlan.searchTerms,
      ...newPlan.searchTerms,
      ...newPlan.clinicalConcepts,
    ]).slice(0, 24),
    medicalContext: uniqueStrings([
      ...basePlan.medicalContext,
      ...newPlan.medicalContext,
    ]).slice(0, 12),
  };
}

function buildQueryInfo(message, queryPlan) {
  const rawMessage = String(message || "");
  const priorityText = [
    queryPlan?.activeProblem,
    ...(queryPlan?.clinicalConcepts || []),
    ...(queryPlan?.searchTerms || []),
  ].filter(Boolean).join(" ");

  const contextText = (queryPlan?.medicalContext || []).join(" ");
  const expandedText = [rawMessage, priorityText].filter(Boolean).join(" ");
  const contextTokens = tokenizeQuery(contextText);
  const contextTokenSet = new Set(contextTokens);
  const genericPriorityTokens = new Set([
    "tidak", "efektif", "gangguan", "masalah", "kondisi", "risiko",
    "penurunan", "peningkatan", "ketidakmampuan", "proses"
  ]);

  return {
    normalizedQuery: normalizeText(expandedText),
    originalTokens: tokenizeQuery(rawMessage).filter(
      (token) => !contextTokenSet.has(token)
    ),
    priorityTokens: tokenizeQuery(priorityText).filter(
      (token) => !genericPriorityTokens.has(token)
    ),
    contextTokens,
    priorityPhrases: uniqueStrings([
      ...(queryPlan?.clinicalConcepts || []),
      ...(queryPlan?.searchTerms || []),
    ]).map(normalizeText).filter(Boolean),
  };
}

function searchScoredItems(items, queryInfo, limit, minimumScore = 1) {
  if (!Array.isArray(items) || !items.length) return [];

  return items
    .map((item) => scoreSearchItem(item, queryInfo))
    .filter((entry) => entry.score >= minimumScore)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return String(getItemTitle(a.item)).localeCompare(
        String(getItemTitle(b.item)),
        "id"
      );
    })
    .slice(0, limit);
}

function scoreSearchItem(item, queryInfo) {
  const code = normalizeText(getItemCode(item));
  const title = normalizeText(getItemTitle(item));
  const clinicalText = getClinicalSearchText(item);
  const fullText = `${title} ${clinicalText}`.trim();

  let score = 0;
  let matchedPriorityTerms = 0;
  let matchedOriginalTerms = 0;
  let matchedContextTerms = 0;

  if (code && queryInfo.normalizedQuery === code) score += 600;
  if (title && queryInfo.normalizedQuery === title) score += 520;

  for (const phrase of queryInfo.priorityPhrases) {
    if (!phrase || phrase.length < 3) continue;

    if (title === phrase) {
      score += 360;
      matchedPriorityTerms += 2;
    } else if (title.includes(phrase) || phrase.includes(title)) {
      score += 220;
      matchedPriorityTerms += 2;
    } else if (clinicalText.includes(phrase)) {
      score += 90;
      matchedPriorityTerms += 1;
    }
  }

  for (const token of queryInfo.priorityTokens) {
    if (code === token) {
      score += 140;
      matchedPriorityTerms += 1;
    } else if (title.includes(token)) {
      score += 62;
      matchedPriorityTerms += 1;
    } else if (clinicalText.includes(token)) {
      score += 24;
      matchedPriorityTerms += 1;
    }
  }

  for (const token of queryInfo.originalTokens) {
    if (code === token) {
      score += 110;
      matchedOriginalTerms += 1;
    } else if (title.includes(token)) {
      score += 34;
      matchedOriginalTerms += 1;
    } else if (clinicalText.includes(token)) {
      score += 10;
      matchedOriginalTerms += 1;
    }
  }

  for (const token of queryInfo.contextTokens) {
    if (fullText.includes(token)) {
      score += 3;
      matchedContextTerms += 1;
    }
  }

  if (matchedPriorityTerms >= 2) {
    score += Math.min(100, matchedPriorityTerms * 18);
  }

  if (matchedOriginalTerms >= 2) {
    score += Math.min(50, matchedOriginalTerms * 8);
  }

  if (
    matchedPriorityTerms === 0 &&
    matchedOriginalTerms === 0 &&
    matchedContextTerms > 0
  ) {
    score -= 80;
  }

  return {
    item,
    score,
    matchedPriorityTerms,
    matchedOriginalTerms,
    matchedContextTerms,
  };
}

function getClinicalSearchText(item) {
  return normalizeText(
    stringifySearchable({
      definisi: item?.definisi,
      deskripsi: item?.deskripsi,
      kategori: item?.kategori,
      subkategori: item?.subkategori,
      penyebab: item?.penyebab,
      etiologi: item?.etiologi,
      faktorRisiko: item?.faktorRisiko || item?.faktor_risiko,
      tandaGejala:
        item?.tandaGejala ||
        item?.tanda_gejala ||
        item?.gejalaTanda ||
        item?.gejala_tanda,
      mayor: item?.mayor || item?.gejalaMayor || item?.gejala_mayor,
      minor: item?.minor || item?.gejalaMinor || item?.gejala_minor,
      kondisiKlinis: item?.kondisiKlinis || item?.kondisi_klinis,
      indikator: item?.indikator || item?.kriteriaHasil,
      ekspektasi: item?.ekspektasi,
      tujuan: item?.tujuan,
      tindakan: item?.tindakan,
      observasi: item?.observasi,
      terapeutik: item?.terapeutik,
      edukasi: item?.edukasi,
      kolaborasi: item?.kolaborasi,
    })
  );
}

function tokenizeQuery(value) {
  const stopwords = new Set([
    "yang", "dan", "atau", "dengan", "pada", "untuk", "dari", "dalam",
    "adalah", "apa", "bagaimana", "mengapa", "kenapa", "pasien", "saya",
    "aku", "ini", "itu", "jadi", "bisa", "tolong", "jelaskan", "tentang",
    "seorang", "seperti", "lebih", "paling", "kemungkinan", "diagnosa",
    "diagnosis", "keperawatan", "sdki", "slki", "siki", "ibu", "bapak",
    "orang", "baru", "mengeluh", "mengatakan", "mengalami", "diketahui",
    "terdapat", "setelah", "sejak", "kedua", "sedang", "diberikan"
  ]);

  return [...new Set(
    normalizeText(value)
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length >= 3 && !stopwords.has(token))
  )].slice(0, 30);
}

function stringifySearchable(item) {
  try {
    return JSON.stringify(item);
  } catch {
    return String(item || "");
  }
}

function searchCaseExamples(items, queryInfo, limit) {
  if (!Array.isArray(items) || !items.length) return [];

  return items
    .map((item) => {
      const text = normalizeText(stringifySearchable(item));
      let score = 0;

      for (const phrase of queryInfo.priorityPhrases) {
        if (phrase && text.includes(phrase)) score += 60;
      }

      for (const token of queryInfo.priorityTokens) {
        if (text.includes(token)) score += 20;
      }

      for (const token of queryInfo.originalTokens) {
        if (text.includes(token)) score += 8;
      }

      return { item, score };
    })
    .filter((entry) => entry.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function resolveSdkiFromCaseEntries(sdkiItems, caseEntries) {
  const references = [];

  for (const entry of caseEntries) {
    collectSdkiReferences(entry.item, references, 0);
  }

  const normalizedReferences = new Set(
    references.map(normalizeText).filter(Boolean)
  );

  if (!normalizedReferences.size) return [];

  return sdkiItems.filter((item) => {
    const code = normalizeText(getItemCode(item));
    const title = normalizeText(getItemTitle(item));
    return normalizedReferences.has(code) || normalizedReferences.has(title);
  });
}

function collectSdkiReferences(value, output, depth) {
  if (depth > 5 || value == null) return;

  if (typeof value === "string" || typeof value === "number") {
    const text = String(value);
    const codes = text.match(/\bD\s*\.?\s*\d{4,5}\b/gi) || [];
    output.push(...codes);
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 30)) {
      collectSdkiReferences(item, output, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    const preferredKeys = [
      "kodeSdki", "kodeSDKI", "sdkiCode", "judulSdki", "judulSDKI",
      "sdkiTitle", "diagnosis", "diagnosa", "sdki", "kodeDiagnosis",
      "judulDiagnosis", "kodeDiagnosa", "judulDiagnosa"
    ];

    let found = false;

    for (const key of preferredKeys) {
      if (value[key] != null) {
        const nested = value[key];

        if (typeof nested === "string" || typeof nested === "number") {
          output.push(String(nested));
        } else {
          collectSdkiReferences(nested, output, depth + 1);
        }

        found = true;
      }
    }

    if (!found) {
      for (const nested of Object.values(value).slice(0, 20)) {
        collectSdkiReferences(nested, output, depth + 1);
      }
    }
  }
}

function filterRankedSdkiEntries(entries, maximumItems) {
  if (!entries.length) return [];

  const topScore = entries[0].score || 0;
  const relativeMinimum = Math.max(60, Math.floor(topScore * 0.22));

  return entries
    .filter((entry, index) => index === 0 || entry.score >= relativeMinimum)
    .slice(0, maximumItems);
}

function deduplicateScoredEntries(entries) {
  const map = new Map();

  for (const entry of entries) {
    if (!entry?.item) continue;

    const key = normalizeText(
      getItemCode(entry.item) || getItemTitle(entry.item) || entry.item?.id
    );

    if (!key) continue;

    const current = map.get(key);
    if (!current || entry.score > current.score) {
      map.set(key, entry);
    }
  }

  return [...map.values()].sort((a, b) => b.score - a.score);
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values || []) {
    const text = cleanString(String(value || ""), 200);
    const key = normalizeText(text);

    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }

  return result;
}

function cleanStringArray(value, maximumItems, maximumLength) {
  if (!Array.isArray(value)) return [];

  return uniqueStrings(
    value
      .filter((item) => typeof item === "string" || typeof item === "number")
      .map((item) => cleanString(String(item), maximumLength))
  ).slice(0, maximumItems);
}

function parseJsonObject(text) {
  if (!text) return null;

  const cleaned = String(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) return null;

    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function findExactItem(items, reference) {
  const target = normalizeText(reference);

  return items.find((item) => {
    return (
      normalizeText(getItemCode(item)) === target ||
      normalizeText(getItemTitle(item)) === target ||
      normalizeText(item?.id) === target
    );
  });
}

function findRelationsForSdki(relations, sdkiItems) {
  const targets = new Set();

  for (const item of sdkiItems) {
    for (const value of [getItemCode(item), getItemTitle(item), item?.id]) {
      const normalized = normalizeText(value);
      if (normalized) targets.add(normalized);
    }
  }

  if (!targets.size) return [];

  return relations.filter((relation) => {
    const candidates = [
      relation?.kodeSdki,
      relation?.judulSdki,
      relation?.sdkiCode,
      relation?.sdkiTitle,
      relation?.kode,
      relation?.judul,
    ];

    return candidates.some((value) => targets.has(normalizeText(value)));
  });
}

function findItemsFromRelationReferences(items, relations, fieldNames) {
  const references = [];

  for (const relation of relations) {
    for (const fieldName of fieldNames) {
      collectReferences(relation?.[fieldName], references, 0);
    }
  }

  const normalizedReferences = new Set();

  for (const reference of references) {
    const normalized = normalizeText(reference);
    if (normalized) normalizedReferences.add(normalized);

    const codes = String(reference || "").match(
      /\b(?:D|L|I)\s*\.?\s*\d{4,5}\b/gi
    ) || [];

    for (const code of codes) {
      normalizedReferences.add(normalizeText(code));
    }
  }

  if (!normalizedReferences.size) return [];

  return items.filter((item) => {
    const candidates = [getItemCode(item), getItemTitle(item), item?.id]
      .map(normalizeText)
      .filter(Boolean);

    return candidates.some((candidate) =>
      normalizedReferences.has(candidate)
    );
  });
}

function collectReferences(value, output, depth) {
  if (depth > 4 || value == null) return;

  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value.slice(0, 50)) {
      collectReferences(item, output, depth + 1);
    }
    return;
  }

  if (typeof value === "object") {
    const preferredKeys = [
      "kode", "code", "id", "judul", "title", "nama",
      "kodeSlki", "judulSlki", "kodeSiki", "judulSiki"
    ];

    let foundPreferred = false;

    for (const key of preferredKeys) {
      if (value[key] != null) {
        collectReferences(value[key], output, depth + 1);
        foundPreferred = true;
      }
    }

    if (!foundPreferred) {
      for (const nested of Object.values(value).slice(0, 20)) {
        collectReferences(nested, output, depth + 1);
      }
    }
  }
}

function deduplicateItems(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (!item) continue;

    const key = normalizeText(
      getItemCode(item) || getItemTitle(item) || item?.id || JSON.stringify(item)
    );

    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}

function buildDatabaseContext(matches, retrievalResult) {
  if (
    !matches.sdki.length &&
    !matches.slki.length &&
    !matches.siki.length
  ) {
    return "Tidak ditemukan kecocokan database yang cukup dari pertanyaan pengguna.";
  }

  const queryPlanSection = formatQueryPlanContext(retrievalResult.queryPlan);
  const sdkiSection = formatSdkiCandidateSection(matches.sdkiEntries);
  const relationSection = formatRelationContext(matches.relations);
  const slkiSection = formatContextSection(
    "SLKI",
    matches.slki,
    RETRIEVAL_CONFIG.slkiLimit
  );
  const sikiSection = formatContextSection(
    "SIKI",
    matches.siki,
    RETRIEVAL_CONFIG.sikiLimit
  );

  return [
    queryPlanSection,
    sdkiSection,
    relationSection,
    slkiSection,
    sikiSection,
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, RETRIEVAL_CONFIG.maximumDatabaseContextChars);
}

function formatQueryPlanContext(plan) {
  if (!plan) return "";

  return `## RENCANA PENCARIAN\n${JSON.stringify({
    masalahAktif: plan.activeProblem || null,
    konsepKlinis: plan.clinicalConcepts || [],
    kataPencarian: plan.searchTerms || [],
    konteksMedis: plan.medicalContext || [],
  }, null, 2)}`;
}

function formatSdkiCandidateSection(entries) {
  if (!entries.length) return "";

  const content = entries.map((entry, index) => {
    const fullDetail = index < RETRIEVAL_CONFIG.fullSdkiContext;
    const compact = fullDetail
      ? compactItemForContext(entry.item)
      : compactItemSummary(entry.item);

    return [
      `[SDKI KANDIDAT ${index + 1} | skor retrieval ${entry.score}]`,
      JSON.stringify(compact, null, 2),
    ].join("\n");
  });

  return `## SDKI KANDIDAT TERURUT\n${content.join("\n\n")}`;
}

function formatRelationContext(relations) {
  if (!relations.length) return "";

  const content = relations.map((relation, index) => {
    const compact = {
      kodeSdki: firstString(
        relation?.kodeSdki,
        relation?.kodeSDKI,
        relation?.sdkiCode,
        relation?.kode
      ),
      judulSdki: firstString(
        relation?.judulSdki,
        relation?.judulSDKI,
        relation?.sdkiTitle,
        relation?.judul
      ),
      slki: compactValue(relation?.slki || [], 0),
      sikiUtama: compactValue(relation?.sikiUtama || [], 0),
      sikiPendukung: compactValue(relation?.sikiPendukung || [], 0),
      sikiBelumTerklasifikasi: compactValue(
        relation?.sikiBelumTerklasifikasi || [],
        0
      ),
    };

    return `[RELASI ${index + 1}]\n${JSON.stringify(compact, null, 2)}`;
  });

  return `## RELASI TERVERIFIKASI\n${content.join("\n\n")}`;
}

function formatContextSection(label, items, maximumItems) {
  if (!items.length) return "";

  const content = items.slice(0, maximumItems).map((item, index) => {
    const compact = compactItemForContext(item);
    return `[${label} ${index + 1}]\n${JSON.stringify(compact, null, 2)}`;
  });

  return `## ${label}\n${content.join("\n\n")}`;
}

function compactItemSummary(item) {
  return {
    kode: getItemCode(item) || null,
    judul: getItemTitle(item) || null,
    definisi: firstString(item?.definisi, item?.deskripsi) || null,
  };
}

function compactItemForContext(item) {
  const result = {};
  const preferredKeys = [
    "id", "kode", "code", "judul", "title", "nama",
    "definisi", "deskripsi", "kategori", "subkategori",
    "penyebab", "faktorRisiko", "faktor_risiko", "tandaGejala",
    "tanda_gejala", "gejalaTanda", "gejala_tanda", "mayor", "minor",
    "gejalaMayor", "gejalaMinor", "kondisiKlinis", "kondisi_klinis",
    "ekspektasi", "tujuan", "kriteriaHasil", "indikator", "tindakan",
    "observasi", "terapeutik", "edukasi", "kolaborasi"
  ];

  for (const key of preferredKeys) {
    if (item?.[key] != null && item[key] !== "") {
      result[key] = compactValue(item[key], 0);
    }
  }

  if (Object.keys(result).length < 4 && item && typeof item === "object") {
    for (const [key, value] of Object.entries(item).slice(0, 16)) {
      if (result[key] == null && value != null && value !== "") {
        result[key] = compactValue(value, 0);
      }
    }
  }

  return result;
}

function compactValue(value, depth) {
  if (depth > 4) return "[dipersingkat]";

  if (typeof value === "string") {
    return value.length > 1200 ? `${value.slice(0, 1200)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean" || value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => compactValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const output = {};
    for (const [key, nested] of Object.entries(value).slice(0, 16)) {
      output[key] = compactValue(nested, depth + 1);
    }
    return output;
  }

  return String(value);
}

function buildSourceList(matches) {
  const sourceItems = [
    ...matches.sdki.map((item) => ({ type: "SDKI", item })),
    ...matches.slki.map((item) => ({ type: "SLKI", item })),
    ...matches.siki.map((item) => ({ type: "SIKI", item })),
  ];

  return sourceItems.map(({ type, item }) => ({
    type,
    code: getItemCode(item) || null,
    title: getItemTitle(item) || null,
  }));
}

function getItemCode(item) {
  return firstString(
    item?.kode,
    item?.code,
    item?.kodeSdki,
    item?.kodeSlki,
    item?.kodeSiki,
    item?.id
  );
}

function getItemTitle(item) {
  return firstString(
    item?.judul,
    item?.title,
    item?.nama,
    item?.judulSdki,
    item?.judulSlki,
    item?.judulSiki
  );
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function cleanHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (item) =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string" &&
        item.content.trim()
    )
    .slice(-6)
    .map((item) => ({
      role: item.role,
      // Batasi riwayat per pesan agar konteks tetap relevan tanpa membengkakkan input.
      content: cleanString(item.content, 1400),
    }));
}

function cleanString(value, maximumLength) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maximumLength);
}

async function validateTurnstileIfConfigured(request, env, token) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return { success: true, skipped: true };
  }

  if (typeof token !== "string" || !token.trim()) {
    return { success: false, reason: "missing-token" };
  }

  try {
    const ip = request.headers.get("CF-Connecting-IP") || undefined;
    const formData = new FormData();
    formData.append("secret", env.TURNSTILE_SECRET_KEY);
    formData.append("response", token.trim());
    if (ip) formData.append("remoteip", ip);

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: formData }
    );

    const result = await response.json();
    return { success: Boolean(result?.success), result };
  } catch (error) {
    console.error("Turnstile validation error:", error);
    return { success: false, reason: "validation-error" };
  }
}

function getAnswerTokenBudget(message, matches) {
  const text = String(message || "").toLowerCase();
  const caseSignals = /\b(pasien|kasus|analisis|askep|pengkajian|diagnosis|diagnosa|sdk[i]?|slki|siki|data subjektif|data objektif|implementasi|intervensi|luaran|rencana keperawatan)\b/i;
  const isDetailedCase =
    caseSignals.test(text) ||
    text.length > 900 ||
    (matches?.sdki?.length || 0) >= 3;

  // Anggaran moderat untuk pertanyaan umum dan lebih besar untuk analisis kasus.
  // Kelanjutan hanya dipanggil bila provider mengembalikan finish_reason=length.
  return isDetailedCase ? 2800 : text.length > 250 ? 1800 : 1200;
}

function getFinishReason(result) {
  return result?.choices?.[0]?.finish_reason ||
    result?.choices?.[0]?.stop_reason ||
    result?.finish_reason ||
    null;
}

function isLengthFinishReason(reason) {
  return ["length", "max_tokens", "max_output_tokens", "token_limit"].includes(
    String(reason || "").toLowerCase()
  );
}

function appendContinuation(previous, continuation) {
  const left = String(previous || "");
  const rawRight = String(continuation || "");
  const right = rawRight.trimEnd();
  if (!right.trim()) return left;
  if (!left) return right.trimStart();
  if (/\s$/.test(left) || /^\s/.test(right)) return left + right;

  // Output tanpa spasi di awal dianggap sambungan fragmen kata. Prompt
  // kelanjutan meminta model memberi spasi eksplisit bila memulai kata baru.
  return left + right;
}

async function callKiosApi(
  env,
  {
    messages,
    maxTokens = 1200,
    temperature,
  }
) {
  const payload = {
    model: getKiosApiModel(env),
    messages,
    max_tokens: maxTokens,
    stream: false,
  };

  if (typeof temperature === "number") {
    payload.temperature = temperature;
  }

  const response = await fetch(KIOSAPI_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.KIOSAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let result;

  try {
    result = responseText ? JSON.parse(responseText) : {};
  } catch {
    const error = new Error("Kios API memberikan respons yang tidak dapat dibaca.");
    error.providerStatus = 502;
    error.providerResult = {};
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      result?.error?.message || result?.message || `Kios API error ${response.status}`
    );
    error.providerStatus = response.status;
    error.providerResult = result;
    throw error;
  }

  return result;
}

function validateAnswerCodes(answer, matches) {
  const allowedCodes = new Set(
    [
      ...matches.sdki,
      ...matches.slki,
      ...matches.siki,
    ]
      .map((item) => normalizeStandardCode(getItemCode(item)))
      .filter(Boolean)
  );

  const mentionedCodes = String(answer || "").match(
    /\b(?:D|L|I)\s*\.?\s*\d{4,5}\b/gi
  ) || [];

  const invalidCodes = uniqueStrings(
    mentionedCodes
      .map(normalizeStandardCode)
      .filter((code) => code && !allowedCodes.has(code))
  );

  return {
    valid: invalidCodes.length === 0,
    invalidCodes,
  };
}

function normalizeStandardCode(value) {
  const normalized = String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/^([DLI])(?=\d)/, "$1.");

  const match = normalized.match(/^([DLI])\.?([0-9]{4,5})$/);
  return match ? `${match[1]}.${match[2]}` : "";
}

async function repairAnswerStandards(
  env,
  answer,
  userMessage,
  databaseContext,
  invalidCodes
) {
  return callKiosApi(env, {
    messages: [
      {
        role: "system",
        content: `
Perbaiki jawaban agar setiap diagnosis SDKI, luaran SLKI, dan intervensi SIKI
hanya memakai kode dan judul yang tersedia dalam konteks database. Jangan
mengubah analisis umum yang masih benar. Hapus atau ganti penyebutan standar
yang tidak tersedia. Setiap standar resmi wajib disertai kode. Jawab hanya
dengan jawaban akhir yang sudah diperbaiki.
        `.trim(),
      },
      {
        role: "user",
        content: `
PERTANYAAN PENGGUNA:
${userMessage}

KODE TIDAK VALID YANG DITEMUKAN:
${invalidCodes.join(", ")}

KONTEKS DATABASE YANG DIIZINKAN:
${databaseContext}

JAWABAN YANG HARUS DIPERBAIKI:
${answer}
        `.trim(),
      },
    ],
    maxTokens: 1400,
    thinking: false,
    temperature: 0,
  });
}

function emptyUsage() {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    costIdr: 0,
  };
}

function extractUsage(result) {
  return {
    inputTokens: result?.usage?.prompt_tokens || 0,
    outputTokens: result?.usage?.completion_tokens || 0,
    totalTokens: result?.usage?.total_tokens || 0,
    costIdr: Number(result?.usage?.cost_idr || 0),
  };
}

function addUsages(...usages) {
  return usages.reduce(
    (total, usage) => ({
      inputTokens: total.inputTokens + (usage?.inputTokens || 0),
      outputTokens: total.outputTokens + (usage?.outputTokens || 0),
      totalTokens: total.totalTokens + (usage?.totalTokens || 0),
      costIdr: total.costIdr + (usage?.costIdr || 0),
    }),
    emptyUsage()
  );
}

function handleKiosApiError(status, result, corsHeaders) {
  const providerMessage = result?.error?.message || result?.message || "Kios API error";

  const errorMap = {
    400: {
      code: "AI_BAD_REQUEST",
      message: "Permintaan ke AI tidak valid. Periksa format data.",
    },
    401: {
      code: "AI_AUTH_ERROR",
      message: "API key Kios API tidak valid atau tidak aktif.",
    },
    402: {
      code: "AI_BALANCE_EMPTY",
      message: "Saldo layanan AI sedang habis. Fitur pencarian ASKEP tetap dapat digunakan.",
    },
    422: {
      code: "AI_INVALID_PARAMETER",
      message: "Pengaturan permintaan AI tidak dapat diproses.",
    },
    429: {
      code: "AI_RATE_LIMIT",
      message: "Permintaan AI terlalu banyak. Silakan coba kembali beberapa saat lagi.",
    },
    500: {
      code: "AI_PROVIDER_ERROR",
      message: "Layanan AI Kios API sedang mengalami gangguan.",
    },
    503: {
      code: "AI_BUSY",
      message: "Layanan AI sedang sibuk. Silakan coba kembali.",
    },
  };

  const mapped = errorMap[status] || {
    code: "AI_UNKNOWN_ERROR",
    message: "Layanan AI sedang tidak tersedia. Silakan coba kembali.",
  };

  return sendJson(
    {
      success: false,
      code: mapped.code,
      message: mapped.message,
      providerMessage,
    },
    status >= 400 && status < 600 ? status : 502,
    corsHeaders
  );
}

async function handleR2File(env, objectKey, corsHeaders) {
  if (!env.ASKEP_DATA) {
    return sendJson(
      { success: false, message: "Binding R2 ASKEP_DATA belum tersedia." },
      500,
      corsHeaders
    );
  }

  try {
    const object = await env.ASKEP_DATA.get(objectKey);

    if (!object) {
      return sendJson(
        {
          success: false,
          message: "File tidak ditemukan di R2.",
          objectKey,
          suggestion: "Buka /api/test-r2 untuk melihat path file yang sebenarnya.",
        },
        404,
        corsHeaders
      );
    }

    const headers = new Headers(corsHeaders);
    headers.set(
      "Content-Type",
      object.httpMetadata?.contentType || "application/json; charset=utf-8"
    );
    headers.set("Cache-Control", "public, max-age=300");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Robots-Tag", "noindex, nofollow");

    if (object.etag) headers.set("ETag", object.etag);

    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error("R2 get error:", error);
    return sendJson(
      {
        success: false,
        message: "Terjadi kesalahan saat membaca R2.",
        objectKey,
      },
      500,
      corsHeaders
    );
  }
}

function getPublicCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function getAiCorsHeaders(request, env) {
  const headers = new Headers();
  const origin = request.headers.get("Origin");

  if (origin && isAiOriginAllowed(request, env)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }

  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

function isAiOriginAllowed(request, env) {
  const origin = request.headers.get("Origin");

  // Permintaan tanpa Origin masih berguna untuk pengujian curl.
  // Pada produksi, aktifkan Turnstile agar endpoint tidak bergantung pada CORS saja.
  if (!origin) return true;

  const workerOrigin = new URL(request.url).origin;
  if (origin === workerOrigin) return true;

  const allowedOrigins = String(env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return allowedOrigins.includes(origin);
}

function methodNotAllowed(corsHeaders, allowedMethods) {
  const headers = new Headers(corsHeaders);
  headers.set("Allow", allowedMethods.join(", "));

  return sendJson(
    {
      success: false,
      message: "Metode tidak diizinkan.",
      allowedMethods,
    },
    405,
    headers
  );
}

function sendJson(data, status, additionalHeaders) {
  const headers = new Headers(additionalHeaders);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers,
  });
}