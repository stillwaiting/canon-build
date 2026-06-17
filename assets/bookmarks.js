const I18N = window.I18N || {};
const t = (key) => I18N[key] || key;

const normalizeBackendBaseUrl = (value) => String(value || "").trim().replace(/\/+$/, "");
const getBackendBaseUrl = () => {
  try {
    const override = window.localStorage.getItem("BACKEND_BASE_URL");
    if (override && override.trim() !== "") {
      const normalizedOverride = normalizeBackendBaseUrl(override);
      console.log(
        "%cBACKEND_BASE_URL localStorage override active: " + normalizedOverride,
        "background:#ffe08a;color:#111;font-weight:bold;padding:4px 8px;border-radius:4px;"
      );
      return normalizedOverride;
    }
  } catch (error) {
    // Ignore storage access issues and use server-rendered config.
  }

  return normalizeBackendBaseUrl(window.FRONTEND_CONFIG?.BACKEND_BASE_URL);
};

const backendBaseUrl = getBackendBaseUrl();
const backendUrl = (path) => `${backendBaseUrl}${path}`;

const api = {
  session: backendUrl("/api.get.session.php"),
  bookmarks: backendUrl("/api.get.bookmarks.php"),
  bookmarkNote: backendUrl("/api.post.bookmark_note.php"),
  deleteBookmark: backendUrl("/api.delete.bookmark.php"),
};

const apiRequest = async (url, options = {}) => {
  const headers = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  const requestOptions = {
    method: options.method || "GET",
    credentials: "include",
    headers,
  };

  if (options.data !== undefined) {
    headers["Content-Type"] = "application/json";
    requestOptions.body = JSON.stringify(options.data);
  }

  const response = await fetch(url, requestOptions);
  const payload = await response.json().catch(() => null);
  if (!payload) {
    throw new Error(t("JS_LOAD_BOOKMARKS_FAILED"));
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || t("JS_LOAD_BOOKMARKS_FAILED"));
  }
  return payload;
};

const listEl = document.getElementById("bookmarksList");
const loadingEl = document.getElementById("bookmarksLoading");
const emptyEl = document.getElementById("bookmarksEmpty");

const setStatus = (state) => {
  if (!loadingEl || !emptyEl || !listEl) {
    return;
  }
  loadingEl.hidden = state !== "loading";
  emptyEl.hidden = state !== "empty";
  listEl.hidden = state !== "ready";
};

const setEmptyMessage = (text) => {
  if (emptyEl) {
    emptyEl.hidden = false;
    emptyEl.textContent = text;
  }
};

const clearEmptyMessage = () => {
  if (emptyEl) {
    emptyEl.hidden = true;
  }
};

const normalizeLink = (path) => {
  if (!path) {
    return "#";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  if (path.startsWith("/")) {
    return path;
  }
  return `/${path}`;
};

const autoResize = (textarea) => {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
};

const createRow = (bookmark) => {
  const row = document.createElement("div");
  row.className = "bookmarks-row";
  row.dataset.bookmarkId = bookmark.id;

  const titleCell = document.createElement("div");
  titleCell.className = "bookmarks-title-cell";
  const link = document.createElement("a");
  link.className = "bookmarks-link";
  link.href = normalizeLink(bookmark.absolutePath);
  link.textContent = bookmark.breadcrumbs || bookmark.absolutePath || t("JS_UNTITLED");
  titleCell.appendChild(link);

  const noteCell = document.createElement("div");
  noteCell.className = "bookmarks-note-cell";
  const note = document.createElement("textarea");
  note.className = "bookmarks-note";
  note.placeholder = t("JS_NOTE_PLACEHOLDER");
  note.value = bookmark.note || "";
  let savedNote = note.value.trim();
  const saveButton = document.createElement("button");
  saveButton.className = "bookmarks-save-note";
  saveButton.type = "button";
  saveButton.textContent = t("JS_SAVE_NOTE");
  saveButton.hidden = true;
  const syncSaveButton = () => {
    saveButton.hidden = note.value.trim() === savedNote;
  };
  const saveNote = async () => {
    saveButton.disabled = true;
    try {
      await apiRequest(api.bookmarkNote, {
        method: "POST",
        data: {
          id: bookmark.id,
          note: note.value.trim(),
        },
      });
      savedNote = note.value.trim();
      syncSaveButton();
      clearEmptyMessage();
    } catch (error) {
      setEmptyMessage(error?.message || t("JS_SAVE_NOTE_FAILED"));
    } finally {
      saveButton.disabled = false;
    }
  };
  note.addEventListener("input", () => {
    autoResize(note);
    syncSaveButton();
  });
  saveButton.addEventListener("click", saveNote);
  requestAnimationFrame(() => autoResize(note));
  noteCell.appendChild(note);
  noteCell.appendChild(saveButton);

  const actionsCell = document.createElement("div");
  actionsCell.className = "bookmarks-actions-cell";
  const removeButton = document.createElement("button");
  removeButton.className = "bookmarks-remove";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", t("JS_DELETE_BOOKMARK"));
  removeButton.textContent = "×";
  removeButton.addEventListener("click", async () => {
    try {
      await apiRequest(api.deleteBookmark, {
        method: "DELETE",
        data: { id: bookmark.id },
      });
      row.remove();
      if (listEl && listEl.children.length === 0) {
        setStatus("empty");
      }
    } catch (error) {
      setEmptyMessage(error?.message || t("JS_DELETE_BOOKMARK_FAILED"));
    }
  });
  actionsCell.appendChild(removeButton);

  row.appendChild(titleCell);
  row.appendChild(noteCell);
  row.appendChild(actionsCell);
  return row;
};

const loadBookmarks = async () => {
  if (!listEl) {
    return;
  }
  setStatus("loading");
  listEl.innerHTML = "";

  try {
    const payload = await apiRequest(api.bookmarks);
    if (!payload.bookmarks || payload.bookmarks.length === 0) {
      setStatus("empty");
      return;
    }
    payload.bookmarks.forEach((bookmark) => {
      listEl.appendChild(createRow(bookmark));
    });
    setStatus("ready");
  } catch (error) {
    setStatus("empty");
    setEmptyMessage(error?.message || t("JS_LOAD_BOOKMARKS_FAILED"));
  }
};

apiRequest(api.session)
  .then((payload) => {
    if (!payload.user) {
      setStatus("empty");
      setEmptyMessage(t("JS_LOGIN_TO_SEE_BOOKMARKS"));
      return;
    }
    loadBookmarks();
  })
  .catch((error) => {
    setStatus("empty");
    setEmptyMessage(error?.message || t("JS_LOGIN_TO_SEE_BOOKMARKS"));
  });
