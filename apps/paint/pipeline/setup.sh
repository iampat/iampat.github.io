#!/bin/bash
# setup.sh [venv dir]
# Prepares the machine for paint.sh: a python venv with the tool requirements,
# the node modules for render.mjs, and a check of Chrome and ffmpeg.
# Safe to run again: it only does the missing parts.
set -euo pipefail

PIPELINE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
APP_DIR=$(dirname "$PIPELINE_DIR")
TOOLS_DIR="$APP_DIR/tools"
VENV="${1:-$APP_DIR/work/venv}"

ok=0
step() { echo; echo "== $*"; }
fail() { echo "   MISSING: $*"; ok=1; }

step "python venv  $VENV"
if [[ ! -x "$VENV/bin/python" ]]; then
    command -v python3 >/dev/null || { fail "python3 (install python 3.11 or newer)"; exit 1; }
    mkdir -p "$(dirname "$VENV")"
    python3 -m venv "$VENV"
    echo "   created"
else
    echo "   already there"
fi
"$VENV/bin/python" -m pip install --quiet --upgrade pip
"$VENV/bin/python" -m pip install --quiet -r "$TOOLS_DIR/requirements.txt"
"$VENV/bin/python" - <<'PY'
import cv2, numpy, skimage, PIL
print("   opencv %s, numpy %s, scikit-image %s, pillow %s" % (cv2.__version__, numpy.__version__, skimage.__version__, PIL.__version__))
PY

step "node modules  $TOOLS_DIR/node_modules"
if command -v node >/dev/null; then
    echo "   node $(node -v)"
else
    fail "node (install node 20 or newer)"
fi
if [[ -d "$TOOLS_DIR/node_modules/puppeteer-core" ]]; then
    echo "   already there"
elif command -v npm >/dev/null; then
    (cd "$TOOLS_DIR" && npm install --silent)
    echo "   installed"
else
    fail "npm"
fi

step "Chrome"
chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [[ -x "$chrome" ]]; then
    echo "   $("$chrome" --version 2>/dev/null || echo found)"
elif command -v google-chrome >/dev/null; then
    echo "   $(google-chrome --version)"
else
    fail "Google Chrome (render.mjs drives it through puppeteer-core, channel 'chrome')"
fi

step "ffmpeg"
if command -v ffmpeg >/dev/null; then
    echo "   $(ffmpeg -version | head -1)"
else
    fail "ffmpeg (brew install ffmpeg)"
fi

step "GEMINI_API_KEY"
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
    echo "   set"
else
    echo "   not set: paint.sh then needs --skip-target and a target image you supply"
fi

echo
if [[ $ok -eq 0 ]]; then
    echo "setup complete. Run one style:"
    echo "  $PIPELINE_DIR/paint.sh <image.jpg> <style> <workdir>"
    echo "  style is oil, watercolor, pencil, sketch or crayon"
    echo "  the first four paint a photo. crayon traces a finished crayon drawing."
    echo "  <workdir> is any folder under $APP_DIR/work; git ignores it"
    echo "  add --max-strokes 3000 for a quick look at the four painting styles."
    echo "     crayon needs far more: 18600 to reach the border ring, 21100 for"
    echo "     the whole picture. 3000 gives an unfinished drawing."
    echo "  --log <workdir>/run.log to run it in the background and tail the log"
else
    echo "setup incomplete: install the parts marked MISSING and run this again."
fi
exit $ok
