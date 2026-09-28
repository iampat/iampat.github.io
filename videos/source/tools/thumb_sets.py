#!/usr/bin/env python3
"""Put the thumbnail sets on the Three Spins page.

Reads src/preview/thumb/sets/sets.json:
  [{"set": 1, "title": "The bend", "slots": [{"key": "A", "caption": "...", "words": "..."}, ...]}, ...]
For every set listed, copies out/thumb/publish/set{n}-{k}.png to the site as
videos/three-spins/thumbs/set{n}-{k}.jpg and rebuilds the <section id="thumbnail-sets">
on videos/three-spins/index.html (inserted before </main> the first time).

Usage: python3 tools/thumb_sets.py <site repo path>
"""
import html
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = sys.argv[1]
PAGE = os.path.join(SITE, "videos/three-spins/index.html")
THUMBS = os.path.join(SITE, "videos/three-spins/thumbs")

sets = json.load(open(os.path.join(ROOT, "src/preview/thumb/sets/sets.json")))
os.makedirs(THUMBS, exist_ok=True)

blocks = []
for st in sorted(sets, key=lambda s: s["set"]):
    n = st["set"]
    figs = []
    for sl in st["slots"]:
        k = sl["key"].lower()
        src = os.path.join(ROOT, f"out/thumb/publish/set{n}-{k}.png")
        dst = os.path.join(THUMBS, f"set{n}-{k}.jpg")
        im = Image.open(src).convert("RGB")
        assert im.size == (1280, 720), (src, im.size)
        im.save(dst, quality=88, optimize=True)
        cap = html.escape(sl["caption"])
        words = html.escape(sl.get("words", ""))
        figs.append(
            f'      <figure><a href="thumbs/set{n}-{k}.jpg"><img src="thumbs/set{n}-{k}.jpg" width="1280" height="720" loading="lazy" alt="Set {n} {sl["key"]}: {words}"></a>'
            f'<figcaption><b>{sl["key"]}.</b> {cap}</figcaption></figure>'
        )
    blocks.append(f'  <h3>Set {n}: {html.escape(st["title"])}</h3>\n    <div class="thumbs">\n' + "\n".join(figs) + "\n    </div>")

section = (
    '<section id="thumbnail-sets">\n'
    "  <h2>Thumbnail sets</h2>\n"
    '  <p class="small">Sets of three thumbnails for this video. Each set is made for YouTube\'s "Test &amp; Compare", '
    "which tries three thumbnails at once. Tap a picture to see it big.</p>\n"
    + "\n".join(blocks)
    + "\n</section>"
)

style = (
    "  #thumbnail-sets { margin-top: 32px; }\n"
    "  .thumbs { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin-bottom: 20px; }\n"
    "  .thumbs figure { margin: 0; }\n"
    "  .thumbs img { width: 100%; height: auto; border-radius: 8px; display: block; }\n"
    "  .thumbs figcaption { font-size: 0.95rem; color: #444; margin-top: 6px; }\n"
)

page = open(PAGE).read()
if "#thumbnail-sets {" not in page:
    page = page.replace("</style>", style + "</style>", 1)
if '<section id="thumbnail-sets">' in page:
    page = re.sub(r'<section id="thumbnail-sets">.*?</section>', lambda _: section, page, count=1, flags=re.S)
else:
    page = page.replace("</main>", section + "\n</main>", 1)
open(PAGE, "w").write(page)
print(f"{len(sets)} set(s) on the page")
