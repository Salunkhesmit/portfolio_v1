// HUD, command palette, project modal, cursor-reactive details. No dependencies.
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const goTo = (sel) => $(sel)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });

// Scroll HUD (rAF-throttled; active section via IntersectionObserver)
const hud = Object.assign(document.createElement("div"), { id: "hud-bar", innerHTML: "<i></i>" });
const chip = Object.assign(document.createElement("div"), { id: "hud-chip" }); chip.setAttribute("aria-hidden", "true");
document.body.append(hud, chip);
let label = "HOME", ticking = false;
function paint() {
  ticking = false;
  const max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? Math.min(1, scrollY / max) : 0;
  hud.firstChild.style.transform = `scaleX(${p})`;
  chip.innerHTML = `<b>${label}</b> · ${String(Math.round(p * 100)).padStart(2, "0")}%`;
}
addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(paint); } }, { passive: true });
addEventListener("resize", paint);
const so = new IntersectionObserver((es) => es.forEach((e) => {
  if (!e.isIntersecting) return;
  const id = e.target.id; label = id === "hero" ? "HOME" : id.toUpperCase();
  $$(".nav-link").forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + id));
  paint();
}), { rootMargin: "-45% 0px -50% 0px" });
$$("main section[id], footer[id]").forEach((s) => so.observe(s));
paint();

// Project detail modal (built from the card's existing content)
const pd = document.createElement("dialog"); pd.id = "proj"; pd.setAttribute("aria-label", "Project details"); document.body.append(pd);
function openProj(card) {
  pd.innerHTML = `<button class="x" type="button" aria-label="Close">✕</button><div class="pd-body">${card.innerHTML}</div>`;
  $(".x", pd).onclick = () => pd.close(); pd.showModal();
}
pd.addEventListener("click", (e) => { if (e.target === pd) pd.close(); });
$$("#projects .card-x").forEach((c) => {
  c.dataset.proj = ""; c.tabIndex = 0; c.setAttribute("role", "button"); c.setAttribute("aria-haspopup", "dialog");
  c.addEventListener("click", (e) => { if (!e.target.closest("a")) openProj(c); });
  c.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === c) { e.preventDefault(); openProj(c); } });
});

// Command palette (Ctrl/Cmd + K)
const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
$$(".pal-open kbd").forEach((k) => (k.textContent = mac ? "⌘K" : "Ctrl K"));
const dlg = document.createElement("dialog"); dlg.id = "pal"; dlg.setAttribute("aria-label", "Command palette");
dlg.innerHTML = `<input type="text" placeholder="Type a command or search…" aria-label="Search commands" autocomplete="off"><ul role="listbox"></ul><p class="pal-empty" hidden>No matches. Try “projects” or “contact”.</p><p class="pal-hint">↑↓ navigate · Enter select · Esc close</p>`;
document.body.append(dlg);
const input = $("input", dlg), list = $("ul", dlg), empty = $(".pal-empty", dlg);
let sel = 0, shown = [];
function items() {
  const a = [["Home", "#top"], ["About", "#about"], ["Skills", "#skills"], ["Credentials", "#credentials"], ["Projects", "#projects"], ["Contact", "#contact"], ["Footer", "#footer"]].map(([t, h]) => ({ t: "Go to " + t, h, k: "Navigate" }));
  const gh = $(".btn-ghost[href^=http]"); if (gh) a.push({ t: "Open GitHub profile", h: gh.href, k: "Link", ext: 1 });
  $$("#projects article").forEach((art) => {
    const n = $("h3", art).textContent;
    a.push({ t: n + " — details", k: "Project", run: () => openProj($(".card-x", art)) });
    $$("a[href^=http]", art).forEach((l) => a.push({ t: `${n} — ${l.textContent.replace("↗", "").trim()}`, h: l.href, k: "Project", ext: 1 }));
  });
  return a;
}
function render() {
  const q = input.value.trim().toLowerCase(); sel = 0;
  shown = items().filter((i) => i.t.toLowerCase().includes(q));
  list.innerHTML = shown.map((i, n) => `<li role="option" data-n="${n}" aria-selected="${n === 0}"><span>${esc(i.t)}</span><em>${i.k}</em></li>`).join("");
  empty.hidden = shown.length > 0;
}
function mark(n) {
  if (!shown.length) return; sel = (n + shown.length) % shown.length;
  $$("li", list).forEach((li, i) => li.setAttribute("aria-selected", i === sel));
  $$("li", list)[sel].scrollIntoView({ block: "nearest" });
}
function run(i) {
  if (!i) return; dlg.close();
  if (i.run) i.run(); else if (i.ext) window.open(i.h, "_blank", "noopener"); else goTo(i.h);
}
function openPal() { if (document.body.classList.contains("locked")) return; input.value = ""; render(); dlg.showModal(); input.focus(); }
input.addEventListener("input", render);
input.addEventListener("keydown", (e) => {
  if (e.key === "ArrowDown") { e.preventDefault(); mark(sel + 1); }
  else if (e.key === "ArrowUp") { e.preventDefault(); mark(sel - 1); }
  else if (e.key === "Enter") { e.preventDefault(); run(shown[sel]); }
});
list.addEventListener("click", (e) => { const li = e.target.closest("li"); if (li) run(shown[+li.dataset.n]); });
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
$$(".pal-open").forEach((b) => b.addEventListener("click", openPal));
addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dlg.open ? dlg.close() : openPal(); }
});

