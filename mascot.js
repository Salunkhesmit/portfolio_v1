// Loaded only when #mascot[data-model] is set. Fills the existing 4:5 slot; no hero layout change.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
export function mountMascot(slot, url, reduce) {
  slot.querySelector("span")?.remove();
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio, 2)); slot.appendChild(r.domElement);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 0.8, 0.1, 100); cam.position.set(0, 1, 6);
  scene.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  let model, mx = 0, vis = true;
  new GLTFLoader().load(url, (g) => { model = g.scene; const b = new THREE.Box3().setFromObject(model), c = b.getCenter(new THREE.Vector3()); model.position.sub(c); model.scale.setScalar(3 / b.getSize(new THREE.Vector3()).y); scene.add(model); });
  const fit = () => { const w = slot.clientWidth, h = slot.clientHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  new ResizeObserver(fit).observe(slot); fit();
  addEventListener("pointermove", (e) => (mx = e.clientX / innerWidth - 0.5));
  new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(slot);
  (function loop() { requestAnimationFrame(loop); if (!vis) return; if (model && !reduce) model.rotation.y += (mx * 0.8 - model.rotation.y) * 0.05; r.render(scene, cam); })();
}
