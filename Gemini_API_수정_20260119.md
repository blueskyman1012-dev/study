# Gemini API 모델명 수정 기록

## 날짜
2026-01-19

## 문제점
- **404 Not Found**: `gemini-2.0-flash` 및 `gemini-1.5-flash` 모델 경로 오류
- **429 Too Many Requests**: API 호출 제한 (잠시 후 재시도 필요)

## 수정 내용

### 파일: `C:\hjkim\app\src\services\GeminiService.js`

**변경 전:**
```javascript
const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
```

**변경 후 (최종):**
```javascript
const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
```

## 변경 이유
- **Gemini 1.5 모델이 이미 은퇴(retired)되어 404 오류 발생**
- `gemini-2.5-flash`로 업그레이드 (현재 사용 가능한 최신 모델)
- 텍스트와 비전 API 모두 동일한 모델로 통일

## 검증 방법
1. 앱 새로고침
2. 설정 > 테스트 문제 생성 클릭
3. 오답 등록 > 사진 촬영 > 과목 선택 > AI 분석 확인
4. 브라우저 콘솔(F12)에서 오류 확인

## 추가 수정: AI 문제 던전 추가 기능

### 파일: `C:\hjkim\app\src\game\Game.js`

**변경 내용:**
- `testAIGeneration()` 메서드 수정
- AI로 생성된 문제가 자동으로 던전(몬스터)에 추가됨
- 3개의 문제를 한 번에 생성하여 던전에 등록

## 참고
- 429 오류 발생 시 1분 정도 대기 후 재시도
- Google AI Studio에서 API 키 할당량 확인 가능
