import "./ui.js";
import { DigitalRain } from "./rain.js";
const $ = (s) => document.querySelector(s);
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// 1. Intro
const intro = $("#intro");
function endIntro(stop) {
  intro.classList.add("out"); document.body.classList.remove("locked");
  setTimeout(() => { stop?.(); intro.remove(); }, 950);
}
if (reduce) { intro.remove(); document.body.classList.remove("locked"); }
else {
  const stop = DigitalRain($("#rain"), { headColor: "#FFFFFF", trailColor: "#3FFF00", glyphSize: 8, trail: 28, speed: 16, density: 40, shuffle: true, shuffleGlyphs: "0123456789ABCDEF" });
  const t = setTimeout(() => endIntro(stop), 4200);
  const skip = () => { clearTimeout(t); endIntro(stop); };
  $("#skip").addEventListener("click", skip);
  addEventListener("keydown", skip, { once: true });
}

// Scroll reveal
const rio = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); rio.unobserve(e.target); } }), { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((n) => rio.observe(n));

// Lazy: holo card
const holo = $("#holo");
const gated = matchMedia("(max-width:768px)").matches || navigator.connection?.saveData;
const loadHolo = async () => (await import("./holocard.js")).mountHoloCard(holo);
if (gated) {
  holo.innerHTML = `<div class="holo-note"><div>Heavy 3D card (13 MB)<br><button type="button">Load holographic card</button></div></div>`;
  holo.querySelector("button").addEventListener("click", () => { holo.innerHTML = ""; loadHolo(); }, { once: true });
} else new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); loadHolo(); } }, { rootMargin: "400px" }).observe(holo);

// Mascot integration point
const mascot = $("#mascot");
if (mascot.dataset.model) import("./mascot.js").then((m) => m.mountMascot(mascot, mascot.dataset.model, reduce));
