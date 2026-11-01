// Interactive footer: glossy 3D keycaps, vent, cursor-reactive CRT radar. Three.js r180 (import map).
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// href null = non-functional placeholder until a verified destination is supplied.
const KEYS = [
  { t:"HOME", c:0, r:0, w:2, col:"#17171b", ink:"#fff", href:"#top" },
  { t:"G3", c:2, r:0, w:1, col:"#a9cdf2", ink:"#2b4a6b", href:"https://github.com/Salunkhesmit" },
  { t:"IG", c:3, r:0, w:1, col:"#e8457a", ink:"#fff", href:null },
  { t:"@", c:0, r:1, w:1, col:"#d9c19a", ink:"#5b4a2c", href:null },
  { t:"HIRE ME", c:1, r:1, w:2, col:"#17171b", ink:"#fff", href:"#contact" },
  { t:"X", c:3, r:1, w:1, col:"#17171b", ink:"#fff", href:null },
  { t:"CALL ME", c:0, r:2, w:2, col:"#17171b", ink:"#fff", href:null },
  { t:"DB", c:2, r:2, w:1, col:"#e59ae8", ink:"#7a2d80", href:null },
  { t:"BH", c:3, r:2, w:1, col:"#3b3bf0", ink:"#fff", href:null },
];

const CRT_FRAG = `
varying vec2 vUv; uniform float uT; uniform vec2 uM; uniform float uA;
void main(){
  vec2 p=vUv*2.-1.; float d=length(p); if(d>1.) discard;
  vec3 col=vec3(.02,.09,.03)*(1.-d*.5);
  vec2 g=abs(fract(p*5.)-.5); col+=vec3(.0,.35,.08)*smoothstep(.47,.5,max(g.x,g.y))*.35;
  float a=atan(p.y,p.x), sweep=mod(uA-a,6.2832);
  col+=vec3(.1,1.,.25)*exp(-sweep*2.2)*.55*smoothstep(1.,.2,d);
  col+=vec3(.15,1.,.3)*smoothstep(.012,.0,abs(d-.33))*.35+vec3(.15,1.,.3)*smoothstep(.012,.0,abs(d-.66))*.3;
  float m=length(p-uM); col+=vec3(.3,1.,.4)*(.025/(m+.02))*.9;
  col*=.9+.1*sin(vUv.y*220.+uT*3.);
  gl_FragColor=vec4(col,1.);
}`;

