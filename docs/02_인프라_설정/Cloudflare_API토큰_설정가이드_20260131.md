# Cloudflare API 토큰 & Wrangler 설정 가이드

## 필요한 것 정리

| 필요한 것 | 설명 | 어디서 얻나 |
|-----------|------|------------|
| **Cloudflare 계정** | 이미 가입 완료 | - |
| **Account ID** | 계정 고유 번호 | Cloudflare 대시보드 |
| **API Token** | Wrangler 인증용 열쇠 | Cloudflare 대시보드에서 생성 |
| **Node.js** | Wrangler 실행에 필요 | https://nodejs.org |
| **Wrangler CLI** | Cloudflare 배포 도구 | npm으로 설치 |

---

## STEP 1: Node.js 설치 확인

```powershell
node --version
npm --version
```

설치 안 되어 있으면: https://nodejs.org 에서 LTS 버전 다운로드 설치

---

## STEP 2: Wrangler 설치

```powershell
npm install -g wrangler
```

설치 확인:
```powershell
wrangler --version
```

---

## STEP 3: Account ID 확인

### 방법 1: 대시보드에서 복사
1. https://dash.cloudflare.com 로그인
2. 메인 화면에서 계정 옆 **⋯ (점 세 개)** 클릭
3. **"Copy account ID"** 클릭

### 방법 2: 도메인 페이지에서 확인
1. 대시보드에서 도메인 선택
2. Overview(개요) 페이지 오른쪽 하단
3. **Account ID** 항목에 표시됨

---

## STEP 4: API Token 만들기

### 4-1. 토큰 생성 페이지 이동
1. https://dash.cloudflare.com/profile/api-tokens 접속
2. **"Create Token"** 클릭

### 4-2. 템플릿 선택
- **"Edit Cloudflare Workers"** 템플릿 → **"Use template"** 클릭
- 이 템플릿이 Pages와 Workers 배포에 필요한 권한을 포함함

### 4-3. 권한 확인/수정

기본 템플릿 권한:

| 권한 | 접근 수준 | 용도 |
|------|----------|------|
| Account > Workers Scripts | **Edit** | Workers 배포 |
| Account > Workers Routes | **Edit** | Workers 라우트 설정 |
| Account > Account Settings | **Read** | 계정 정보 읽기 |
| Zone > Zone | **Read** | 도메인 정보 읽기 |

### Pages 배포도 하려면 권한 추가:
- **+ Add more** 클릭
- **Account > Cloudflare Pages > Edit** 추가

### 최종 권한 목록:

| 권한 | 접근 수준 |
|------|----------|
| Account > Workers Scripts | Edit |
| Account > Workers Routes | Edit |
| Account > Cloudflare Pages | Edit |
| Account > Account Settings | Read |
| Zone > Zone | Read |

### 4-4. Account Resources 설정
- **Include > All accounts** (계정이 하나면 그대로)
- 또는 특정 계정만 선택

### 4-5. Zone Resources 설정
- **Include > All zones** (도메인이 하나면 그대로)
- 또는 특정 도메인만 선택

### 4-6. 토큰 생성
1. **"Continue to summary"** 클릭
2. 권한 요약 확인
3. **"Create Token"** 클릭
4. ⚠️ **표시되는 토큰을 반드시 복사해서 저장!** (다시 볼 수 없음)

---

## STEP 5: Wrangler 인증 (2가지 방법)

### 방법 A: 브라우저 로그인 (간편, PC에서 추천)
```powershell
wrangler login
```
- 브라우저가 열림 → Cloudflare 로그인 → **Allow** 클릭 → 완료
- 가장 쉬운 방법

### 방법 B: API Token으로 인증 (CI/CD, 서버에서 추천)

#### Windows PowerShell:
```powershell
$env:CLOUDFLARE_API_TOKEN = "여기에_토큰_붙여넣기"
$env:CLOUDFLARE_ACCOUNT_ID = "여기에_Account_ID_붙여넣기"
```

#### 영구 저장 (매번 입력 안 하려면):
```powershell
[System.Environment]::SetEnvironmentVariable("CLOUDFLARE_API_TOKEN", "여기에_토큰", "User")
[System.Environment]::SetEnvironmentVariable("CLOUDFLARE_ACCOUNT_ID", "여기에_ID", "User")
```
설정 후 PowerShell 재시작 필요

#### Linux/Mac (Oracle Cloud 등):
```bash
export CLOUDFLARE_API_TOKEN="여기에_토큰_붙여넣기"
export CLOUDFLARE_ACCOUNT_ID="여기에_Account_ID_붙여넣기"
```

영구 저장:
```bash
echo 'export CLOUDFLARE_API_TOKEN="여기에_토큰"' >> ~/.bashrc
echo 'export CLOUDFLARE_ACCOUNT_ID="여기에_ID"' >> ~/.bashrc
source ~/.bashrc
```

### 인증 확인
```powershell
wrangler whoami
```
계정 이름과 Account ID가 표시되면 성공!

---

## STEP 6: 사용 예시

### Workers 만들기 & 배포
```powershell
# 새 Workers 프로젝트 생성
wrangler init my-worker

# 프로젝트 폴더로 이동
cd my-worker

# 로컬 테스트
wrangler dev

# 배포
wrangler deploy
```

### Pages 배포
```powershell
# 빌드된 폴더를 Pages에 배포
wrangler pages deploy ./build --project-name=my-site

# 또는 GitHub 연동 프로젝트 생성
wrangler pages project create my-site
```

---

## 보안 주의사항

- ⚠️ API Token을 **코드나 git에 절대 커밋하지 말 것**
- .gitignore에 환경변수 파일 추가:
  ```
  .env
  .dev.vars
  ```
- Token이 유출되면 즉시 대시보드에서 **Revoke(폐기)** 후 재생성

---

## 자주 겪는 문제

| 문제 | 해결 |
|------|------|
| "Authentication error" | API Token이 올바른지 확인, 권한 확인 |
| "Account ID not found" | wrangler.toml에 account_id 추가 또는 환경변수 설정 |
| wrangler 명령어 안 됨 | `npm install -g wrangler` 재설치 |
| 브라우저 로그인 안 됨 | `wrangler login --browser false`로 링크 직접 복사 |
| Pages deploy 권한 오류 | API Token에 "Cloudflare Pages > Edit" 권한 추가 |

---

## 참고 자료
- [Cloudflare API Token 생성](https://dash.cloudflare.com/profile/api-tokens)
- [Account ID 찾기 공식 문서](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/)
- [Wrangler 명령어 문서](https://developers.cloudflare.com/workers/wrangler/commands/)
- [GitHub Actions 배포 가이드](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
