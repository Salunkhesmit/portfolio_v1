import { RESUME } from "./config.js";

const path = (RESUME.path || "").trim();
export const hasResume = path !== "";

const SOON_MESSAGE = "Resume coming soon. It will be available here shortly.";

let toast, toastTimer;
function announce(message) {
  if (!toast) {
    toast = document.createElement("p");
    toast.className = "toast-note";
    toast.setAttribute("role", "status");
    document.body.append(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3800);
}

export function useResume(kind) {
  if (!hasResume) {
    announce(SOON_MESSAGE);
    return false;
  }
  const url = new URL(path, document.baseURI).href;
  if (kind === "download") {
    const link = document.createElement("a");
    link.href = url;
    link.download = RESUME.downloadName || "";
    document.body.append(link);
    link.click();
    link.remove();
  } else {
    window.open(url, "_blank", "noopener");
  }
  return true;
}

document.querySelectorAll("[data-resume]").forEach((el) => {
  if (hasResume) el.href = path;
  else el.title = "Resume coming soon";
  el.addEventListener("click", (event) => {
    event.preventDefault();
    useResume(el.dataset.resume);
  });
});
