(() => {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
    try {
      tg.setHeaderColor("#0a1638");
      tg.setBackgroundColor("#0a1638");
    } catch (_) {
      /* older clients */
    }
  }

  const apiBase = (window.SAVER_API_BASE || "").replace(/\/$/, "");
  const el = {
    title: document.getElementById("title"),
    back: document.getElementById("btn-back"),
    viewChats: document.getElementById("view-chats"),
    viewMessages: document.getElementById("view-messages"),
    chatList: document.getElementById("chat-list"),
    messageList: document.getElementById("message-list"),
    chatsEmpty: document.getElementById("chats-empty"),
    messagesEmpty: document.getElementById("messages-empty"),
    error: document.getElementById("error"),
  };

  let currentChat = null;

  function initData() {
    return tg?.initData || "";
  }

  function showError(text) {
    el.error.textContent = text;
    el.error.classList.toggle("hidden", !text);
  }

  async function api(path) {
    const url = `${apiBase}${path}`;
    const headers = { "X-Telegram-Init-Data": initData() };
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  function formatTs(ts) {
    if (!ts) return "";
    const d = new Date(Number(ts) * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function initials(label) {
    const parts = String(label || "?").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function typeLabel(type) {
    const map = {
      text: "текст",
      photo: "фото",
      video: "видео",
      voice: "голосовое",
      video_note: "кружок",
      document: "файл",
      audio: "аудио",
      sticker: "стикер",
      animation: "gif",
      contact: "контакт",
      location: "гео",
      venue: "место",
      poll: "опрос",
      dice: "кубик",
    };
    return map[type] || type || "сообщение";
  }

  function showChats() {
    currentChat = null;
    el.title.textContent = "Ваши чаты";
    el.back.classList.add("hidden");
    el.viewChats.classList.remove("hidden");
    el.viewMessages.classList.add("hidden");
  }

  function showMessages(chat) {
    currentChat = chat;
    el.title.textContent = chat.chat_label || String(chat.chat_id);
    el.back.classList.remove("hidden");
    el.viewChats.classList.add("hidden");
    el.viewMessages.classList.remove("hidden");
  }

  function renderChats(chats) {
    el.chatList.innerHTML = "";
    el.chatsEmpty.classList.toggle("hidden", chats.length > 0);
    for (const chat of chats) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chat-row";
      btn.innerHTML = `
        <span class="avatar">${escapeHtml(initials(chat.chat_label))}</span>
        <span class="chat-meta">
          <span class="chat-name">${escapeHtml(chat.chat_label || chat.chat_id)}</span>
          <span class="chat-sub">${chat.deleted_count} удал. · ${escapeHtml(formatTs(chat.last_deleted_at))}</span>
        </span>
      `;
      btn.addEventListener("click", () => openChat(chat));
      li.appendChild(btn);
      el.chatList.appendChild(li);
    }
  }

  function mediaUrl(fileId) {
    const q = new URLSearchParams({ file_id: fileId });
    return `${apiBase}/api/file?${q.toString()}`;
  }

  async function fetchMediaBlob(fileId) {
    const res = await fetch(mediaUrl(fileId), {
      headers: { "X-Telegram-Init-Data": initData() },
    });
    if (!res.ok) throw new Error("media");
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function senderLine(m) {
    const parts = [];
    if (m.from_name) parts.push(m.from_name);
    if (m.from_username) parts.push(m.from_username.startsWith("@") ? m.from_username : `@${m.from_username}`);
    if (m.from_user_id) parts.push(String(m.from_user_id));
    return parts.join(", ") || "неизвестно";
  }

  async function renderMessages(payload) {
    el.messageList.innerHTML = "";
    const messages = payload.messages || [];
    el.messagesEmpty.classList.toggle("hidden", messages.length > 0);

    for (const m of messages) {
      const li = document.createElement("li");
      li.className = "message-card";
      const quote = m.body && !String(m.body).startsWith("[") ? m.body : "";
      li.innerHTML = `
        <div class="msg-head">
          <span>${escapeHtml(senderLine(m))}</span>
          <span class="msg-type">${escapeHtml(typeLabel(m.content_type))}</span>
        </div>
        <div class="msg-head">
          <span>${escapeHtml(formatTs(m.deleted_at || m.msg_date))}</span>
        </div>
        ${quote ? `<blockquote class="msg-quote">${escapeHtml(quote)}</blockquote>` : ""}
        <div class="media-slot"></div>
      `;
      el.messageList.appendChild(li);

      const slot = li.querySelector(".media-slot");
      if (m.file_id && m.has_media) {
        try {
          const url = await fetchMediaBlob(m.file_id);
          const type = m.content_type;
          if (type === "photo" || type === "sticker" || type === "animation") {
            const img = document.createElement("img");
            img.className = "msg-media";
            img.alt = type;
            img.src = url;
            slot.appendChild(img);
          } else if (type === "video" || type === "video_note") {
            const video = document.createElement("video");
            video.className = "msg-media";
            video.controls = true;
            video.src = url;
            slot.appendChild(video);
          } else if (type === "voice" || type === "audio") {
            const audio = document.createElement("audio");
            audio.className = `msg-media ${type}`;
            audio.controls = true;
            audio.src = url;
            slot.appendChild(audio);
          } else if (type === "document") {
            const a = document.createElement("a");
            a.href = url;
            a.download = (m.media_extra && m.media_extra.file_name) || "file";
            a.textContent = "Скачать файл";
            a.className = "media-fallback";
            slot.appendChild(a);
          } else {
            const p = document.createElement("p");
            p.className = "media-fallback";
            p.textContent = `Медиа: ${type}`;
            slot.appendChild(p);
          }
        } catch (_) {
          const p = document.createElement("p");
          p.className = "media-fallback";
          p.textContent = "Не удалось загрузить медиа";
          slot.appendChild(p);
        }
      }
    }
  }

  async function loadChats() {
    showError("");
    showChats();
    try {
      const data = await api("/api/chats");
      renderChats(data.chats || []);
    } catch (e) {
      showError(
        `Не удалось загрузить чаты: ${e.message}. ` +
          (apiBase
            ? "Проверьте API_PUBLIC_URL / туннель и config.js."
            : "На GitHub Pages укажите SAVER_API_BASE в config.js (см. MINIAPP.md).")
      );
    }
  }

  async function openChat(chat) {
    showError("");
    showMessages(chat);
    try {
      const data = await api(`/api/chats/${chat.chat_id}`);
      await renderMessages(data);
    } catch (e) {
      showError(`Не удалось открыть чат: ${e.message}`);
    }
  }

  el.back.addEventListener("click", () => loadChats());

  if (!initData() && !apiBase) {
    showError(
      "Откройте мини-приложение из Telegram (кнопка «Ваши чаты»). " +
        "Локально: python run.py и откройте http://127.0.0.1:8080/ — для API нужна сессия Telegram."
    );
  }

  loadChats();
})();
