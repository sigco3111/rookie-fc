#!/bin/bash
# 라이브 11차(origin/main eebf390) 기준선 전수 회귀. 사용: ./run-regression.sh <결과디렉터리>
set -u
cd "$(dirname "$0")"
R="${1:-/downloads/regression-live11}"; mkdir -p "$R"
run() { n="$1"; shift; s=$(date +%s); timeout 100 "$@" > "$R/$n.log" 2>&1; echo "$n exit=$? $(($(date +%s)-s))s"; pkill -f 'remote-debugging-port=92' 2>/dev/null; }
run flow-check node tests/flow-check.mjs
run flow-f6 node tests/flow-f6.mjs
run flow-shots node tests/flow-shots.mjs
for gi in eval homeyhist leagueend leaguemid pro2 result; do run "vcase-golden-$gi" node tests/vcase.mjs "case=golden&gi=$gi" 12; done
for c in corruptsave corruptjson sdgbad oldsave unreadable importfail importraw importwritefail badimport resetfail writefail; do run "vcase-$c" node tests/vcase.mjs "case=$c" 12; done
run vt3g node tests/vt3g.mjs
run vt3i8 node tests/vt3i8.mjs
run vt3k node tests/vt3k.mjs
run gk-lab node tests/gk-lab.mjs
run header-lab node tests/header-lab.mjs
run gl-lab node tests/gl-lab.mjs
run load-fail-lab node tests/load-fail-lab.mjs
run look-lab node tests/look-lab.mjs
run ui-check node tests/ui-check.mjs
run clock-lab node tests/clock-lab.mjs
run engtest node /tmp/engtest.mjs
run flashcheck env VROOT=/downloads/rs-web-live11/verify-dist/ node /tmp/flashcheck2.mjs
echo ALL-DONE
