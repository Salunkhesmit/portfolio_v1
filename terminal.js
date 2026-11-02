const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const root = $("#terminal");
if (root) {
  const out = $("#tm-out"), form = $("#tm-form"), input = $("#tm-input"), view = $("#tm-view"), chips = $("#tm-chips");
  const CATS = ["frontend", "backend", "languages", "databases", "ai", "tools"];
  const hist = []; let hi = 0, busy = false, skip = false;

  const data = () => {
    const cats = {};
    $$("#skill-grid .sk").forEach((p) => (cats[p.dataset.cat] = { title: $("h3", p).textContent.trim(), items: $$("li:not(.placeholder)", p).map((l) => l.textContent.trim()) }));
    return { cats, projects: $$("#projects .proj").map((p) => ({ name: $("h3", p).textContent.trim(), desc: $(".proj-desc", p).textContent.trim() })),
      name: $(".navbar-brand").textContent.trim(), facts: $$(".facts li").map((li) => li.textContent.replace(/\s+/g, " ").trim()) };
  };
  const setView = (title, html, note = "") => { view.innerHTML = `<div class="tm-fade"><h4>${esc(title)}</h4>${note ? `<p>${esc(note)}</p>` : ""}${html}</div>`; };
  const badges = (a) => `<div class="tm-badges">${a.map((x) => `<span>${esc(x)}</span>`).join("")}</div>`;
  const rows = (a) => `<ul class="tm-rows">${a.join("")}</ul>`;

  async function print(lines, cls = "") {
    for (const t of lines) {
      const d = document.createElement("div"); d.className = "ln " + cls; out.appendChild(d);
      if (reduce || skip) d.textContent = t;
      else { for (let i = 0; i < t.length && !skip; i += 3) { d.textContent = t.slice(0, i + 3); out.scrollTop = out.scrollHeight; await sleep(10); } d.textContent = t; }
    }
    out.scrollTop = out.scrollHeight;
  }
  const cat = (k) => { const c = data().cats[k]; return {
    lines: c.items.length ? [c.title + ":", ...c.items.map((i) => "  - " + i)] : [c.title + ": nothing listed yet."],
    view: () => setView(c.title, c.items.length ? badges(c.items) : "", c.items.length ? "" : "Nothing listed yet.") }; };
  const CMDS = {
    help: () => { setView("Commands", rows(Object.entries(DESC).map(([k, v]) => `<li><button type="button" data-run="${k}">${k}<small>${v}</small></button></li>`))); return ["Available commands:", ...Object.entries(DESC).map(([k, v]) => `  ${k.padEnd(10)} ${v}`)]; },
    about: () => { const d = data(); setView("About", rows(d.facts.map((f) => `<li>${esc(f)}</li>`)), d.name); return [d.name, ...d.facts]; },
    whoami: () => CMDS.about(),
    skills: () => { const d = data(); setView("Skills", CATS.map((k) => `<p>${esc(d.cats[k].title)}</p>${d.cats[k].items.length ? badges(d.cats[k].items) : ""}`).join("")); return ["Categories: " + CATS.map((k) => d.cats[k].title).join(", "), "Type a category command (e.g. frontend) for details."]; },
    projects: () => { const d = data(); setView("Projects", rows(d.projects.map((p, i) => `<li><button type="button" data-proj="${i}">${esc(p.name)}<small>${esc(p.desc)}</small></button></li>`)), "Select one to open it."); return d.projects.map((p, i) => `${String(i + 1).padStart(2, "0")}  ${p.name}`); },
    clear: () => { out.innerHTML = ""; return null; },
  };
  const DESC = { help: "list commands", about: "about the developer", skills: "skill categories", frontend: "frontend stack", backend: "backend stack", languages: "programming languages", databases: "databases", ai: "AI & data libraries", tools: "tools & platforms", projects: "list projects", clear: "clear the terminal" };
  CATS.forEach((k) => (CMDS[k] = () => { const r = cat(k); r.view(); return r.lines; }));

  async function run(raw) {
    const cmd = raw.trim().toLowerCase(); if (!cmd || busy) return;
    busy = true; skip = false; hist.push(raw); hi = hist.length;
    const echo = document.createElement("div"); echo.className = "ln cmd"; echo.innerHTML = `<b>$</b> ${esc(raw)}`; out.appendChild(echo);
    const fn = CMDS[cmd];
    if (fn) { const lines = fn(); if (lines) await print(lines); }
    else await print([`command not found: ${raw}. Type 'help' for the list.`], "dim");
    out.scrollTop = out.scrollHeight; busy = false;
  }
  input.addEventListener("keydown", (e) => {
    if (busy) { skip = true; if (e.key === "Enter") e.preventDefault(); return; }
    if (e.key === "ArrowUp" && hist.length) { e.preventDefault(); hi = Math.max(0, hi - 1); input.value = hist[hi]; }
    else if (e.key === "ArrowDown") { e.preventDefault(); hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ""; }
    else if (e.key === "Tab") { e.preventDefault(); const m = Object.keys(CMDS).filter((k) => k.startsWith(input.value.toLowerCase())); if (m.length === 1) input.value = m[0]; }
    else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); CMDS.clear(); }
  });
  form.addEventListener("submit", (e) => { e.preventDefault(); const v = input.value; input.value = ""; run(v); });
  Object.keys(DESC).forEach((k) => { const b = document.createElement("button"); b.type = "button"; b.textContent = k; b.addEventListener("click", () => run(k)); chips.appendChild(b); });
  view.addEventListener("click", (e) => {
    const r = e.target.closest("[data-run]"), p = e.target.closest("[data-proj]");
    if (r) run(r.dataset.run); else if (p) dispatchEvent(new CustomEvent("showproj", { detail: +p.dataset.proj }));
  });
  if (matchMedia("(hover:hover) and (pointer:fine)").matches) $(".tm").addEventListener("click", () => { if (!getSelection().toString()) input.focus({ preventScroll: true }); });

  CMDS.about();
  new IntersectionObserver(async (es, o) => {
    if (!es[0].isIntersecting) return; o.disconnect(); busy = true;
    await print(["terminal ready.", "Type 'help' to list commands."], "dim"); busy = false;
  }, { threshold: 0.3 }).observe(root);
}
