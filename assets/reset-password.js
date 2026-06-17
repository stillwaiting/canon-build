const page = document.getElementById("passwordResetPage");
const form = document.querySelector("[data-reset-form]");
const message = document.querySelector("[data-reset-message]");

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

const setMessage = (text, isSuccess = false) => {
  if (!message) {
    return;
  }
  message.textContent = text;
  message.classList.toggle("is-success", isSuccess);
};

const apiRequest = async (url, data) => {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(data),
  });
  const payload = await response.json().catch(() => null);
  if (!payload) {
    throw new Error(page?.dataset.error || "Failed to update password.");
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || page?.dataset.error || "Failed to update password.");
  }
  return payload;
};

const token = new URLSearchParams(window.location.search).get("token") || "";
if (!token) {
  setMessage(page?.dataset.tokenMissing || "Password reset token is missing.");
  form?.setAttribute("hidden", "true");
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = form.querySelector('input[name="password"]')?.value || "";

  try {
    await apiRequest(backendUrl("/api.post.password_update.php"), { token, password });
    setMessage(page?.dataset.success || "Password has been updated.", true);
    form.setAttribute("hidden", "true");
  } catch (error) {
    setMessage(error?.message || page?.dataset.error || "Failed to update password.");
  }
});
