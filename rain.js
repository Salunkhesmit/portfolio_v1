// Vanilla port of Originkit "ASCII Rain" (DigitalRain). Engine logic unchanged from the supplied TSX;
// only the React refs/effect are replaced by init + a returned destroy().
const DEFAULTS = { headColor:"#FFFFFF", trailColor:"#3FFF00", glyphSize:8, speed:16, angle:0, density:40, trail:28,
  glyphs:"ｱｲｳｴｵｶｷｸ0123456789ABCDEFｸｿﾝ", shuffle:true, shuffleGlyphs:"0123456789ABCDEF" };
// Tuning constants copied from the supplied TSX.
const CROSSING_SHARE = 0.35, MIN_BURNOUT = 0.75, MIN_RELEASE = 0.3, MAX_RELEASE = 0.8;

export function DigitalRain(wrap, props = {}) {
  const { headColor, trailColor, glyphSize, speed, angle, density, trail, glyphs, shuffle, shuffleGlyphs } = { ...DEFAULTS, ...props };
  wrap.style.position = "relative"; wrap.style.overflow = "hidden";
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "width:100%;height:100%;display:block";
  wrap.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => canvas.remove();

  const chars = [...(shuffle ? shuffleGlyphs || DEFAULTS.shuffleGlyphs : glyphs || DEFAULTS.glyphs)];
  const pick = () => chars[Math.floor(Math.random() * chars.length)];
  const rad = (angle * Math.PI) / 180;
  const rate = speed * glyphSize;
  const gap = glyphSize * (1 + (50 - density) / 12);
  const tailLength = Math.max(1, Math.round(trail));
  let alive = true, raf = 0, last = 0, w = 0, h = 0, span = 0, cols = 0, columns = [];

  const spawn = (y) => ({ y, rate: rate * (0.75 + Math.random() * 0.5),
    burnout: Math.random() < CROSSING_SHARE ? Infinity : MIN_BURNOUT + Math.random() * (1 - MIN_BURNOUT),
    alpha: 1, chars: Array.from({ length: tailLength }, pick) });
  const nextRelease = () => span * (MIN_RELEASE + Math.random() * (MAX_RELEASE - MIN_RELEASE));

  function layout() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    w = wrap.clientWidth || 360; h = wrap.clientHeight || 320;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    span = Math.hypot(w, h);
    cols = Math.max(1, Math.ceil(span / gap));
    columns = Array.from({ length: cols }, () => ({ streams: [spawn(Math.random() * span)], releaseAt: nextRelease() }));
  }
  function draw(dt) {
    ctx.clearRect(0, 0, w, h); ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(rad);
    ctx.font = `${glyphSize}px ui-monospace, Menlo, monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const lead = tailLength * glyphSize;
    for (let i = 0; i < cols; i++) {
      const column = columns[i], x = -span / 2 + i * gap + gap / 2;
      for (const s of column.streams) {
        s.y += s.rate * dt;
        if (s.burnout !== Infinity && s.y / span > s.burnout) s.alpha -= dt * 1.5;
        if (shuffle && Math.random() < 0.25) s.chars[Math.floor(Math.random() * s.chars.length)] = pick();
        const headY = -span / 2 + s.y, colA = Math.max(0, Math.min(1, s.alpha));
        for (let j = 0; j < tailLength; j++) {
          const y = headY - j * glyphSize;
          if (y < -span / 2 - glyphSize || y > span / 2 + glyphSize) continue;
          ctx.globalAlpha = colA * (j === 0 ? 1 : 1 - j / tailLength);
          ctx.fillStyle = j === 0 ? headColor : trailColor;
          ctx.fillText(s.chars[j], x, y);
        }
      }
      column.streams = column.streams.filter((s) => s.alpha > 0 && s.y - lead <= span);
      const newest = column.streams[column.streams.length - 1];
      if (!newest || newest.y >= column.releaseAt) { column.streams.push(spawn(-lead)); column.releaseAt = nextRelease(); }
    }
    ctx.globalAlpha = 1; ctx.restore();
  }
  function loop(t) {
    if (!alive) return;
    const dt = last ? Math.min((t - last) / 1000, 0.05) : 1 / 60; last = t; draw(dt); raf = requestAnimationFrame(loop);
  }
  layout();
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(layout) : null;
  ro?.observe(wrap);
  raf = requestAnimationFrame(loop);
  return () => { alive = false; cancelAnimationFrame(raf); ro?.disconnect(); canvas.remove(); };
}
