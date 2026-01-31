// SmilePrint Image-to-Text API 서비스
// 문제 이미지 분석용

const API_BASE_URL = 'https://caricature-api-rust.wizice.com';
const DEFAULT_MODEL = 'gemini-2.0-flash-exp'; // gemini-3-flash-preview 사용 시 변경

export class ImageAnalysisService {
  constructor() {
    this.apiKey = null;
    this.loadApiKey();
  }

  // API 키 설정
  setApiKey(key) {
    this.apiKey = key;
    localStorage.setItem('smileprint_api_key', key);
  }

  // 저장된 API 키 로드
  loadApiKey() {
    this.apiKey = localStorage.getItem('smileprint_api_key');
    return this.apiKey;
  }

  // API 키 유효성 확인
  hasApiKey() {
    return !!this.apiKey;
  }

  // 과목별 프롬프트 생성 (A 방안: 구조화된 분석)
  buildPrompt(subject) {
    const subjectNames = {
      math: '수학',
      english: '영어',
      korean: '국어',
      science: '과학',
      social: '사회'
    };

    const subjectName = subjectNames[subject] || '일반';

    return `당신은 한국 고등학교 ${subjectName} 시험 문제 분석 전문가입니다.

## 작업
이 이미지의 시험 문제를 정확히 분석하세요.

## 분석 단계
1. 문제 유형 파악 (객관식/주관식/서술형)
2. 문제 전문 추출
3. 문제를 직접 풀어서 정답 도출
4. 오답 선택지 생성

## 정답 규칙
- 이차방정식 등 복수 정답: "2, -3" 또는 "x=2, x=-3"
- 단일 정답: "5" 또는 "-2"
- 분수는 그대로: "1/2" 또는 "2/3"
- 소수: "0.5" 또는 "3.14"

## 오답 생성 규칙
정답과 비슷하지만 틀린 값으로 오답 3개 생성:
- 정답 5 → 오답 3, 7, -5
- 정답 "2, -3" → 오답 "2, 3", "1, -3", "-2, 3"
- 계산 실수로 나올 수 있는 값 사용
- 부호 실수, 계산 실수 등 학생이 흔히 하는 실수 반영

## JSON 출력 (반드시 이 형식만)
{
  "success": true,
  "questionType": "객관식",
  "question": "문제 전문",
  "answer": "정답값",
  "answers": ["정답1", "정답2"],
  "choices": ["정답", "오답1", "오답2", "오답3"],
  "correctIndex": 0,
  "explanation": "상세 풀이 과정",
  "topic": "이차방정식",
  "difficulty": "중",
  "formula": "사용된 공식"
}

## 필수 확인
- answer: 최종 정답 (복수면 쉼표로 구분)
- answers: 정답 배열 (복수 정답 지원)
- choices[0]은 반드시 정답과 동일
- explanation: 단계별 풀이 과정
- formula: 관련 공식 (없으면 빈 문자열)`;
  }

  // 이미지 분석 요청 (비동기 Job 생성)
  async analyzeImage(imageData, subject) {
    if (!this.apiKey) {
      throw new Error('SmilePrint API 키가 설정되지 않았습니다');
    }

    // base64 데이터 추출
    const base64Data = imageData.includes(',')
      ? imageData.split(',')[1]
      : imageData;

    // Blob 생성
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });

    // FormData 생성
    const formData = new FormData();
    formData.append('image', blob, 'problem.jpg');
    formData.append('prompt', this.buildPrompt(subject));
    formData.append('model', DEFAULT_MODEL);
    formData.append('temperature', '0.3'); // 낮은 온도로 일관된 결과

    console.log('🔍 SmilePrint API 호출 시작...');

    const response = await fetch(`${API_BASE_URL}/api/v1/analyze/image`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.errorMessage || `API 오류: ${response.status}`);
    }

    const jobData = await response.json();
    console.log('📋 Job 생성됨:', jobData.jobId);

    return {
      jobId: jobData.jobId,
      accessKey: jobData.accessKey,
      estimatedCost: jobData.estimatedCost
    };
  }

  // 분석 상태 확인
  async checkStatus(jobId, accessKey) {
    const response = await fetch(`${API_BASE_URL}/api/v1/analyze/status/${jobId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`상태 확인 실패: ${response.status}`);
    }

    return await response.json();
  }

  // 완료까지 대기 (폴링)
  async waitForCompletion(jobId, accessKey, maxAttempts = 60, onProgress = null) {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.sleep(1000); // 1초 대기

      const status = await this.checkStatus(jobId, accessKey);

      if (onProgress) {
        onProgress(status.progress || 0, status.status);
      }

      console.log(`📊 상태: ${status.status}, 진행률: ${status.progress || 0}%`);

      if (status.status === 'completed') {
        console.log('✅ 분석 완료!');
        return status;
      }

      if (status.status === 'failed') {
        throw new Error(status.errorMessage || '분석 실패');
      }
    }

    throw new Error('분석 시간 초과');
  }

  // 이미지 분석 (전체 프로세스)
  async analyze(imageData, subject, onProgress = null) {
    // 1. Job 생성
    const job = await this.analyzeImage(imageData, subject);

    // 2. 완료 대기
    const result = await this.waitForCompletion(job.jobId, job.accessKey, 60, onProgress);

    // 3. 결과 파싱
    console.log('📥 API 응답 원본:', result);
    const analysisText = result.result?.analysisText || '';
    console.log('📝 분석 텍스트:', analysisText);

    const parsed = this.parseJSON(analysisText);
    console.log('🔍 파싱 결과:', parsed);

    if (!parsed || !parsed.success) {
      throw new Error(parsed?.message || '분석 결과를 파싱할 수 없습니다');
    }

    // 정답 검증
    console.log('✅ 정답:', parsed.answer);
    console.log('📋 선택지:', parsed.choices);

    // 4. 메타데이터 추가
    return {
      ...parsed,
      aiAnalysis: {
        model: DEFAULT_MODEL,
        processingTime: result.processingTime,
        cost: result.actualCost,
        analyzedAt: Date.now()
      }
    };
  }

  // JSON 파싱 헬퍼
  parseJSON(text) {
    try {
      // JSON 블록 추출
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return null;
    } catch (e) {
      console.error('JSON 파싱 오류:', e, text);
      return null;
    }
  }

  // 유틸: 대기
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// 싱글톤 인스턴스
export const imageAnalysisService = new ImageAnalysisService();
