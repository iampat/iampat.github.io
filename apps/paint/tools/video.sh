#!/bin/bash
# video.sh <run dir> <out.mp4> [fps=30] [hold=3]
# Turns <run dir>/frames/*.png into an mp4 and writes poster.jpg beside it.
set -euo pipefail

if [[ $# -lt 2 ]]; then
    echo "Usage: video.sh <run_dir> <out.mp4> [fps=30] [hold=3]"
    exit 1
fi

run_dir="$1"
out_mp4="$2"
fps="${3:-30}"
hold="${4:-3}"
frames_dir="$run_dir/frames"

command -v ffmpeg >/dev/null || { echo "Error: ffmpeg not found"; exit 1; }
[[ -d "$frames_dir" ]] || { echo "Error: $frames_dir not found"; exit 1; }

shopt -s nullglob
frames=("$frames_dir"/*.png)
shopt -u nullglob
if [[ ${#frames[@]} -eq 0 ]]; then
    echo "Error: no frames found in $frames_dir"
    exit 1
fi
last_frame="${frames[${#frames[@]} - 1]}"

out_dir=$(dirname "$out_mp4")
mkdir -p "$out_dir"

# poster: the last frame as a jpeg
ffmpeg -y -loglevel error -i "$last_frame" "$out_dir/poster.jpg"

# the film: hold the last frame for `hold` seconds, even width and height for h264
ffmpeg -y -loglevel error -framerate "$fps" -pattern_type glob -i "$frames_dir/*.png" \
    -vf "tpad=stop_mode=clone:stop_duration=$hold,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -c:v libx264 -crf 23 -pix_fmt yuv420p -movflags +faststart \
    "$out_mp4"

duration=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$out_mp4" 2>/dev/null ||
    awk -v n="${#frames[@]}" -v f="$fps" -v h="$hold" 'BEGIN {print (n + h * f) / f}')
echo "${#frames[@]} frames at ${fps} fps + ${hold}s hold -> $out_mp4"
echo "Duration: ${duration}s, Size: $(du -h "$out_mp4" | cut -f1), poster: $out_dir/poster.jpg"
