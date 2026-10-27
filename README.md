# 사이 / SAI STUDIO

별자리·사주·자미두수 성향 읽기 사이트의 전체 애플리케이션 소스입니다. 기존 디자인, 계산, 상세 보고서, 로컬 PDF, 모임 신청, 체험 기록, 결과 발송 신청과 운영자 관리 코드를 보존합니다.

## 두 주소와 하나의 DB

- GitHub Pages: https://sai-story-studio.github.io/experience/
- 기존 Sites: https://sai-story-studio-20261022.youngjaetag.chatgpt.site/experience/
- 보호된 운영자 관리: https://sai-story-studio-20261022.youngjaetag.chatgpt.site/experience/operators

Pages에는 공개 화면·이미지·폰트·브라우저 계산·로컬 PDF만 배포합니다. 공개 신청은 기존 Sites 서버와 D1 DB에 연결합니다. Pages 주소를 유지한 채 성향 체험과 모임 신청을 사용할 수 있고, 관리자 로그인·개인정보 조회·삭제는 기존 Sites의 인증된 운영자 화면에서 처리합니다. 기존 주소도 유지합니다.

`public/experience/api-client.js`와 `lib/public-origin.ts`는 정확한 Pages 출처의 공개 설정 조회와 신청만 허용합니다. Pages 요청은 로그인 쿠키를 보내지 않습니다. 관리자 API의 기존 인증·출처 검사를 그대로 유지합니다.

## 화면과 최근 변경

소스의 HTML 5개(메인·operators·participants·admin·join), CSS, JavaScript, 폰트와 서버 기능을 보존합니다. 사주는 도시 선택 시 지역 평균태양시를 자동 적용하며, 사주·자미두수 성별과 자미두수 풀이 설정은 필수입니다. 생시를 모르면 시각을 추정하지 않습니다.

`scripts/build-github-pages.mjs`가 공개 파일만 구성하고 `.github/workflows/pages.yml`이 main 변경 시 배포합니다. Pages에서 운영자 경로를 열면 기존의 보호된 관리자 화면으로 연결합니다. 자세한 구조는 [docs/GITHUB-PAGES.md](docs/GITHUB-PAGES.md)를 참고하세요.

## 개인정보와 비밀

실제 신청자 정보·운영 DB·로컬 개발 DB·로그·백업·비밀키·이전 소스 Git 이력은 이 저장소에 포함하지 않습니다. 실제 운영 데이터는 기존 서버에 있으며 접근이 제한된 별도 로컬 백업으로 보관합니다. 자동 정기 백업은 별도 구성 전에는 실행되지 않습니다.

사용 중인 PNG 5개의 숨은 서명·인증서 메타데이터만 제거했고 원본 이미지 데이터 바이트는 유지했습니다. 현재 코드가 참조하지 않는 옛 사진 garden.jpg, journal.jpg, pottery.jpg 3개는 개인정보 메타데이터 공개를 피하도록 제외했습니다. 실제 화면의 이미지·폰트는 유지합니다. 제거한 서명 정보로 출처 인증을 주장하지 않습니다.

`.env`, `.dev.vars`, SQLite, CSV, 실제 보고서·PDF와 API 키를 커밋하지 마세요. `.env.example`에는 변수 이름과 빈 값만 있습니다. 운영 문서의 개인 문의 주소는 예시 주소로 바꿨고 테스트 연락처는 가상 데이터입니다.

## 실행과 배포

Node.js 22.13 이상과 프로젝트 의존성을 사용합니다. 서버 실행은 Vinext/Vite·Cloudflare Workers·D1 및 Sites 인증 환경이 필요합니다. 필요한 로컬 호스팅 설정은 `.openai/hosting.example.json`을 참고하고 실제 비밀값은 서버의 비밀 설정에서 관리하세요. 브라우저가 보낸 헤더로 관리자 신원을 대신하면 안 됩니다.

`npm run dev`와 `npm run build`는 서버용이고 `node scripts/build-github-pages.mjs`는 공개 Pages 파일을 구성합니다. DB를 public이나 Pages 출력 경로에 복사하지 마세요.

## 저작권

자산과 라이브러리의 출처·라이선스는 각 폴더에 보존합니다. 공개 저장소라는 이유로 디자인·이미지·폰트에 새로운 자유 이용 허락이 부여되지는 않습니다.
