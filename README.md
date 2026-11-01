# BLAZE — Portfolio V1 (static, no build)
HTML5 · CSS3 · vanilla JS · Bootstrap 5.3.3 · Three.js r180 (import map, CDN). Footer scene, mascot GLB and holo card load lazily.

## Run locally
    python -m http.server 8000      # then open http://localhost:8000
(ES modules need http://, not file://.)

## Deploy
GitHub Pages: push this folder, enable Pages. Netlify: drag the folder in, no build command, publish dir `.`. All paths are relative.

## Still needs your input
- `landing-pages/dark-souls-holo-card.html` (original, unchanged). Until added, the card area shows an integration notice.
- Mascot: set `data-model="assets/models/mascot.glb"` on `#mascot` in index.html (loader in js/mascot.js).
- Verified links: repo URLs, project previews/tech for CraveRush, AI Directory, NGO, AnyFit, Café UI, Attendance; email, LinkedIn, phone; footer keys IG, @, X, CALL ME, DB, BH (edit `KEYS` in js/footer.js). G3 currently points to GitHub; change if that's wrong.
- Skill levels (core / practising / learning) are provisional: edit `data-level` in index.html.
- Certifications, achievements, About copy.
- Originals not copied in: DigitalRain.tsx, DarkSoulsHoloCard.tsx, threeui.css (card needs none of the CSS; the host styles are in main.css).
