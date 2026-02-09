# weather.bat 기능 정리

**작성일**: 2026-01-19

## 개요
서울 날씨를 간단히 조회하는 배치 파일

## 파일 구성

| 파일 | 용도 |
|------|------|
| weather.bat | 메인 실행 파일 |

## 기능 설명

### 실행 방법
- `weather.bat` 더블클릭 또는 CMD에서 실행

### 동작 방식
1. UTF-8 인코딩 설정
2. wttr.in API로 서울 날씨 조회
3. 온도 및 날씨 상태 표시
4. 종료 대기

### 사용 기술
- **wttr.in**: 무료 날씨 API 서비스
- **curl**: HTTP 요청 도구 (Windows 10+ 기본 포함)

## 코드

```batch
@echo off
chcp 65001 >nul
title 오늘의 날씨
curl -s "wttr.in/Seoul?format=3&lang=ko"
echo.
curl -s "wttr.in/Seoul?format=%%t+%%C&lang=ko"
echo.
echo 좋은 하루 되세요!
echo.
pause
```

## 출력 예시

```
Seoul: ☁️ -3°C

-3°C 흐림

좋은 하루 되세요!

계속하려면 아무 키나 누르십시오...
```

## 이전 버전과 비교

| 항목 | 이전 (Claude) | 현재 (wttr.in) |
|------|---------------|----------------|
| 데이터 소스 | Claude API | wttr.in |
| 비용 | 토큰 소모 | **무료** |
| 정확도 | AI 추정 | 실시간 데이터 |
| 속도 | 느림 | 빠름 |
| 의존성 | Claude CLI 필요 | curl만 필요 |

## 참고
- wttr.in 문서: https://wttr.in/:help
- 다른 도시 조회: `wttr.in/도시명` 으로 변경 가능
