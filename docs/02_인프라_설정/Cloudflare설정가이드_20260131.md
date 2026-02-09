# Cloudflare 설정 가이드 (초보자용)

Cloudflare 활용법은 크게 2가지입니다:
- **Cloudflare Pages**: 웹사이트를 Cloudflare 서버에 올려서 배포 (서버 필요 없음)
- **Cloudflare Tunnel**: 내 PC/Oracle Cloud 서버를 외부에서 접속 가능하게 연결

---

## Part A. Cloudflare Pages (웹사이트 배포)

> GitHub에 코드 올리면 자동으로 웹사이트가 배포됨. 서버 관리 불필요.

### STEP 1: Cloudflare 계정 만들기
1. https://dash.cloudflare.com/sign-up 접속
2. 이메일 + 비밀번호 입력
3. 이메일 인증 링크 클릭
4. 완료!

### STEP 2: GitHub 계정 준비
1. https://github.com 에서 계정 만들기 (이미 있으면 생략)
2. 배포할 웹사이트 코드를 Repository에 올리기

### STEP 3: Cloudflare Pages 프로젝트 만들기
1. Cloudflare 대시보드 로그인
2. 왼쪽 메뉴에서 **Workers & Pages** 클릭
3. **Create** 클릭
4. **Pages** 탭 선택
5. **Connect to Git** 클릭
6. GitHub 계정 연결 → 배포할 Repository 선택
7. **빌드 설정**:

| 프로젝트 종류 | Build command | Build output directory |
|--------------|---------------|----------------------|
| HTML/CSS만 | (비워두기) | / |
| React | npm run build | build |
| Next.js | npx @cloudflare/next-on-pages | .vercel/output/static |
| Vue | npm run build | dist |

8. **Save and Deploy** 클릭
9. 배포 완료! → `프로젝트이름.pages.dev` 주소로 접속 가능

### STEP 4: 자동 배포
- GitHub에 코드를 push하면 **자동으로 재배포**됨
- 별도 설정 필요 없음

### STEP 5: 커스텀 도메인 연결 (선택)
1. Pages 프로젝트 → **Custom domains** 탭
2. 도메인 입력 (예: mysite.com)
3. DNS 설정 자동 안내 → 따라하면 끝
4. HTTPS 자동 적용

### Cloudflare Pages 무료 범위
- 대역폭: **무제한**
- 빌드: 월 500회
- 사이트 수: 무제한
- HTTPS: 자동 무료

---

## Part B. Cloudflare Tunnel (PC/서버를 외부에 공개)

> 포트포워딩 없이 내 PC나 Oracle Cloud 서버를 인터넷에 공개.
> 공유기 설정이나 방화벽 걱정 없음.

### 언제 쓰나?
- 내 PC에서 돌리는 웹서버를 외부에서 접속하고 싶을 때
- 공유기 포트포워딩이 안 되는 환경 (통신사 제한 등)
- Oracle Cloud 서버의 방화벽 설정이 어려울 때

### STEP 1: 도메인 준비

#### 무료 도메인 사용 시
- Cloudflare Tunnel은 **도메인이 필요**합니다
- 무료 서브도메인은 Tunnel에서 직접 지원하지 않으므로
- 저렴한 도메인 구매 추천 (연 1~2천원대)
  - https://www.namecheap.com (.xyz 도메인 약 1,200원/년)
  - https://porkbun.com

#### 도메인을 Cloudflare에 등록
1. Cloudflare 대시보드 → **Add a site** 클릭
2. 도메인 입력 (예: mysite.xyz)
3. **Free** 플랜 선택
4. Cloudflare가 알려주는 **네임서버 2개**를 메모
5. 도메인 구매한 사이트에서 네임서버를 Cloudflare 것으로 변경
6. 반영까지 수 분 ~ 최대 24시간 대기

### STEP 2: Cloudflare Tunnel 만들기 (대시보드에서)

1. Cloudflare 대시보드 → 왼쪽 메뉴 **Zero Trust** 클릭
2. **Networks → Tunnels** 클릭
3. **Create a tunnel** 클릭
4. 터널 이름 입력 (예: my-pc-tunnel)
5. **Save tunnel** 클릭

### STEP 3: cloudflared 설치 (내 PC 또는 서버에)

