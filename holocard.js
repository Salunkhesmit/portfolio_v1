export function mountHoloCard(el, { src = "landing-pages/dark-souls-holo-card.html", title = "Dark Souls holographic card" } = {}) {
  el.classList.add("threeui-background", "dark-souls-holo-card");
  el.setAttribute("role", "group"); el.setAttribute("aria-label", title);
  let hostVisible = true, docVisible = !document.hidden, frame = null, ready = false;

  function make() {
    const f = document.createElement("iframe");
    f.title = title; f.src = src; f.setAttribute("sandbox", "allow-scripts"); f.loading = "eager";
    f.style.cssText = "position:absolute;inset:0;width:100%;height:100%;border:0;display:block;opacity:0;transition:opacity .6s ease";
    f.addEventListener("load", () => { ready = true; f.style.opacity = "1"; el.dataset.state = "ready"; });
    return f;
  }
  function sync() {
    const mounted = hostVisible && docVisible;
    if (mounted && !frame) { ready = false; frame = make(); el.appendChild(frame); }
    else if (!mounted && frame) { frame.remove(); frame = null; ready = false; }
    el.dataset.state = !mounted ? "paused" : ready ? "ready" : "loading";
  }
  const io = new IntersectionObserver(([e]) => { hostVisible = e.isIntersecting; sync(); }, { rootMargin: "80px" });
  const onVis = () => { docVisible = !document.hidden; sync(); };

  async function start() {
    // Integration point
    if (location.protocol !== "file:") {
      try { const r = await fetch(src, { method: "HEAD" }); if (!r.ok) throw 0; }
      catch { el.innerHTML = `<div class="holo-note"><p>Holographic card integration point ready.<br>Add <code>${src}</code> (original ThreeUI file, unchanged) to enable it.</p></div>`; return; }
    }
    io.observe(el); document.addEventListener("visibilitychange", onVis); sync();
  }
  start();
  return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); frame?.remove(); };
}
