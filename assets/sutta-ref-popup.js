const popup = document.getElementById("suttaRefPopup");
if (popup) {
  const indexEl = popup.querySelector("[data-sutta-ref-index]");
  const contentEl = popup.querySelector("[data-sutta-ref-content]");

  let lastTrigger = null;
  let savedBodyOverflow = "";

  const isOpen = () => popup.classList.contains("is-open");

  const openWith = (trigger) => {
    const href = trigger.getAttribute("href") || "";
    const targetId = href.startsWith("#") ? href.slice(1) : "";
    if (!targetId) return;
    const source = document.getElementById(targetId);
    if (!source) return;

    const clone = source.cloneNode(true);
    const backLink = clone.querySelector("a[href^='#']");
    if (indexEl) {
      indexEl.textContent = backLink ? backLink.textContent.trim() : trigger.textContent.trim();
    }
    if (backLink) backLink.remove();
    if (contentEl) contentEl.innerHTML = clone.innerHTML;

    if (!isOpen()) {
      lastTrigger = trigger;
      savedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      popup.classList.add("is-open");
      popup.setAttribute("aria-hidden", "false");
    }
  };

  const close = () => {
    if (!isOpen()) return;
    popup.classList.remove("is-open");
    popup.setAttribute("aria-hidden", "true");
    document.body.style.overflow = savedBodyOverflow;
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
    }
    lastTrigger = null;
  };

  document.addEventListener("click", (event) => {
    const ref = event.target.closest("a.sutta-ref");
    if (ref) {
      event.preventDefault();
      openWith(ref);
      return;
    }
    if (isOpen() && event.target.closest("[data-sutta-ref-close]")) {
      event.preventDefault();
      close();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isOpen()) close();
  });
}
