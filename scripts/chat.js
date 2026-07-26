(function () {
  "use strict";

  const API_URL = "https://askep.mkhoirulzed.workers.dev/api/ai/chat";
  const STORAGE_KEY = "askep_ai_chat_history_v1";
  const MAX_STORED_MESSAGES = 20;
  const MAX_API_HISTORY = 12;
  const REQUEST_TIMEOUT_MS = 60000;

  const chatMain = document.getElementById("chatMain");
  const chatStream = document.getElementById("chatStream");
  const welcome = document.getElementById("chatWelcome");
  const input = document.getElementById("chatInput");
  const sendButton = document.getElementById("chatSendBtn");
  const clearButton = document.getElementById("clearChatBtn");
  const composerShell = document.querySelector(".chat-composer-shell");
  const bottomNav = document.querySelector(".bottom-nav");

  if (!chatMain || !chatStream || !welcome || !input || !sendButton || !clearButton) {
    console.error("Elemen Chat AI tidak lengkap.");
    return;
  }

  let messages = [];
  let requestController = null;
  let requestTimeout = null;
  let pendingId = null;

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatAnswer(value) {
    const safe = escapeHtml(value || "");
    const blocks = safe.split(/\n{2,}/).filter(Boolean);

    return blocks.map(block => {
      const lines = block.split("\n");
      const isBulletList = lines.length > 1 && lines.every(line => /^[-•]\s+/.test(line.trim()));
      const isNumberList = lines.length > 1 && lines.every(line => /^\d+[.)]\s+/.test(line.trim()));

      if (isBulletList) {
        return `<ul>${lines.map(line => `<li>${line.replace(/^[-•]\s+/, "")}</li>`).join("")}</ul>`;
      }

      if (isNumberList) {
        return `<ol>${lines.map(line => `<li>${line.replace(/^\d+[.)]\s+/, "")}</li>`).join("")}</ol>`;
      }

      return `<p>${block.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}</p>`;
    }).join("");
  }

  function sourceLabel(source) {
    if (typeof source === "string") return source;
    if (!source || typeof source !== "object") return "";

    const type = source.type || source.jenis || source.category || "";
    const code = source.kode || source.code || source.id || source.kodeSdki || source.kodeSlki || source.kodeSiki || "";
    const title = source.judul || source.title || source.nama || source.name || "";

    return [type ? String(type).toUpperCase() : "", code, title].filter(Boolean).join(" · ");
  }

  function normalizeSources(sources) {
    if (!Array.isArray(sources)) return [];
    return [...new Set(sources.map(sourceLabel).filter(Boolean))].slice(0, 10);
  }

  function saveMessages() {
    try {
      const safeMessages = messages
        .filter(message => !message.pending && (message.role === "user" || message.role === "assistant"))
        .slice(-MAX_STORED_MESSAGES)
        .map(message => ({
          role: message.role,
          content: message.content,
          sources: message.sources || []
        }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeMessages));
    } catch (error) {
      console.warn("Riwayat chat tidak dapat disimpan:", error);
    }
  }

  function loadMessages() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!Array.isArray(parsed)) return;
      messages = parsed
        .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
        .slice(-MAX_STORED_MESSAGES);
    } catch {
      messages = [];
    }
  }

  function updateViewportSpacing() {
    const composerHeight = composerShell ? composerShell.getBoundingClientRect().height : 0;
    const navHeight = window.innerWidth < 900 && bottomNav
      ? bottomNav.getBoundingClientRect().height
      : 0;
    const spacing = Math.max(170, Math.ceil(composerHeight + navHeight + 28));

    chatStream.style.paddingBottom = `${spacing}px`;
    chatMain.style.scrollPaddingBottom = `${spacing}px`;
  }

  function scrollToBottom() {
    updateViewportSpacing();
    window.requestAnimationFrame(() => {
      chatMain.scrollTop = chatMain.scrollHeight;
      window.setTimeout(() => {
        chatMain.scrollTop = chatMain.scrollHeight;
      }, 80);
    });
  }

  function copyText(text, button) {
    const fallback = () => {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      return copied;
    };

    const done = () => {
      const original = button.innerHTML;
      button.innerHTML = '<i class="fa-solid fa-check"></i> Tersalin';
      window.setTimeout(() => { button.innerHTML = original; }, 1400);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done).catch(() => {
        if (fallback()) done();
      });
    } else if (fallback()) {
      done();
    }
  }

  function createMessageElement(message, index) {
    const article = document.createElement("article");
    article.className = `chat-message ${message.role}${message.error ? " chat-error" : ""}`;
    article.dataset.index = String(index);

    const avatarIcon = message.role === "user" ? "fa-user" : "fa-user-nurse";
    const roleLabel = message.role === "user" ? "Anda" : "AI ASKEP";
    const bodyHtml = message.pending
      ? '<div class="chat-thinking" aria-label="AI sedang berpikir"><span></span><span></span><span></span></div>'
      : message.role === "assistant"
        ? formatAnswer(message.content)
        : `<p>${escapeHtml(message.content).replace(/\n/g, "<br>")}</p>`;

    const sourceHtml = message.role === "assistant" && message.sources?.length
      ? `<div class="chat-sources">${message.sources.map(label => `<span class="chat-source-chip"><i class="fa-solid fa-database"></i>${escapeHtml(label)}</span>`).join("")}</div>`
      : "";

    const actionsHtml = message.role === "assistant" && !message.pending && message.content
      ? '<div class="chat-message-actions"><button class="chat-copy-btn native-click" type="button"><i class="fa-regular fa-copy"></i> Salin</button></div>'
      : "";

    if (message.role === "user") {
      article.innerHTML = `
        <div class="chat-message-body">
          <div class="chat-role">${roleLabel}</div>
          <div class="chat-bubble">${bodyHtml}</div>
        </div>
        <div class="chat-avatar"><i class="fa-solid ${avatarIcon}"></i></div>
      `;
    } else {
      article.innerHTML = `
        <div class="chat-avatar"><i class="fa-solid ${avatarIcon}"></i></div>
        <div class="chat-message-body">
          <div class="chat-role">${roleLabel}</div>
          <div class="chat-bubble">${bodyHtml}</div>
          ${sourceHtml}
          ${actionsHtml}
        </div>
      `;
    }

    const copyButton = article.querySelector(".chat-copy-btn");
    if (copyButton) copyButton.addEventListener("click", () => copyText(message.content, copyButton));

    return article;
  }

  function renderMessages() {
    const hasMessages = messages.length > 0;
    welcome.hidden = hasMessages;
    welcome.style.display = hasMessages ? "none" : "grid";
    chatStream.querySelectorAll(".chat-message").forEach(element => element.remove());

    messages.forEach((message, index) => {
      chatStream.appendChild(createMessageElement(message, index));
    });

    scrollToBottom();
  }

  function updateSendState() {
    sendButton.disabled = !input.value.trim() || Boolean(requestController);
  }

  function autoResize() {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 150)}px`;
    updateViewportSpacing();
  }

  function apiHistory() {
    return messages
      .filter(message => !message.pending && !message.error && ["user", "assistant"].includes(message.role))
      .slice(-MAX_API_HISTORY)
      .map(message => ({ role: message.role, content: message.content }));
  }

  function clearRequestTimer() {
    if (requestTimeout) {
      window.clearTimeout(requestTimeout);
      requestTimeout = null;
    }
  }

  async function sendMessage(text) {
    const message = String(text || "").trim();
    if (!message || requestController) return;

    const history = apiHistory();

    messages.push({ role: "user", content: message });
    saveMessages();
    input.value = "";
    autoResize();

    pendingId = `pending-${Date.now()}`;
    messages.push({ role: "assistant", content: "", pending: true, id: pendingId });
    renderMessages();

    requestController = new AbortController();
    requestTimeout = window.setTimeout(() => {
      if (requestController) requestController.abort("timeout");
    }, REQUEST_TIMEOUT_MS);
    updateSendState();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        signal: requestController.signal,
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          history,
          context: {
            page: "search",
            activeFilter: "all",
            searchMode: "standard",
            sourcePage: "chat",
            mode: "conversation"
          }
        })
      });

      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error("Respons AI tidak dapat dibaca.");
      }

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || payload?.error?.message || `Permintaan AI gagal (${response.status}).`);
      }

      const answer = payload?.answer || payload?.data?.answer || payload?.result?.answer || payload?.message || "";
      const sources = payload?.sources || payload?.data?.sources || payload?.result?.sources || [];

      if (!answer) throw new Error("AI tidak mengirimkan jawaban.");

      const pendingIndex = messages.findIndex(item => item.id === pendingId);
      const answerMessage = {
        role: "assistant",
        content: answer,
        sources: normalizeSources(sources)
      };

      if (pendingIndex >= 0) messages.splice(pendingIndex, 1, answerMessage);
      else messages.push(answerMessage);

      saveMessages();
    } catch (error) {
      const isTimeout = error?.name === "AbortError" && requestController?.signal?.reason === "timeout";
      if (error?.name === "AbortError" && !isTimeout) return;

      const pendingIndex = messages.findIndex(item => item.id === pendingId);
      const errorMessage = {
        role: "assistant",
        content: isTimeout
          ? "Permintaan terlalu lama. Periksa koneksi internet lalu coba kirim kembali."
          : (error?.message || "Terjadi kesalahan saat menghubungi AI ASKEP."),
        error: true
      };

      if (pendingIndex >= 0) messages.splice(pendingIndex, 1, errorMessage);
      else messages.push(errorMessage);
      saveMessages();
    } finally {
      clearRequestTimer();
      requestController = null;
      pendingId = null;
      renderMessages();
      updateSendState();
      input.focus();
    }
  }

  function clearConversation() {
    if (requestController) requestController.abort();
    clearRequestTimer();
    requestController = null;
    messages = [];
    localStorage.removeItem(STORAGE_KEY);
    renderMessages();
    updateSendState();
    input.focus();
  }

  input.addEventListener("input", () => {
    autoResize();
    updateSendState();
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input.value);
    }
  });

  sendButton.addEventListener("click", () => sendMessage(input.value));

  clearButton.addEventListener("click", () => {
    if (!messages.length) return;
    if (window.confirm("Hapus seluruh percakapan AI ASKEP?")) clearConversation();
  });

  window.addEventListener("resize", updateViewportSpacing);
  window.visualViewport?.addEventListener("resize", updateViewportSpacing);

  loadMessages();
  renderMessages();
  autoResize();
  updateSendState();
})();
