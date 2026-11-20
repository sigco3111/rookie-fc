# 루키나인 축구

구단 유스에서 선수를 키워 1군으로 승격하는 7대7 3D 축구 게임 (첫 플레이 버전, 시험용).
브라우저에서 실행되고 진행은 이 브라우저의 localStorage에 저장된다.

## 실행
    npm ci           # package-lock.json 기준 설치 (또는 npm install)
    npm run dev      # 개발
    npm run build    # docs/ 에 정적 파일 생성

## 에셋과 출처
- 경기 선수: Kenney Animated Characters Protagonists (CC0), https://kenney.nl
- 육성 화면 선수: Kenney Mini Characters (CC0, GLB 판), https://kenney.nl
  - 셔츠 색(초록, 보라 계열)은 화면에서 빨강으로 바꿔 그린다. 원본 파일은 수정하지 않는다.
  - 외형 4(female-a)는 팔 바깥 가는 막대 부분만 화면에서 숨긴다.
- 글꼴: Noto Sans KR (SIL OFL 1.1), 사용한 한글만 추린 부분집합 src/models/hud.woff. 새 한글 문구를 넣으면 다시 추려야 한다.
- 킥 동작: CMU Graphics Lab Motion Capture Database (free for all uses, 데이터 재판매 금지, 출처 표기 요청), http://mocap.cs.cmu.edu/
- 3D 엔진: three.js (MIT)
- 참고만 한 프로젝트: sigco3111/soccer-3d-ko (코드와 에셋은 사용하지 않음)

## 알려진 한계
- 시험 버전이다. 밸런스와 터치 성능, 실제 폰 화면은 확인되지 않았다.
- 1군 첫 시즌 이후의 시즌 이어하기, 이적, 재정은 없다.
