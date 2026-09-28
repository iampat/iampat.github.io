#!/usr/bin/env bash
# Publish a finished episode to the iampat.github.io site: a simple page with the video,
# captions and a poster, linked from the home page, on a branch, as a merged PR.
#
# Usage: tools/publish.sh <ep> <slug> "<Title>" <poster-seconds> "<home page link text>"
# Example: tools/publish.sh ep2 why-slow "Why the Best Players Look Slow" 44.5 "Why the Best Players Look Slow: football is a game of time (video)"
set -euo pipefail
cd "$(dirname "$0")/.."
EP="$1"; SLUG="$2"; TITLE="$3"; POSTER_S="$4"; LINK_TEXT="$5"
SITE=~/workspace/iampat/iampat.github.io
SRC="out/$EP/kicks_final.mp4"
[ -f "$SRC" ] || { echo "missing $SRC"; exit 1; }
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$SRC")
MMSS=$(python3 -c "d=float('$DUR'); print(f'{int(d//60)}:{int(d%60):02d}')")

# Web encode under 50 MB (GitHub warns above 50 MB and rejects above 100 MB): two-pass 1080p.
WEB="out/$EP/kicks_web1080.mp4"
if [ ! -f "$WEB" ]; then
  ffmpeg -y -v error -i "$SRC" -c:v libx264 -preset slow -b:v 900k -maxrate 2500k -bufsize 5000k -pass 1 -passlogfile "/tmp/claude-x264-$EP" -an -f mp4 /dev/null
  ffmpeg -y -v error -i "$SRC" -c:v libx264 -preset slow -b:v 900k -maxrate 2500k -bufsize 5000k -pass 2 -passlogfile "/tmp/claude-x264-$EP" -c:a aac -b:a 128k -movflags +faststart "$WEB"
fi
SIZE=$(du -m "$WEB" | cut -f1)
[ "$SIZE" -lt 50 ] || { echo "web encode is ${SIZE} MB, over the 50 MB limit"; exit 1; }

cd "$SITE"
git fetch -q origin
git checkout -q -B "claude/$SLUG" origin/master
mkdir -p "videos/$SLUG"
cp "$OLDPWD/$WEB" "videos/$SLUG/$SLUG.mp4"
ffmpeg -y -v error -ss "$POSTER_S" -i "$OLDPWD/$SRC" -frames:v 1 -vf scale=1280:-2 -q:v 3 "videos/$SLUG/poster.jpg"
python3 - "$OLDPWD/out/$EP/kicks.srt" "videos/$SLUG/captions.vtt" <<'EOF'
import re,sys
srt=open(sys.argv[1]).read().strip()
open(sys.argv[2],'w').write("WEBVTT\n\n"+re.sub(r'(\d\d:\d\d:\d\d),(\d\d\d)', r'\1.\2', srt)+"\n")
EOF
cat > "videos/$SLUG/index.html" <<EOF
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>$TITLE</title>
<style>
  body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; }
  video { width: 100%; max-width: 960px; height: auto; }
</style>
</head>
<body>
<h1>$TITLE</h1>
<video controls playsinline preload="metadata" poster="poster.jpg">
  <source src="$SLUG.mp4" type="video/mp4">
  <track kind="captions" src="captions.vtt" srclang="en" label="English">
</video>
<p><a href="$SLUG.mp4">Open the video file</a> ($MMSS, 1080p)</p>
</body>
</html>
EOF
# Home page link (inserted before the closing </ul>, once).
python3 - "$SLUG" "$LINK_TEXT" <<'EOF'
import sys
slug, text = sys.argv[1], sys.argv[2]
p='index.html'; s=open(p).read()
line=f'    <li><a href="videos/{slug}/">{text}</a></li>\n'
if f'videos/{slug}/' not in s:
    s=s.replace('  </ul>', line+'  </ul>', 1)
    open(p,'w').write(s)
EOF
git add "videos/$SLUG" index.html
git commit -q -F - <<EOF
Add the "$TITLE" video page

A simple page with the $MMSS explainer video (1080p, ${SIZE} MB), English
captions and a poster frame, linked from the home page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UobyK5EcybPiCyoGMgCbjq
EOF
git push -q -u origin "claude/$SLUG"
PR=$(gh pr create --base master --head "claude/$SLUG" --title "Add the \"$TITLE\" video page" --body "$(cat <<EOF
Adds a simple page at \`videos/$SLUG/\` with the video, and a link to it from the home page.

- \`$SLUG.mp4\`: $MMSS, 1080p, ${SIZE} MB
- \`captions.vtt\`: English captions
- \`poster.jpg\`: poster frame

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01UobyK5EcybPiCyoGMgCbjq
EOF
)")
echo "PR: $PR"
gh pr merge "$PR" --merge
SHA=$(gh pr view "$PR" --json mergeCommit --jq .mergeCommit.oid)
for i in $(seq 1 60); do
  r=$(gh api repos/iampat/iampat.github.io/pages/builds/latest --jq '.status + " " + .commit' 2>/dev/null || true)
  case "$r" in built\ $SHA*) echo "Pages built"; break;; errored*) echo "Pages build error: $r"; exit 1;; esac
  sleep 10
done
git checkout -q master && git pull -q --ff-only
URL="https://iampat.github.io/videos/$SLUG/"
curl -s -o /dev/null -w "page %{http_code}\n" "$URL"
curl -sI "https://iampat.github.io/videos/$SLUG/$SLUG.mp4" | grep -iE "^HTTP|content-length"
echo "LIVE: $URL"
