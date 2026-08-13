# 사주미

**나의 사주를, 조금 더 가까이.**

생년월일로 성격·기질·재능을 명리학으로 풀어 주는 웹 앱입니다.

👉 [saju-me-shy.vercel.app](https://saju-me-shy.vercel.app/)

## 소개

이름, 생년월일, 성별, 양력/음력을 입력하면 Gemini가 사주 명식(년·월·일·시주, 오행, 십신)을 세우고 해석을 작성합니다. 로그인 없이도 바로 볼 수 있고, Google로 로그인하면 전체 해석과 저장·공유를 사용할 수 있습니다.

## 기능

- **바로 보기** — 로그인 없이 이름·생년월일·성별·양력/음력으로 사주 해석
- **미리보기 잠금** — 비회원은 앞부분만 보고, Google 로그인 후 전체 해석
- **Google 로그인** — Supabase Auth (PKCE). 게스트로 본 결과는 로그인 후 계정에 저장
- **프로필** — 이름·생년월일·태어난 시간·성별·양력/음력을 한 번 저장하고 재사용
- **해석 보관** — 사이드바에서 이전 사주 조회, 다시 해석, 수정, 삭제
- **공유** — `/result/:id` 링크로 해석 공유 (Web Share / 클립보드)
- **반응형 UI** — 모바일·데스크톱

## 기술 스택

| 구분 | 사용 |
| --- | --- |
| 프론트엔드 | React 19, Vite 8 |
| 사주 해석 | Google Gemini (`gemini-3.6-flash`) |
| 백엔드 | Supabase (Auth, Postgres) |
| 배포 | Vercel |
| 분석 | Google Analytics |

## 시작하기

Node.js가 설치되어 있어야 합니다.

```bash
npm install
```

`.env.example`을 복사해 `.env`를 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

```
VITE_GEMINI_API_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

`VITE_` 접두사 변수는 브라우저 번들에 포함됩니다. **service_role 키는 넣지 마세요.**

개발 서버는 **5173** 포트에서 실행됩니다.

```bash
npm run dev
```

```bash
npm run build    # 프로덕션 빌드
npm run preview  # 빌드 결과 미리보기
npm run lint     # oxlint
```

### Google 로그인

Supabase 대시보드에서 Google OAuth를 켜고, Redirect URL에 로컬(`http://localhost:5173`)과 배포 도메인을 등록해야 합니다.

## 프로젝트 구조

```
src/
  App.jsx                 # 로그인 후 메인 레이아웃
  components/             # auth, layout, profile, result, saju, ui
  hooks/useSajuApp.js     # 인증·프로필·해석·공유 상태
  lib/gemini.js           # Gemini 사주 해석 요청
  lib/supabase.js         # Supabase 클라이언트
  lib/share.js            # 공유 URL·Web Share
  pages/SharedResultPage.jsx
```

주요 테이블은 `users`(프로필), `saju_readings`(해석)입니다. 공유 페이지는 `get_shared_reading` RPC로 결과를 읽습니다.

## 라이선스

Private / 개인 프로젝트