export function initFooter(root, reduce) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  root.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-3, 6, 8); scene.add(key);
  const cam = new THREE.OrthographicCamera(-8, 8, 3, -3, -50, 50); cam.position.z = 10;
  const world = new THREE.Group(); scene.add(world);

  let keys = [], crt, mode = "", mouse = new THREE.Vector2(), hover = null, press = null, running = true, aim = new THREE.Vector2(), sweep = 0;
  const ray = new THREE.Raycaster();

  const label = (t, ink) => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 128;
    const x = c.getContext("2d"); x.fillStyle = ink; x.font = "700 56px ui-sans-serif,system-ui,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(t, 128, 66);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; return tex;
  };
  const metal = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.7, roughness: 0.45 });

  function build(narrow) {
    world.clear(); keys = [];
    const W = narrow ? 8.4 : 16, H = narrow ? 9.6 : 5.6;
    cam.left = -W / 2; cam.right = W / 2; cam.top = H / 2; cam.bottom = -H / 2; cam.updateProjectionMatrix();
    const body = new THREE.Mesh(new RoundedBoxGeometry(W - 0.2, H - 0.2, 0.6, 4, 0.5), metal); body.position.z = -0.6; world.add(body);
    const u = 1.62, ox = narrow ? -2.4 : -7.2, oy = narrow ? 2.7 : 1.0;
    KEYS.forEach((k) => {
      const w = k.w * u - 0.14, g = new THREE.Group();
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, 1.38, 0.9, 5, 0.2),
        new THREE.MeshPhysicalMaterial({ color: k.col, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }));
      const l = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, 1.6), 0.8), new THREE.MeshBasicMaterial({ map: label(k.t, k.ink), transparent: true }));
      l.position.z = 0.46; g.add(m, l);
      g.position.set(ox + (k.c + k.w / 2) * u - u / 2, oy - k.r * 1.55, 0);
      g.userData = { k, base: g.position.z, mesh: m, push: 0 }; m.userData.group = g; world.add(g); keys.push(g);
    });
    if (!narrow) {
      const vm = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 });
      for (let i = 0; i < 12; i++) { const s = new THREE.Mesh(new RoundedBoxGeometry(4.5, 0.13, 0.2, 2, 0.06), vm); s.position.set(1.7, 1.75 - i * 0.32, -0.25); world.add(s); }
    }
    const R = narrow ? 1.9 : 2.0, cx = narrow ? 0 : 5.6, cy = narrow ? -2.9 : 0;
    const plate = new THREE.Mesh(new RoundedBoxGeometry(R * 2.5, R * 2.5, 0.2, 3, 0.15), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: 0.5, roughness: 0.5 }));
    plate.position.set(cx, cy, -0.25); world.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.08, 0.14, 16, 64), new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.6, roughness: 0.35 }));
    ring.position.set(cx, cy, 0.05); world.add(ring);
    crt = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), new THREE.ShaderMaterial({ fragmentShader: CRT_FRAG,
      vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      uniforms: { uT: { value: 0 }, uM: { value: new THREE.Vector2(9, 9) }, uA: { value: 0 } } }));
    crt.position.set(cx, cy, 0.02); crt.userData.R = R; world.add(crt);
    const sg = new THREE.CylinderGeometry(0.1, 0.12, 0.12, 12);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const s = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 1, roughness: 0.3 })); s.rotation.x = Math.PI / 2; s.position.set(cx + a * R * 1.1, cy + b * R * 1.1, 0.0); world.add(s); });
  }

  // Accessible mirror of the keys for keyboard / screen-reader users
  const nav = document.createElement("nav"); nav.className = "visually-hidden"; nav.setAttribute("aria-label", "Footer links");
  KEYS.forEach((k) => { const n = document.createElement(k.href ? "a" : "span"); n.textContent = k.t; if (k.href) n.href = k.href; else n.setAttribute("aria-disabled", "true"); nav.appendChild(n); });
  root.appendChild(nav);

  function resize() {
    const w = root.clientWidth, h = root.clientHeight, narrow = w / h < 1.2;
    renderer.setSize(w, h, false);
    if (mode !== (narrow ? "n" : "w")) { mode = narrow ? "n" : "w"; build(narrow); }
    draw();
  }
  function setPointer(e) {
    const r = renderer.domElement.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, cam);
    const hit = ray.intersectObjects(keys.map((g) => g.userData.mesh))[0];
    hover = hit ? hit.object.userData.group : null;
    renderer.domElement.style.cursor = hover && hover.userData.k.href ? "pointer" : "default";
    const p = ray.ray.origin; const c = crt.position, R = crt.userData.R;
    const dx = (p.x - c.x) / R, dy = (p.y - c.y) / R;
    if (Math.hypot(dx, dy) < 1.4) { crt.material.uniforms.uM.value.set(dx, dy); aim.set(dx, dy); } else crt.material.uniforms.uM.value.set(9, 9);
    if (reduce) draw();
  }
  const el = renderer.domElement;
  el.addEventListener("pointermove", setPointer);
  el.addEventListener("pointerleave", () => { hover = null; crt?.material.uniforms.uM.value.set(9, 9); });
  el.addEventListener("pointerdown", (e) => { setPointer(e); press = hover; if (reduce) draw(); });
  el.addEventListener("pointerup", () => {
    const k = press && press === hover ? press.userData.k : null; press = null;
    if (k?.href) k.href.startsWith("#") ? document.querySelector(k.href)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" }) : window.open(k.href, "_blank", "noopener");
    if (reduce) draw();
  });

  function draw(t = 0) {
    keys.forEach((g) => { const d = g.userData, target = press === g ? -0.28 : hover === g ? 0.08 : 0; d.push += reduce ? target - d.push : (target - d.push) * 0.25; g.position.z = d.push; });
    const u = crt.material.uniforms; u.uT.value = t / 1000;
    if (aim.lengthSq() > 0 && u.uM.value.x < 5) sweep = Math.atan2(aim.y, aim.x) + 0.0; else if (!reduce) sweep -= 0.03;
    u.uA.value = reduce ? 1.2 : (sweep + Math.PI * 2) % (Math.PI * 2);
    renderer.render(scene, cam);
  }
  new ResizeObserver(resize).observe(root);
  new IntersectionObserver(([e]) => { running = e.isIntersecting; }).observe(root);
  resize();
  if (!reduce) (function loop(t) { requestAnimationFrame(loop); if (running) draw(t); })(0);
}
