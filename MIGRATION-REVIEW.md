# 새 주소 유지 이전 검토 · 2026-10-27

## 요구

GitHub 조직 `sai-story-studio`에 전체 소스를 보관하고 `https://sai-story-studio.github.io`를 유지하면서 기존 디자인·페이지·신청·운영자 기능을 보존합니다. 기존 운영 사이트로 자동 이동하는 임시 방식을 사용자는 선택하지 않았습니다.

## 현재 코드의 제약

1. Pages는 정적 호스팅이며 이 프로젝트의 서버 API와 D1 DB를 실행하지 않습니다.
2. 메인·모임 신청·운영자 페이지는 동일 출처의 `/api/...`를 `credentials: 'same-origin'`으로 호출합니다.
3. `lib/service.ts`는 외부 출처의 저장/삭제 요청을 거절합니다. API 주소만 치환하거나 이 보안 검사를 제거하면 안 됩니다.
4. `app/chatgpt-auth.ts`는 Sites에서 검증하여 주입하는 사용자 헤더에 의존합니다. Pages에는 인증 서버가 없으며 브라우저에서 그 신원을 보내도록 바꾸면 위조가 되므로 금지합니다.
5. 루트 진입점은 `app/page.tsx`의 서버 리디렉션입니다. `public/` 복사만으로 루트 진입과 확장자 없는 기존 경로도 자동 복원되지 않습니다.

## 같은 github.io 주소를 유지하려면

- Pages가 공개 UI·계산·이미지·폰트·로컬 PDF를 담당합니다.
- 별도 API/DB를 구성하고 허용 출처를 정확한 Pages 주소로 한정해야 합니다.
- 관리자 로그인은 새 서버에서 검증 가능한 정식 인증, 세션, CSRF 보호, 로그인 후 복귀 흐름이 필요합니다.
- 제3자 쿠키가 차단되는 브라우저도 있으므로 쿠키 설정 한 줄로 해결됐다고 가정하면 안 됩니다.
- 신청·동의 저장, 중복 제출, 권한 구분, CSV/삭제, 운영자 등록/해제와 발송 준비 상태를 새 환경에서 검증해야 합니다.
- 실제 개인정보와 비밀은 GitHub가 아닌 승인된 서버 간 이전 경로를 사용해야 합니다. 새 서비스 연결·개인정보 이전 범위·비용은 먼저 사용자 확인이 필요합니다.

## 변경하지 않은 것

기존 라이브 사이트·DB·비밀·권한·수집/발송 설정과 Cafe24 프로젝트는 변경하지 않았습니다. Pages/API/새 인증 환경을 배포한 상태가 아니며 결제나 새 유료 리소스도 만들지 않았습니다.

## 공식 자료

- https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
