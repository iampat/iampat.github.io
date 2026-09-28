#!/usr/bin/env bash
# Full render: checks, video, loudness pass, captions, contact sheet.
# Usage: tools/render.sh <ep1|ep2> [--draft]   (--draft = half resolution, faster)
set -euo pipefail
cd "$(dirname "$0")/.."
EP="${1:-ep1}"
O="out/$EP"
mkdir -p "$O"

node tools/lint-script.mjs "script/$EP/storyboard.json"
node tools/timeline.mjs --ep "$EP"
npx tsc --noEmit
npx vitest run --reporter=dot

if [[ "${2:-}" == "--draft" ]]; then
  npx remotion render src/index.ts "Kicks-$EP" "$O/kicks_draft.mp4" --scale=0.5 --concurrency=12 --gl=angle
  SRC="$O/kicks_draft.mp4"
  OUT="$O/kicks_draft_final.mp4"
else
  npx remotion render src/index.ts "Kicks-$EP" "$O/kicks.mp4" --codec=h264 --crf=18 --x264-preset=medium \
    --image-format=jpeg --jpeg-quality=95 --concurrency=12 --gl=angle --audio-codec=aac --audio-bitrate=192k
  SRC="$O/kicks.mp4"
  OUT="$O/kicks_final.mp4"
fi

# Loudness: two-pass loudnorm to about -14 LUFS integrated, true peak at or below -1.5 dBTP (YouTube).
M=$(ffmpeg -hide_banner -nostats -i "$SRC" -af loudnorm=I=-14:TP=-2.5:LRA=11:print_format=json -f null - 2>&1 | python3 -c "
import sys,json; t=sys.stdin.read(); j=json.loads(t[t.rindex('{'):t.rindex('}')+1]); print(f\"measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}:offset={j['target_offset']}\")")
ffmpeg -y -v error -i "$SRC" -c:v copy -af "loudnorm=I=-14:TP=-2.5:LRA=11:${M}:linear=true,alimiter=limit=0.75:level=false:attack=2:release=40" -c:a aac -b:a 192k -ar 48000 -movflags +faststart "$OUT"
ffmpeg -hide_banner -nostats -i "$OUT" -af ebur128=peak=true -f null - 2>&1 | grep -E "I:|Peak:" | tail -2

node tools/captions.mjs --ep "$EP" "$O/kicks.srt"

# Contact sheet: one frame every 10 s.
ffmpeg -y -v error -i "$OUT" -vf "fps=1/10,scale=480:-1,tile=6x7" -frames:v 1 "$O/contact-sheet.png"
echo "done: $OUT, $O/kicks.srt, $O/contact-sheet.png"
