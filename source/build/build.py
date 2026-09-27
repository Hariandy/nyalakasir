#!/usr/bin/env python3
"""Build the release: concatenates src/*.css + src/*.js into a single self-contained index.html,
and emits manifest, service worker and icons into dist/. Usage: python3 build/build.py"""
import glob, json, os, re, hashlib, shutil
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DIST = os.path.join(ROOT, "src"), os.path.join(ROOT, "dist")
os.makedirs(DIST, exist_ok=True)
css = open(os.path.join(SRC, "styles.css"), encoding="utf-8").read()
js_parts = [open(f, encoding="utf-8").read() for f in sorted(glob.glob(os.path.join(SRC, "[0-9][0-9]-*.js")))]
js = "(function(){\n\"use strict\";\n" + "\n".join(js_parts) + "\n})();"
assert "</script" not in js.lower(), "script terminator inside JS"
ver = re.search(r'version:\s*"([^"]+)"', js).group(1)
name = re.search(r'name:\s*"([^"]+)"', js).group(1)
html = f"""<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-content">
<meta name="theme-color" content="#0e142d">
<meta name="description" content="{name} — aplikasi kasir (POS) mobile-first untuk UMKM: kasir cepat, HPP otomatis dari resep, stok, laporan laba. Bisa offline.">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Nyala">
<meta name="format-detection" content="telephone=no">
<meta name="referrer" content="no-referrer">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; font-src 'self' data:; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<title>{name} — Kasir UMKM</title>
<style>
{css}
</style>
</head>
<body>
<div id="app"><div class="boot">Memuat…</div></div>
<div id="print-root" aria-hidden="true"></div>
<noscript><p style="color:#fff;text-align:center;padding:40px">Aktifkan JavaScript untuk memakai {name}.</p></noscript>
<script>
{js}
</script>
</body>
</html>
"""
open(os.path.join(DIST, "index.html"), "w", encoding="utf-8").write(html)
import subprocess, tempfile
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf: tf.write(js)
subprocess.run(["node", "--check", tf.name], check=True)  # fail the build on syntax errors
digest = hashlib.sha256(html.encode()).hexdigest()[:10]
manifest = {
  "id": ".", "name": name, "short_name": "Nyala Kasir", "description": "Kasir UMKM mobile-first: HPP otomatis, stok, laporan laba. Bisa offline.",
  "lang": "id", "start_url": "./?source=pwa", "scope": "./", "display": "standalone", "display_override": ["standalone", "minimal-ui", "browser"],
  "orientation": "portrait", "prefer_related_applications": False,
  "background_color": "#0e142d", "theme_color": "#0e142d", "categories": ["business", "finance", "productivity"],
  "icons": [
    {"src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
    {"src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    {"src": "icons/maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
  "shortcuts": [{"name": "Laporan", "url": "./?tab=history", "icons": [{"src": "icons/icon-192.png", "sizes": "192x192"}]}]
}
open(os.path.join(DIST, "manifest.webmanifest"), "w").write(json.dumps(manifest, indent=1, ensure_ascii=False))
sw = open(os.path.join(SRC, "sw.template.js"), encoding="utf-8").read().replace("__VERSION__", f"{ver}-{digest}")
open(os.path.join(DIST, "sw.js"), "w").write(sw)
shutil.copytree(os.path.join(SRC, "icons"), os.path.join(DIST, "icons"), dirs_exist_ok=True)
for f in ["_headers", "netlify.toml", "vercel.json", "robots.txt", "404.html"]:
    p = os.path.join(SRC, "deploy", f)
    if os.path.exists(p): shutil.copy(p, os.path.join(DIST, f))
print("built", ver, digest, f"{len(html)/1024:.1f} KB")