#### Windows PC의 경우
1. 터널 생성 후 나오는 화면에서 **Windows** 탭 선택
2. 표시되는 설치 명령어를 복사
3. **PowerShell을 관리자 권한으로 실행** (시작 메뉴 → PowerShell 우클릭 → 관리자)
4. 복사한 명령어 붙여넣기 후 Enter

또는 수동 설치:
```powershell
# winget으로 설치 (Windows 10/11)
winget install Cloudflare.cloudflared

# 또는 직접 다운로드
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

#### Ubuntu (Oracle Cloud) 서버의 경우
SSH로 접속 후:
```bash
# cloudflared 설치
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

ARM 인스턴스(Oracle Cloud A1)의 경우:
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb
```

### STEP 4: 터널 연결 (토큰 설치)

대시보드에서 표시되는 명령어를 실행:
```bash
# 대시보드에서 복사한 명령어 (토큰은 자동 포함)
sudo cloudflared service install <토큰값>
```

> 토큰은 대시보드 터널 설정 화면에 표시됩니다. 그대로 복사 붙여넣기하면 됩니다.

### STEP 5: Public Hostname 설정 (어떤 주소로 접속할지)

1. 터널 설정 → **Public Hostnames** 탭
2. **Add a public hostname** 클릭
3. 설정:

| 항목 | 입력 예시 | 설명 |
|------|----------|------|
| Subdomain | www (또는 비워두기) | 서브도메인 |
| Domain | mysite.xyz | 등록한 도메인 선택 |
| Type | HTTP | 프로토콜 |
| URL | localhost:3000 | 내 PC에서 돌리는 서비스 포트 |

4. **Save hostname** 클릭

### STEP 6: 확인
- 브라우저에서 `https://mysite.xyz` 접속
- 내 PC/서버에서 돌리는 웹서비스가 보이면 성공!
- HTTPS는 Cloudflare가 자동 처리

---

## Part C. 어떤 걸 써야 하나?

| 상황 | 추천 |
|------|------|
| HTML/React 등 웹사이트만 배포 | **Cloudflare Pages** |
| 내 PC에서 프로그램을 돌리고 외부 접속 | **Cloudflare Tunnel** |
| Oracle Cloud 서버 + 도메인 연결 | **Cloudflare Tunnel** 또는 DNS만 연결 |
| 둘 다 | Pages로 프론트엔드 + Tunnel로 백엔드 API |

---

## 자주 겪는 문제

| 문제 | 해결 |
|------|------|
| 사이트 접속 안 됨 | cloudflared가 실행 중인지 확인 |
| 502 Bad Gateway | localhost 포트 번호가 맞는지 확인 |
| DNS 반영 안 됨 | 네임서버 변경 후 최대 24시간 대기 |
| Windows에서 cloudflared 꺼짐 | 서비스로 등록하면 자동 실행됨 |

### Windows에서 cloudflared를 서비스로 등록 (자동 실행)
```powershell
# 관리자 PowerShell에서
cloudflared service install
```
이러면 PC 재시작해도 자동으로 터널이 연결됩니다.

---

## 참고 자료
- [Cloudflare Tunnel 완벽 가이드 (한국어)](https://medium.com/@mazleyou/cloudflare-tunnel-%EC%99%84%EB%B2%BD-%EA%B0%80%EC%9D%B4%EB%93%9C-%EB%A1%9C%EC%BB%AC-%EB%A6%AC%EC%86%8C%EC%8A%A4%EC%97%90-%EB%8C%80%ED%95%9C-%EC%95%88%EC%A0%84%ED%95%9C-%EC%9B%90%EA%B2%A9-%EC%A0%91%EA%B7%BC-%EC%84%A4%EC%A0%95%ED%95%98%EA%B8%B0-fdda077e1be8)
- [Cloudflare Tunnel 가이드 (YCC Blog)](https://blog.ycc.club/2025/10/cloudflare-tunnel/)
- [외부 포트오픈 없이 서버 운영하기 (SVR포럼)](https://svrforum.com/svr/1029447)
- [Cloudflare Pages 배포하기 (Velog)](https://velog.io/@jude-ui/CLOUDFLARE%EB%A1%9C-%EB%B0%B0%ED%8F%AC%ED%95%B4%EB%B3%B4%EA%B8%B0)
- [Cloudflare 공식 Tunnel 문서](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/)
- [Cloudflare Pages 공식](https://www.cloudflare.com/developer-platform/products/pages/)
