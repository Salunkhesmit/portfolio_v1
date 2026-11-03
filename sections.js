const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Skills
const tabs = $$(".sk-tabs button"), groups = $$("#skill-grid .sk");
tabs.forEach((b) => b.addEventListener("click", () => {
  tabs.forEach((t) => t.setAttribute("aria-pressed", t === b));
  groups.forEach((g) => g.classList.toggle("dim", b.dataset.cat !== "all" && g.dataset.cat !== b.dataset.cat));
}));
$$("#skill-grid li").forEach((li) => li.addEventListener("click", () => {
  $$("#skill-grid li.on").forEach((x) => x !== li && x.classList.remove("on")); li.classList.toggle("on");
}));
document.addEventListener("click", (e) => { if (!e.target.closest("#skill-grid li")) $$("#skill-grid li.on").forEach((x) => x.classList.remove("on")); });

// Depth carousels (certificates + internships)
const info = $("#info");
const openInfo = (c) => {
  const img = $("#info-img", info);
  img.src = $("img", c).src; img.alt = c.dataset.title || "";
  $("#info-sub", info).textContent = c.dataset.sub || "";
  $("#info-title", info).textContent = c.dataset.title || "";
  $("#info-text", info).textContent = c.dataset.info || "";
  const a = $("#info-view", info);
  a.hidden = !c.dataset.link; a.href = c.dataset.link || "#"; a.textContent = (c.dataset.cta || "View document") + " ↗";
  info.showModal();
};
info.addEventListener("click", (e) => { if (e.target === info || e.target.closest(".info-x")) info.close(); });

$$(".depth-wrap").forEach((wrap) => {
  const stage = $(".depth", wrap), cards = $$(".cert", stage), prev = $(".dc-prev", wrap), next = $(".dc-next", wrap), count = $(".dc-count", wrap.parentElement);
  const auto = reduce ? 0 : +wrap.dataset.autoplay || 0;
  let i = 0, sx = null, swiped = false, timer = 0, paused = false, inView = false;

  const play = () => { clearInterval(timer); timer = auto && inView && !paused ? setInterval(() => { if (!info.open) go(i === cards.length - 1 ? 0 : i + 1); }, auto) : 0; };
  const go = (n) => { i = Math.max(0, Math.min(cards.length - 1, n)); layout(); play(); };
  function layout() {
    cards.forEach((c, k) => {
      const d = k - i, a = Math.abs(d), vis = a <= 2;
      c.style.transform = `translate(-50%,-50%) translateX(${d * 52}%) translateZ(${-a * 140}px) rotateY(${-d * 18}deg) scale(${1 - a * 0.1})`;
      c.style.opacity = vis ? 1 - a * 0.3 : 0; c.style.zIndex = 10 - a; c.style.pointerEvents = vis ? "auto" : "none";
      c.classList.toggle("active", d === 0); c.setAttribute("aria-hidden", d !== 0);
    });
    prev.disabled = i === 0; next.disabled = i === cards.length - 1;
    count.textContent = `${String(i + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
  }
  prev.onclick = () => go(i - 1); next.onclick = () => go(i + 1);
  cards.forEach((c, k) => c.addEventListener("click", () => {
    if (swiped) return;
    k !== i ? go(k) : openInfo(c);          // side card -> bring to front; front card -> open details
  }));
  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(i + 1); }
    else if (e.key === "Enter") { e.preventDefault(); openInfo(cards[i]); }
  });
  stage.addEventListener("pointerdown", (e) => (sx = e.clientX));
  stage.addEventListener("pointerup", (e) => {
    if (sx !== null && Math.abs(e.clientX - sx) > 40) { swiped = true; setTimeout(() => (swiped = false), 60); go(i + (e.clientX < sx ? 1 : -1)); }
    sx = null;
  });

  ["pointerenter", "focusin"].forEach((t) => wrap.addEventListener(t, () => { paused = true; play(); }));
  ["pointerleave", "focusout"].forEach((t) => wrap.addEventListener(t, () => { paused = false; play(); }));
  info.addEventListener("close", play);
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; play(); }).observe(wrap);
  layout();
});

// Project Screenshot Zoom / Lightbox
const projectZoom = $("#project-zoom"), projectZoomImg = $("#project-zoom-img"), projectZoomCaption = $("#project-zoom-caption"), projectZoomClose = $(".project-zoom-close");

if (projectZoom && projectZoomImg && projectZoomCaption && projectZoomClose) {
  $$("#projects .thumb.shot").forEach((button) => button.addEventListener("click", () => {
    const img = $("img", button); if (!img) return;
    projectZoomImg.src = img.currentSrc || img.src; projectZoomImg.alt = img.alt || "Enlarged project screenshot";
    projectZoomCaption.textContent = img.alt || ""; projectZoom.showModal();
  }));

  projectZoomClose.addEventListener("click", () => projectZoom.close());
  projectZoom.addEventListener("click", (e) => { if (e.target === projectZoom) projectZoom.close(); });
  projectZoom.addEventListener("close", () => { projectZoomImg.src = ""; projectZoomCaption.textContent = ""; });
}
