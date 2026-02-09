// Gemini AI 서비스
import { apiService } from './ApiService.js';
import { secureGetItem, secureSetItem } from '../utils/storage.js';
// 텍스트 전용
const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
// 이미지 분석용 (Vision 지원)
const GEMINI_VISION_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export class GeminiService {
  constructor(apiKey) {
    this.apiKey = apiKey || null;
  }

  // API 키 설정 (로컬 + 서버 저장)
  setApiKey(key) {
    this.apiKey = key;
    secureSetItem('gemini_api_key', key);
    if (apiService.isLoggedIn()) {
      apiService.saveKey('gemini_api_key', key).catch(err =>
        console.warn('Gemini 키 서버 저장 실패:', err)
      );
    }
  }

  // 저장된 API 키 로드
  loadApiKey() {
    const savedKey = secureGetItem('gemini_api_key');
    this.apiKey = savedKey || null;
    console.log('Gemini API 키 로드됨:', this.apiKey ? '있음' : '없음');
    return this.apiKey;
  }

  // API 키 유효성 확인
  hasApiKey() {
    return !!this.apiKey;
  }

  // 이미지에서 문제와 답 추출
  async analyzeImage(imageData, subject) {
    if (!this.apiKey) {
      throw new Error('API 키가 없습니다');
    }

    // base64 추출
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;

    // MIME 타입 감지
    let mimeType = 'image/jpeg';
    if (imageData.startsWith('data:image/png')) {
      mimeType = 'image/png';
    } else if (imageData.startsWith('data:image/webp')) {
      mimeType = 'image/webp';
    }

    const prompt = `당신은 한국 고등학교 ${subject} 문제 분석 전문가입니다.

이 이미지에서 문제와 정답을 추출해주세요.

중요한 규칙:
1. 반드시 아래 JSON 형식으로만 응답하세요
2. 다른 텍스트 없이 JSON만 출력하세요
3. 문제에 보기(선택지)가 있으면 choices 배열에 넣으세요
4. 보기가 없으면 choices는 빈 배열로 두세요
5. 정답은 반드시 찾아서 answer에 넣으세요
6. correctIndex는 choices 배열에서 정답의 위치 (0부터 시작)
7. 부등식 문제: 정답은 반드시 부등식 표현으로 (예: "x > 4", "x ≤ -3"). 경계값 숫자만 쓰지 마세요.

JSON 형식:
{
  "question": "문제 내용 전체",
  "answer": "정답",
  "choices": ["보기1", "보기2", "보기3", "보기4"],
  "correctIndex": 0,
  "explanation": "간단한 풀이 설명"
}

이미지를 분석하고 위 JSON 형식으로만 응답하세요.`;

    const response = await fetch(GEMINI_VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Data } },
            { text: prompt }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048
        }
      })
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const err = await response.json();
        errorMsg = err.error?.message || errorMsg;
      } catch { /* 파싱 실패 무시 */ }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    console.log('Gemini 이미지 분석 응답:', data);

    if (data.error) {
      throw new Error(data.error.message);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('AI가 빈 응답을 반환했습니다');
    }

    const result = this.parseJSON(text);
    if (!result || !result.question) {
      throw new Error('문제를 인식하지 못했습니다');
    }

    return result;
  }

  // Gemini API 호출
  async generateContent(prompt) {
    if (!this.apiKey) {
      throw new Error('API 키가 설정되지 않았습니다');
    }

    const response = await fetch(GEMINI_TEXT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': this.apiKey,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      })
    });

    if (!response.ok) {
      let errorMsg = `HTTP ${response.status}`;
      try {
        const error = await response.json();
        errorMsg = error.error?.message || errorMsg;
      } catch { /* 파싱 실패 무시 */ }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('AI가 빈 응답을 반환했습니다');
    }
    return text;
  }

  // 문제 유형 분석
  async analyzeQuestion(question, subject) {
    const prompt = `
다음 문제의 유형을 분석해주세요.

과목: ${subject}
문제: ${question}

다음 JSON 형식으로만 응답하세요:
{
  "type": "문제 유형 (예: 일차방정식, 이차함수, 문법, 독해 등)",
  "concept": "핵심 개념",
  "difficulty": "상/중/하",
  "keywords": ["키워드1", "키워드2"]
}
`;

    const result = await this.generateContent(prompt);
    return this.parseJSON(result);
  }

  // 유사 문제 생성
  async generateSimilarProblems(question, answer, subject, count = 3) {
    const isInequality = /부등식/.test(question) || /[<>≤≥]/.test(answer);
    const inequalityRule = isInequality
      ? `\n5. 부등식 문제: 정답은 반드시 부등식 표현 (예: "x > 4", "x ≤ -3"), 선택지도 부등식 표현으로 (부등호 방향/등호 바꿔서 오답 생성). 경계값 숫자만 정답으로 쓰지 마세요.`
      : '';

    const prompt = `
당신은 한국 고등학교 ${subject} 선생님입니다.
학생이 다음 문제를 틀렸습니다. 비슷한 유형의 문제를 ${count}개 만들어주세요.

[원본 문제]
문제: ${question}
정답: ${answer}

[요구사항]
1. 같은 개념을 다루지만 숫자나 상황을 바꿔서 출제
2. 난이도: 쉬움 1개, 보통 1개, 어려움 1개
3. 각 문제에 4지선다 보기 포함
4. 수능/모의고사 스타일로 출제${inequalityRule}

다음 JSON 형식으로만 응답하세요:
{
  "problems": [
    {
      "question": "문제 내용",
      "answer": "정답",
      "choices": ["보기1", "보기2", "보기3", "보기4"],
      "correctIndex": 0,
      "difficulty": 1,
      "explanation": "간단한 풀이"
    }
  ]
}

JSON만 출력하고 다른 텍스트는 포함하지 마세요.
`;

    const result = await this.generateContent(prompt);
    return this.parseJSON(result);
  }

  // 새 문제 생성 (문제 은행 확장용)
  async generateNewProblems(subject, topic, count = 5) {
    const isInequality = /부등식/.test(topic);
    const inequalityRule = isInequality
      ? `\n5. 부등식 문제: 정답은 반드시 부등식 표현 (예: "x > 4", "x ≤ -3"), 선택지도 부등식 표현으로 (부등호 방향/등호 바꿔서 오답 생성). 경계값 숫자만 정답으로 쓰지 마세요.`
      : '';

    const prompt = `
당신은 한국 고등학교 ${subject} 선생님입니다.
"${topic}" 주제로 문제를 ${count}개 만들어주세요.

[요구사항]
1. 수능/모의고사 스타일
2. 다양한 난이도 (쉬움~어려움)
3. 4지선다 객관식
4. 고등학생 수준${inequalityRule}

다음 JSON 형식으로만 응답하세요:
{
  "problems": [
    {
      "question": "문제 내용",
      "answer": "정답",
      "choices": ["보기1", "보기2", "보기3", "보기4"],
      "correctIndex": 0,
      "difficulty": 1,
      "topic": "${topic}",
      "explanation": "간단한 풀이"
    }
  ]
}

JSON만 출력하세요.
`;

    const result = await this.generateContent(prompt);
    return this.parseJSON(result);
  }

  // 힌트 생성
  async generateHint(question, answer, subject) {
    const prompt = `
다음 문제에 대한 힌트를 생성해주세요. 정답을 직접 알려주지 말고, 풀이 방향만 제시하세요.

과목: ${subject}
문제: ${question}
정답: ${answer}

한 문장으로 힌트를 주세요.
`;

    return await this.generateContent(prompt);
  }

  // 풀이 설명 생성
  async generateExplanation(question, answer, subject) {
    const prompt = `
다음 문제의 풀이를 단계별로 설명해주세요.

과목: ${subject}
문제: ${question}
정답: ${answer}

[형식]
1단계: ...
2단계: ...
정답: ${answer}

학생이 이해하기 쉽게 설명해주세요.
`;

    return await this.generateContent(prompt);
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
}

// 싱글톤 인스턴스
export const geminiService = new GeminiService();
