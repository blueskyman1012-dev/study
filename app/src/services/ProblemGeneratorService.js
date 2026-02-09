// AI 문제 생성 서비스 (수학 전용)
// SmilePrint API 사용
import { safeGetItem } from '../utils/storage.js';

const API_BASE_URL = 'https://caricature-api-rust.wizice.com';
const DEFAULT_MODEL = 'gemini-2.0-flash';

// 수학 주제 목록
const MATH_TOPICS = {
  linear: { name: '일차방정식', examples: '2x + 3 = 7' },
  quadratic: { name: '이차방정식', examples: 'x² - 5x + 6 = 0' },
  factoring: { name: '인수분해', examples: 'x² + 5x + 6' },
  function: { name: '함수', examples: 'f(x) = 2x + 1, f(3) = ?' },
  inequality: { name: '부등식', examples: '2x - 3 > 5' },
  fraction: { name: '분수 계산', examples: '1/2 + 1/3' },
  percentage: { name: '비율/퍼센트', examples: '20의 30%' },
  sequence: { name: '수열', examples: '등차수열 합' },
  probability: { name: '확률', examples: '주사위 확률' },
  geometry: { name: '도형', examples: '삼각형 넓이' }
};

// 과학 주제 목록
const SCIENCE_TOPICS = {
  force: { name: '힘과 운동', examples: '등속운동, 가속도, F=ma', level: '중' },
  chemical: { name: '화학반응', examples: '화학반응식, 질량보존법칙', level: '중' },
  cell: { name: '세포', examples: '세포 구조, 세포분열, 삼투현상', level: '중' },
  earth: { name: '지구과학', examples: '지층, 판구조론, 기상현상', level: '중' },
  mechanics: { name: '역학', examples: '운동방정식, 일과 에너지, 운동량', level: '고' },
  electromagnetic: { name: '전자기', examples: '전기장, 자기장, 전자기유도', level: '고' },
  mole: { name: '몰과 반응식', examples: '몰 개념, 화학양론, 농도 계산', level: '고' },
  genetics: { name: '유전', examples: '멘델유전, DNA, 유전자 발현', level: '고' }
};

export class ProblemGeneratorService {
  constructor() {
    this.apiKey = null;
    this.loadApiKey();
  }

  // API 키 로드 (ImageAnalysisService와 공유)
  loadApiKey() {
    this.apiKey = safeGetItem('smileprint_api_key');
    return this.apiKey;
  }

  hasApiKey() {
    return !!this.apiKey;
  }

  // 문제 생성 Prompt
  buildGeneratePrompt(topic, difficulty, count) {
    const topicInfo = MATH_TOPICS[topic] || MATH_TOPICS.linear;
    const difficultyText = ['쉬움', '보통', '어려움'][difficulty - 1] || '보통';

    return `당신은 한국 고등학교 수학 선생님입니다.

## 작업
${topicInfo.name} 문제를 ${count}개 만드세요.
예시: ${topicInfo.examples}

## 조건
- 난이도: ${difficultyText}
- 정답은 반드시 숫자 (예: "5", "-3", "2, -3")
- 이차방정식은 두 근을 쉼표로 구분 (예: "2, -3")
- 학생이 자주 하는 실수를 반영한 오답 3개 포함
- 오답은 정답과 비슷한 숫자로 (예: 정답 5 → 오답 3, 7, -5)

## JSON 출력 (반드시 이 형식만)
{
  "problems": [
    {
      "question": "문제 내용",
      "answer": "5",
      "answers": ["5"],
      "choices": ["5", "3", "7", "-5"],
      "correctIndex": 0,
      "explanation": "풀이: 2x + 3 = 13, 2x = 10, x = 5",
      "difficulty": ${difficulty},
      "topic": "${topicInfo.name}"
    }
  ]
}

## 필수
- choices[0]은 반드시 정답
- 모든 choices는 숫자만
- explanation은 단계별 풀이`;
  }

  // 과학 문제 생성 Prompt
  buildSciencePrompt(topic, difficulty, count) {
    const topicInfo = SCIENCE_TOPICS[topic] || SCIENCE_TOPICS.force;
    const difficultyText = ['쉬움', '보통', '어려움'][difficulty - 1] || '보통';

    return `당신은 한국 과학 선생님입니다. 중학교와 고등학교 과학을 가르칩니다.

## 작업
${topicInfo.name} (${topicInfo.level}등학교) 문제를 ${count}개 만드세요.
예시 주제: ${topicInfo.examples}

## 조건
- 난이도: ${difficultyText}
- 정답은 반드시 짧은 텍스트 또는 숫자 (예: "가속도", "36", "DNA")
- 학생이 자주 혼동하는 개념을 반영한 오답 3개 포함
- 오답은 정답과 관련된 과학 용어로 (예: 정답 "가속도" → 오답 "속력", "변위", "관성")
- 계산 문제는 단위를 포함 (예: "10 m/s²")

## JSON 출력 (반드시 이 형식만)
{
  "problems": [
    {
      "question": "문제 내용",
      "answer": "정답",
      "answers": ["정답"],
      "choices": ["정답", "오답1", "오답2", "오답3"],
      "correctIndex": 0,
      "explanation": "풀이: 상세한 과학적 설명",
      "difficulty": ${difficulty},
      "topic": "${topicInfo.name}"
    }
  ]
}

## 필수
- choices[0]은 반드시 정답
- explanation은 과학적 원리를 포함한 상세 풀이`;
  }

