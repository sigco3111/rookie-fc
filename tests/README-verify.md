# 시험 하네스 (제품 번들 미포함)

제품 빌드(vite.config.js → docs/)에는 포함되지 않는 개발용 시험 도구다.

## 구성
- ../verify-main.tsx — 시험 전용 진입점(실제 App을 띄우고 합성 키 입력으로 완주). __TEST_HOOKS__ = true 빌드에서만 테스트 훅 활성.
- ../verify.html, ../vite.verify.config.js — 시험 빌드(산출물 verify-dist/, git 미추적).
- ../golden/*.json — 저장 회귀용 골든 저장 데이터 6종.
- vcase.mjs — 저장 회귀 러너: `node tests/vcase.mjs <case> [waitSec]` (golden 기반 케이스 + sdgbad/oldsave/unreadable).
- vt3i8.mjs — 태클 전환 시나리오 C2(전환만)/C3(전환 직후 새 시도) 고정조건 시험.
- vt3k.mjs — 겹친 경로(A 런지 중 L→B 즉시 J) 시험.
- vt3g.mjs — 태클 클린 경로(빗나감/스틸 플래시) 재실행.
- tab-lab.mjs — 탭 숨김·복귀 + 숨김 중 GL 손실/복구 상태전이. document.hidden 오버라이드로 앱 핸들러 층만 검증(실제 브라우저 탭 전환은 미검증). __mounts·__m 태그로 재마운트/엔진 인스턴스 동일성 판별.
- engtest.mjs — 엔진 순수 노드 시험(T1~T4). 사전 준비: `npx tsc src/engine.ts src/growth.ts --outDir /tmp/eng --module esnext --target es2020`. T2는 시드 고정 결정론(같은 시드=같은 결과 확인, 시드별 경기 결과는 다를 수 있음).

## 실행
1. `npx vite build --config vite.verify.config.js` → verify-dist/ 생성
2. `node tests/<script>.mjs` (headless chrome 필요; 게임 시간이 실시간보다 느리게 흐름에 유의)

주의: 시험은 조작 외 선수 고정·RNG 리깅 등 강제조건을 쓰며, 결과는 제품 정상 경로의 보증이 아니라 회귀 신호다.
