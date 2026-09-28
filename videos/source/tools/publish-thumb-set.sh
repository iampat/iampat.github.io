#!/usr/bin/env bash
# Publish thumbnail set N on the Three Spins page: branch, images + page section, PR, merge,
# wait for GitHub Pages, check the live page.
# Usage: tools/publish-thumb-set.sh <N> "<set title>"
set -euo pipefail
cd "$(dirname "$0")/.."
N="$1"; TITLE="$2"
SITE=~/workspace/iampat/iampat.github.io
# The slots of set N that are ready (from out/thumb/publish/sets.json).
SLOTS=$(python3 -c "import json,sys; d=json.load(open('out/thumb/publish/sets.json')); s=[x for x in d if x['set']==$N][0]; print(' '.join(x['key'] for x in s['slots']))")
COUNT=$(echo $SLOTS | wc -w | tr -d ' ')
FILES=$(for k in $SLOTS; do printf -- "- \\\`thumbs/set$N-%s.jpg\\\`\n" "$(echo $k | tr A-Z a-z)"; done)
cd "$SITE"
git fetch -q origin
BR="claude/three-spins-thumb-set-$N-$(date +%H%M%S)"
git checkout -q -B "$BR" origin/master
python3 "$OLDPWD/tools/thumb_sets.py" "$SITE"
git add videos/three-spins/thumbs videos/three-spins/index.html
git commit -q -F - <<EOF
Three Spins page: thumbnail set $N ($TITLE)

Adds or updates thumbnail set $N of 5 ("$TITLE") in the "Thumbnail sets"
section: $COUNT thumbnail(s) ready ($SLOTS), 1280x720, drawn in code, made to be
tested together with YouTube's Test & Compare.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UobyK5EcybPiCyoGMgCbjq
EOF
git push -q -u origin "$BR" 2>&1 | grep -v "^remote:" || true
PR=$(gh pr create --base master --head "$BR" --title "Three Spins page: thumbnail set $N ($TITLE)" --body "$(cat <<EOF
Adds or updates thumbnail set $N of 5 ("$TITLE") in the "Thumbnail sets" section of \`videos/three-spins/\`: $COUNT of 3 thumbnails ready ($SLOTS), 1280x720.

$FILES

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
curl -s "https://iampat.github.io/videos/three-spins/?v=$N$RANDOM" | grep -o "Set $N: [^<]*" | head -1
for k in $SLOTS; do k=$(echo $k | tr A-Z a-z); curl -s -o /dev/null -w "set$N-$k %{http_code}\n" "https://iampat.github.io/videos/three-spins/thumbs/set$N-$k.jpg"; done
echo "LIVE: https://iampat.github.io/videos/three-spins/#thumbnail-sets"