  // 유사 문제 생성 Prompt
  buildSimilarPrompt(originalProblem) {
    return `당신은 한국 고등학교 수학 선생님입니다.

## 원본 문제
문제: ${originalProblem.question}
정답: ${originalProblem.answer}
주제: ${originalProblem.topic || '수학'}

## 작업
위 문제와 유사하지만 숫자가 다른 문제 2개를 만드세요.

## 조건
- 같은 유형, 다른 숫자
- 정답은 숫자만
- 오답 3개 포함 (정답과 비슷한 숫자)
- 단계별 풀이 포함

## JSON 출력
{
  "problems": [
    {
      "question": "새 문제",
      "answer": "정답",
      "answers": ["정답"],
      "choices": ["정답", "오답1", "오답2", "오답3"],
      "correctIndex": 0,
      "explanation": "풀이",
      "difficulty": ${originalProblem.difficulty || 2},
      "topic": "${originalProblem.topic || '수학'}"
    }
  ]
}`;
  }

  // 검증 Prompt (AI가 문제를 다시 풀어봄)
  buildValidatePrompt(problem) {
    return `다음 수학 문제를 풀어서 정답을 확인하세요.

문제: ${problem.question}
제시된 정답: ${problem.answer}

## 작업
1. 문제를 직접 풀어보세요
2. 계산한 정답과 제시된 정답이 일치하는지 확인

## JSON 출력
{
  "calculatedAnswer": "계산한 정답",
  "isCorrect": true,
  "explanation": "풀이 과정"
}`;
  }

  // SmilePrint API 호출 (텍스트 생성)
  async callAPI(prompt) {
    if (!this.apiKey) {
      throw new Error('SmilePrint API 키가 없습니다');
    }

    // FormData로 텍스트만 전송 (이미지 없이)
    const formData = new FormData();

    // 더미 이미지 생성 (1x1 투명 PNG)
    const dummyImage = this.createDummyImage();
    formData.append('image', dummyImage, 'dummy.png');
    formData.append('prompt', prompt);
    formData.append('model', DEFAULT_MODEL);
    formData.append('temperature', '0.7');

    console.log('🤖 AI 문제 생성 요청...');

    const response = await fetch(`${API_BASE_URL}/api/v1/analyze/image`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.apiKey
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.errorMessage || `API 오류: ${response.status}`);
    }

    const jobData = await response.json();
    console.log('📋 Job 생성:', jobData.jobId);

    // 완료 대기
    const result = await this.waitForCompletion(jobData.jobId, jobData.accessKey);

    // 결과 파싱
    const text = result.result?.analysisText || '';
    console.log('📝 응답:', text);

    return this.parseJSON(text);
  }

  // 더미 이미지 생성
  createDummyImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 1, 1);

    // Canvas를 Blob으로 변환
    const dataURL = canvas.toDataURL('image/png');
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = 'image/png';
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }

  // 완료 대기
  async waitForCompletion(jobId, accessKey, maxAttempts = 60) {
    for (let i = 0; i < maxAttempts; i++) {
      // 첫 폴링은 짧게, 이후 점진적으로 늘림
      const delay = i === 0 ? 300 : i < 5 ? 800 : 1500;
      await this.sleep(delay);

      const response = await fetch(`${API_BASE_URL}/api/v1/analyze/status/${jobId}`, {
        headers: { 'Authorization': `Bearer ${accessKey}` }
      });

      const status = await response.json();
      console.log(`📊 상태: ${status.status} (${i + 1}/${maxAttempts})`);

      if (status.status === 'completed') return status;
      if (status.status === 'failed') throw new Error(status.errorMessage || '생성 실패');
    }
    throw new Error('시간 초과');
  }

  // JSON 파싱
  parseJSON(text) {
    try {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      return null;
    } catch (e) {
      console.error('JSON 파싱 오류:', e);
      return null;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ===== 공개 메서드 =====

  // 주제별 문제 생성
  async generateProblems(topic = 'linear', difficulty = 2, count = 3, subject = 'math') {
    const prompt = subject === 'science'
      ? this.buildSciencePrompt(topic, difficulty, count)
      : this.buildGeneratePrompt(topic, difficulty, count);
    const result = await this.callAPI(prompt);

    if (!result || !result.problems) {
      throw new Error('문제 생성 실패');
    }

    console.log(`✅ ${result.problems.length}개 문제 생성 완료`);
    return result.problems;
  }

  // 유사 문제 생성
  async generateSimilar(originalProblem) {
    const prompt = this.buildSimilarPrompt(originalProblem);
    const result = await this.callAPI(prompt);

    if (!result || !result.problems) {
      throw new Error('유사 문제 생성 실패');
    }

    console.log(`✅ ${result.problems.length}개 유사 문제 생성 완료`);
    return result.problems;
  }

  // 문제 검증 (AI가 다시 풀어봄)
  async validateProblem(problem) {
    const prompt = this.buildValidatePrompt(problem);
    const result = await this.callAPI(prompt);

    if (!result) {
      return { isCorrect: false, reason: '검증 실패' };
    }

    console.log(`🔍 검증 결과: ${result.isCorrect ? '✅ 정답 일치' : '❌ 정답 불일치'}`);
    return result;
  }

  // 랜덤 주제로 문제 생성
  async generateRandom(count = 5, subject = 'math') {
    const topicSource = subject === 'science' ? SCIENCE_TOPICS : MATH_TOPICS;
    const topics = Object.keys(topicSource);
    const randomTopic = topics[Math.floor(Math.random() * topics.length)];
    const randomDifficulty = Math.floor(Math.random() * 3) + 1;

    return await this.generateProblems(randomTopic, randomDifficulty, count, subject);
  }

  // 주제 목록 반환
  getTopics(subject = 'math') {
    return subject === 'science' ? SCIENCE_TOPICS : MATH_TOPICS;
  }
}

// 싱글톤 인스턴스
export const problemGeneratorService = new ProblemGeneratorService();
