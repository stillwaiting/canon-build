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
  healthcheck: backendUrl("/api.get.healthcheck.php"),
  session: backendUrl("/api.get.session.php"),
  login: backendUrl("/api.post.login.php"),
  register: backendUrl("/api.post.register.php"),
  logout: backendUrl("/api.post.logout.php"),
  passwordReset: backendUrl("/api.post.password_reset.php"),
  bookmark: backendUrl("/api.get.bookmark.php"),
  saveBookmark: backendUrl("/api.post.bookmark.php"),
  deleteBookmark: backendUrl("/api.delete.bookmark.php"),
};

const apiRequest = async (url, options = {}) => {
  const method = options.method || "GET";
  const headers = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  };
  const requestOptions = {
    method,
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
    throw new Error(t("JS_AUTH_ERROR"));
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || t("JS_AUTH_ERROR"));
  }
  return payload;
};

const reportBackendHealth = async () => {
  try {
    const payload = await apiRequest(api.healthcheck);
    console.log(
      "%cBackend healthcheck OK",
      "background:#d1fae5;color:#064e3b;font-weight:bold;padding:4px 8px;border-radius:4px;",
      payload
    );
  } catch (error) {
    console.warn(
      "%cBackend healthcheck failed",
      "background:#fee2e2;color:#7f1d1d;font-weight:bold;padding:4px 8px;border-radius:4px;",
      error
    );
  }
};

const modal = document.getElementById("authModal");
if (!modal) {
  throw new Error("Missing auth modal container.");
}

const openButtons = document.querySelectorAll("[data-auth-open]");
const closeButtons = modal.querySelectorAll("[data-auth-close]");
const tabs = modal.querySelectorAll("[data-auth-tab]");
const panels = modal.querySelectorAll("[data-auth-panel]");
const formsWrap = modal.querySelector("[data-auth-forms]");
const message = modal.querySelector("[data-auth-message]");
const userWrap = modal.querySelector("[data-auth-user]");
const emailEl = modal.querySelector("[data-auth-email]");
const signOutButton = modal.querySelector("[data-auth-signout]");
const resetPasswordButtons = modal.querySelectorAll("[data-auth-reset-password]");
const bookmarkButtons = document.querySelectorAll("[data-auth-bookmark-save]");
const inlineSignoutButtons = document.querySelectorAll("[data-auth-signout-inline]");

let currentUser = null;
let pendingRedirect = null;
let currentBookmarkId = null;
let bookmarkRequestInFlight = false;

const localePrefix = window.location.pathname === "/en" || window.location.pathname.startsWith("/en/") ? "/en" : "";

const setMessage = (text, isSuccess = false) => {
  if (!message) {
    return;
  }
  message.textContent = text;
  message.classList.toggle("is-success", isSuccess);
};

const setModalOpen = (isOpen) => {
  modal.classList.toggle("is-open", isOpen);
  modal.setAttribute("aria-hidden", String(!isOpen));
};

const updateAuthButtons = () => {
  openButtons.forEach((button) => {
    button.textContent = currentUser ? t("JS_AUTH_LOGOUT") : t("JS_AUTH_LOGIN_REGISTER");
  });
  inlineSignoutButtons.forEach((button) => {
    button.textContent = currentUser ? t("SIGN_OUT_PROFILE") : t("LOGIN_REGISTER");
  });
};

const getBookmarkPath = () => `${window.location.pathname}${window.location.search}`;
const getBookmarksPagePath = () => `${localePrefix}/bookmarks.html`;

const setBookmarkState = (isBookmarked) => {
  bookmarkButtons.forEach((button) => {
    button.classList.toggle("is-bookmarked", isBookmarked);
  });
};

const setSignedIn = (user) => {
  currentUser = user;
  updateAuthButtons();
  if (!user) {
    setBookmarkState(false);
    currentBookmarkId = null;
  }
  if (!formsWrap || !userWrap || !emailEl) {
    return;
  }
  if (user) {
    formsWrap.setAttribute("hidden", "true");
    userWrap.removeAttribute("hidden");
    emailEl.textContent = user.email || t("JS_USER");
  } else {
    formsWrap.removeAttribute("hidden");
    userWrap.setAttribute("hidden", "true");
    emailEl.textContent = "";
  }
};

const maybeRedirectAfterAuth = () => {
  if (currentUser && pendingRedirect) {
    const target = pendingRedirect;
    pendingRedirect = null;
    window.location.href = target;
  }
};

const checkBookmarkState = async () => {
  if (bookmarkButtons.length === 0 || !currentUser) {
    setBookmarkState(false);
    currentBookmarkId = null;
    return;
  }

  try {
    const params = new URLSearchParams({ absolutePath: getBookmarkPath() });
    const payload = await apiRequest(`${api.bookmark}?${params.toString()}`);
    currentBookmarkId = payload.bookmark?.id || null;
    setBookmarkState(Boolean(payload.bookmark));
  } catch (error) {
    setMessage(error?.message || t("JS_CHECK_BOOKMARK_FAILED"));
  }
};

const logout = async () => {
  try {
    await apiRequest(api.logout, { method: "POST" });
    setSignedIn(null);
    setMessage(t("JS_SIGNED_OUT"), true);
  } catch (error) {
    setMessage(error?.message || t("JS_SIGN_OUT_FAILED"));
  }
};

const handleAuthButtonClick = async () => {
  if (currentUser) {
    await logout();
    return;
  }

  setModalOpen(true);
};

openButtons.forEach((button) => {
  button.addEventListener("click", handleAuthButtonClick);
});

inlineSignoutButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    if (!currentUser) {
      setModalOpen(true);
      return;
    }
    await logout();
  });
});

const toggleBookmark = async () => {
  if (!currentUser) {
    setModalOpen(true);
    return;
  }

  if (currentBookmarkId) {
    try {
      await apiRequest(api.deleteBookmark, {
        method: "DELETE",
        data: { id: currentBookmarkId },
      });
      currentBookmarkId = null;
      setBookmarkState(false);
      setMessage(t("JS_BOOKMARK_REMOVED"), true);
      window.showToast?.(t("JS_BOOKMARK_TOAST_REMOVED"));
    } catch (error) {
      setMessage(error?.message || t("JS_DELETE_BOOKMARK_FAILED"));
    }
    return;
  }

  const breadcrumbsList = document.querySelectorAll(".sutta-breadcrumbs");
  const breadcrumbs =
    breadcrumbsList.length > 1
      ? breadcrumbsList[1]?.textContent?.trim() || ""
      : breadcrumbsList[0]?.textContent?.trim() || "";

  try {
    const payload = await apiRequest(api.saveBookmark, {
      method: "POST",
      data: {
        breadcrumbs,
        absolutePath: getBookmarkPath(),
      },
    });
    currentBookmarkId = payload.bookmark?.id || null;
    setBookmarkState(true);
    setMessage(payload.created === false ? t("JS_BOOKMARK_EXISTS") : t("JS_BOOKMARK_SAVED"), true);
    if (payload.created !== false) {
      window.showToast?.(t("JS_BOOKMARK_TOAST_ADDED"));
    }
  } catch (error) {
    setMessage(error?.message || t("JS_BOOKMARK_SAVE_FAILED"));
  }
};

const handleBookmarksClick = async (trigger) => {
  if (currentUser) {
    if (trigger?.hasAttribute("data-auth-bookmark-save")) {
      await toggleBookmark();
      return;
    }
    if (trigger?.hasAttribute("data-auth-bookmarks-redirect")) {
      window.location.href = getBookmarksPagePath();
    }
    return;
  }

  pendingRedirect = trigger?.hasAttribute("data-auth-bookmarks-redirect") ? getBookmarksPagePath() : null;
  setModalOpen(true);
};

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }
  const trigger = target.closest("[data-auth-bookmarks]");
  if (!trigger) {
    return;
  }

  event.preventDefault();
  if (bookmarkRequestInFlight) {
    return;
  }

  bookmarkRequestInFlight = true;
  Promise.resolve(handleBookmarksClick(trigger)).finally(() => {
    bookmarkRequestInFlight = false;
  });
});

closeButtons.forEach((button) => {
  button.addEventListener("click", () => setModalOpen(false));
});

modal.addEventListener("click", (event) => {
  if (event.target instanceof HTMLElement && event.target.hasAttribute("data-auth-close")) {
    setModalOpen(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    setModalOpen(false);
  }
});

const setActiveTab = (name) => {
  tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.getAttribute("data-auth-tab") === name);
  });
  panels.forEach((panel) => {
    panel.classList.toggle("is-active", panel.getAttribute("data-auth-panel") === name);
  });
  setMessage("");
};

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const name = tab.getAttribute("data-auth-tab");
    if (name) {
      setActiveTab(name);
    }
  });
});

const handleForm = async (event, mode) => {
  event.preventDefault();

  const form = event.currentTarget;
  const email = form.querySelector('input[name="email"]')?.value?.trim() || "";
  const password = form.querySelector('input[name="password"]')?.value || "";
  if (!email || !password) {
    setMessage(t("JS_EMAIL_PASSWORD_REQUIRED"));
    return;
  }

  try {
    const payload = await apiRequest(mode === "register" ? api.register : api.login, {
      method: "POST",
      data: { email, password },
    });
    setSignedIn(payload.user);
    setMessage(mode === "register" ? t("JS_ACCOUNT_CREATED") : t("JS_SIGNED_IN"), true);
    maybeRedirectAfterAuth();
    if (!pendingRedirect) {
      setModalOpen(false);
    }
    await checkBookmarkState();
  } catch (error) {
    setMessage(error?.message || t("JS_AUTH_ERROR"));
  }
};

const handlePasswordReset = async (trigger) => {
  const form = trigger.closest("form");
  const emailInput = form?.querySelector('input[name="email"]');
  const email = emailInput?.value?.trim() || "";
  if (!email) {
    setMessage(t("JS_EMAIL_REQUIRED"));
    emailInput?.focus();
    return;
  }

  try {
    await apiRequest(api.passwordReset, {
      method: "POST",
      data: { email },
    });
    setMessage(t("JS_PASSWORD_RESET_SENT"), true);
  } catch (error) {
    setMessage(error?.message || t("JS_PASSWORD_RESET_FAILED"));
  }
};

panels.forEach((panel) => {
  const mode = panel.getAttribute("data-auth-panel");
  if (mode === "login" || mode === "register") {
    panel.addEventListener("submit", (event) => handleForm(event, mode));
  }
});

resetPasswordButtons.forEach((button) => {
  button.addEventListener("click", () => handlePasswordReset(button));
});

signOutButton?.addEventListener("click", logout);

reportBackendHealth();

apiRequest(api.session)
  .then((payload) => {
    setSignedIn(payload.user || null);
    if (payload.user) {
      checkBookmarkState();
    }
  })
  .catch((error) => {
    setSignedIn(null);
    setMessage(error?.message || t("JS_AUTH_ERROR"));
  });