// Cursor-reactive details (fine pointers only)
if (fine && !reduce) {
  const crt = $(".crt"); let near = false;
  if (crt) new IntersectionObserver(([e]) => (near = e.isIntersecting)).observe(crt);
  addEventListener("pointermove", (e) => {
    const c = e.target.closest?.(".card-x,.sys-panel");
    if (c) { const r = c.getBoundingClientRect(); c.style.setProperty("--mx", e.clientX - r.left + "px"); c.style.setProperty("--my", e.clientY - r.top + "px"); }
    if (near) {
      const r = crt.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const k = Math.min(1, (r.width / 2 - 16) / (Math.hypot(dx, dy) || 1));
      crt.style.setProperty("--bx", dx * k + "px"); crt.style.setProperty("--by", dy * k + "px");
    }
  }, { passive: true });
}

// Smooth cursor follower: eased in rAF (frame-rate independent), runs only while moving or settling.
if (fine && !reduce) {
  const cf = Object.assign(document.createElement("div"), { id: "cf" }); cf.setAttribute("aria-hidden", "true"); document.body.append(cf);
  const HOT = "a,button,[role=button],input,label,summary,.key:not(.off),li[role=option],.card-x[data-proj]";
  let tx = 0, ty = 0, x = 0, y = 0, s = 1, ts = 1, raf = 0, t0 = 0, seen = false;
  const tick = (t) => {
    const k = 1 - Math.exp(-((t - t0) / 1000) * 14); t0 = t;
    x += (tx - x) * k; y += (ty - y) * k; s += (ts - s) * Math.min(1, k * 1.4);
    cf.style.transform = `translate3d(${x}px,${y}px,0) scale(${s})`;
    raf = Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1 || Math.abs(ts - s) > 0.002 ? requestAnimationFrame(tick) : 0;
  };
  const kick = () => { if (!raf) { t0 = performance.now(); raf = requestAnimationFrame(tick); } };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    tx = e.clientX; ty = e.clientY; if (!seen) { seen = true; x = tx; y = ty; }
    cf.classList.add("on"); kick();
  }, { passive: true });
  document.addEventListener("pointerover", (e) => { const h = !!e.target.closest?.(HOT); cf.classList.toggle("hot", h); ts = h ? 1.5 : 1; kick(); });
  addEventListener("pointerdown", () => { ts = 0.75; kick(); });
  addEventListener("pointerup", () => { ts = cf.classList.contains("hot") ? 1.5 : 1; kick(); });
  document.addEventListener("pointerout", (e) => { if (!e.relatedTarget) cf.classList.remove("on"); });
}
