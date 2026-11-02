if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const c = Object.assign(document.createElement("canvas"), { id: "ambient" }); c.setAttribute("aria-hidden", "true"); document.body.append(c);
  const ctx = c.getContext("2d"); let w = 0, h = 0, live = [], raf = 0, last = 0;
  const size = () => { const d = Math.min(devicePixelRatio || 1, 1.5); w = innerWidth; h = innerHeight; c.width = w * d; c.height = h * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  size(); addEventListener("resize", size);
  const R = "229,35,50", rnd = (a, b) => a + Math.random() * (b - a);
  const kinds = [
    () => { const x = rnd(0.1, 0.9) * w, y = rnd(0.1, 0.8) * h, r = rnd(180, 320);
      return { in: 3.5, hold: 2, out: 5, max: 0.07, draw(a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${R},${a})`); g.addColorStop(1, `rgba(${R},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); } }; },
    () => { const p = Array.from({ length: Math.round(rnd(6, 10)) }, () => ({ x: rnd(0, w), y: rnd(0, h), vx: rnd(-6, 6), vy: rnd(-8, -2), r: rnd(1, 2.2) }));
      return { in: 3, hold: 3, out: 4, max: 0.35, draw(a, dt) { ctx.fillStyle = `rgba(${R},${a})`; p.forEach((q) => { q.x += q.vx * dt; q.y += q.vy * dt; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, 6.283); ctx.fill(); }); } }; },
    () => { const x = rnd(0.1, 0.9) * w, y = rnd(0.1, 0.9) * h, s = rnd(60, 140), sq = Math.random() < 0.5; let ro = rnd(0, 1.5);
      return { in: 3, hold: 2.5, out: 4, max: 0.14, draw(a, dt) { ctx.strokeStyle = `rgba(${R},${a})`; ctx.lineWidth = 1; ctx.save(); ctx.translate(x, y); ctx.rotate((ro += dt * 0.03));
        if (sq) ctx.strokeRect(-s / 2, -s / 2, s, s); else { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 6.283); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.moveTo(0, -s); ctx.lineTo(0, s); ctx.stroke(); }
        if (sq) ctx.stroke(); ctx.restore(); } }; },
  ];
  const level = (e) => (e.t < e.in ? e.t / e.in : e.t < e.in + e.hold ? 1 : Math.max(0, 1 - (e.t - e.in - e.hold) / e.out));
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now; ctx.clearRect(0, 0, w, h);
    live = live.filter((e) => (e.t += dt) < e.in + e.hold + e.out);
    live.forEach((e) => e.draw(level(e) * e.max, dt));
    raf = live.length ? requestAnimationFrame(loop) : 0;
  }
  (function spawn() {
    if (!document.hidden && live.length < 3) { live.push({ t: 0, ...kinds[Math.floor(Math.random() * kinds.length)]() }); if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
    setTimeout(spawn, rnd(3000, 6000));
  })();
}
