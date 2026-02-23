// AI 문제 생성 중복 알림 버그 수정 테스트
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AIGenerateManager } from '../../../src/game/AIGenerateManager.js';

// Mock services
vi.mock('../../../src/services/GeminiService.js', () => ({
  geminiService: {
    hasApiKey: vi.fn().mockReturnValue(true),
    generateNewProblems: vi.fn(),
    setApiKey: vi.fn(),
    loadApiKey: vi.fn()
  }
}));

vi.mock('../../../src/services/ImageAnalysisService.js', () => ({
  imageAnalysisService: {
    hasApiKey: vi.fn().mockReturnValue(false),
    setApiKey: vi.fn()
  }
}));

vi.mock('../../../src/services/ProblemGeneratorService.js', () => ({
  problemGeneratorService: {
    hasApiKey: vi.fn().mockReturnValue(true),
    getTopics: vi.fn().mockReturnValue({
      algebra: { name: '대수' },
      geometry: { name: '기하' }
    }),
    generateProblems: vi.fn()
  }
}));

vi.mock('../../../src/i18n/i18n.js', () => ({
  t: vi.fn((...args) => args[0])
}));

vi.mock('../../../src/utils/textCleaner.js', () => ({
  renderProblemCard: vi.fn().mockReturnValue('data:image/png;base64,mock'),
  cleanQuestionText: vi.fn(text => text)
}));

import { geminiService } from '../../../src/services/GeminiService.js';
import { problemGeneratorService } from '../../../src/services/ProblemGeneratorService.js';

function createMockGame() {
  return {
    db: {
      add: vi.fn().mockResolvedValue(),
      put: vi.fn().mockResolvedValue(),
      get: vi.fn().mockResolvedValue(null),
      getByIndex: vi.fn().mockResolvedValue([])
    },
    monsterManager: {
      loadMonsters: vi.fn().mockResolvedValue(),
      monsters: []
    },
    showModal: vi.fn().mockResolvedValue(),
    showToast: vi.fn(),
    showPrompt: vi.fn().mockResolvedValue(null),
    showConfirm: vi.fn().mockResolvedValue(true),
    isGenerating: false,
    _generationCancelled: false,
    generatingMessage: '',
    generatingSubMessage: '',
    _needsRender: false,
    changeScreen: vi.fn(),
    _removeCancelOverlay: vi.fn()
  };
}

describe('AIGenerateManager - 중복 알림 버그 수정', () => {
  let mgr;
  let mockGame;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGame = createMockGame();
    mgr = new AIGenerateManager(mockGame);
  });

  // ──────────────────────────────────────────
  // testAIGeneration 테스트
  // ──────────────────────────────────────────
  describe('testAIGeneration()', () => {

    it('생성 성공 시 토스트가 정확히 1번만 표시되어야 한다', async () => {
      geminiService.generateNewProblems.mockResolvedValue({
        problems: [
          { question: '1+1=?', answer: '2', choices: ['1','2','3','4'], correctIndex: 1, difficulty: 1 }
        ]
      });

      await mgr.testAIGeneration();

      expect(mockGame.showToast).toHaveBeenCalledTimes(1);
      expect(mockGame.showToast.mock.calls[0][0]).toContain('testGenerated');
    });

    it('생성 실패(빈 결과) 시 토스트가 정확히 1번만 표시되어야 한다', async () => {
      geminiService.generateNewProblems.mockResolvedValue({ problems: [] });

      await mgr.testAIGeneration();

      expect(mockGame.showToast).toHaveBeenCalledTimes(1);
      expect(mockGame.showToast.mock.calls[0][0]).toBe('generateFailed');
    });

    it('API 에러 시 토스트가 정확히 1번만 표시되어야 한다', async () => {
      geminiService.generateNewProblems.mockRejectedValue(new Error('API 오류'));

      await mgr.testAIGeneration();

      expect(mockGame.showToast).toHaveBeenCalledTimes(1);
      expect(mockGame.showToast.mock.calls[0][0]).toContain('API 오류');
    });

    it('_aiGenerating 락이 중복 호출을 방지해야 한다', async () => {
      let resolveGenerate;
      geminiService.generateNewProblems.mockReturnValue(
        new Promise(r => { resolveGenerate = r; })
      );

      // 첫 번째 호출 (대기 중)
      const p1 = mgr.testAIGeneration();
      // 두 번째 호출 (락에 의해 무시)
      const p2 = mgr.testAIGeneration();
      // 세 번째 호출 (락에 의해 무시)
      const p3 = mgr.testAIGeneration();

      expect(mgr._aiGenerating).toBe(true);
      expect(geminiService.generateNewProblems).toHaveBeenCalledTimes(1);

      // 생성 완료
      resolveGenerate({ problems: [{ question: 'Q', answer: 'A', difficulty: 1 }] });
      await p1;
      await p2;
      await p3;

      expect(mockGame.showToast).toHaveBeenCalledTimes(1);
    });

    it('생성 중 isGenerating이 true여야 한다', async () => {
      let capturedIsGenerating = null;
      geminiService.generateNewProblems.mockImplementation(() => {
        capturedIsGenerating = mockGame.isGenerating;
        return Promise.resolve({ problems: [{ question: 'Q', answer: 'A', difficulty: 1 }] });
      });

      await mgr.testAIGeneration();

      expect(capturedIsGenerating).toBe(true);
    });

    it('완료 후 메인화면으로 전환되어야 한다', async () => {
      geminiService.generateNewProblems.mockResolvedValue({
        problems: [{ question: 'Q', answer: 'A', difficulty: 1 }]
      });

      await mgr.testAIGeneration();

      expect(mockGame.changeScreen).toHaveBeenCalled();
    });

    it('완료 후 isGenerating이 false여야 한다', async () => {
      geminiService.generateNewProblems.mockResolvedValue({
        problems: [{ question: 'Q', answer: 'A', difficulty: 1 }]
      });

      await mgr.testAIGeneration();

      expect(mockGame.isGenerating).toBe(false);
    });

    it('완료 후 _aiGenerating 락이 해제되어야 한다', async () => {
      geminiService.generateNewProblems.mockResolvedValue({
        problems: [{ question: 'Q', answer: 'A', difficulty: 1 }]
      });

      await mgr.testAIGeneration();

      expect(mgr._aiGenerating).toBe(false);
      expect(mockGame.isGenerating).toBe(false);
    });

    it('에러 후에도 _aiGenerating 락이 해제되어야 한다', async () => {
      geminiService.generateNewProblems.mockRejectedValue(new Error('네트워크 오류'));

      await mgr.testAIGeneration();

      expect(mgr._aiGenerating).toBe(false);
      expect(mockGame.isGenerating).toBe(false);
    });

    it('에러 후에도 메인화면으로 전환되어야 한다', async () => {
      geminiService.generateNewProblems.mockRejectedValue(new Error('네트워크 오류'));

      await mgr.testAIGeneration();

      expect(mockGame.changeScreen).toHaveBeenCalled();
      expect(mockGame.showToast).toHaveBeenCalledTimes(1);
    });

    it('finally 블록에서 _needsRender와 changeScreen이 설정되어야 한다', async () => {
      geminiService.generateNewProblems.mockResolvedValue({ problems: [] });
      mockGame._needsRender = false;

      await mgr.testAIGeneration();

      expect(mockGame._needsRender).toBe(true);
      expect(mockGame.changeScreen).toHaveBeenCalledWith('main');
    });
  });

  // ──────────────────────────────────────────
  // showAIGenerateMenu 테스트
  // ──────────────────────────────────────────
  describe('showAIGenerateMenu()', () => {

    it('사용자가 취소하면 모달이 표시되지 않아야 한다', async () => {
      mockGame.showPrompt.mockResolvedValue(null);

      await mgr.showAIGenerateMenu();

      expect(mockGame.showModal).not.toHaveBeenCalled();
    });

    it('사용자가 취소해도 _needsRender가 true로 설정되어야 한다', async () => {
      mockGame.showPrompt.mockResolvedValue(null);
      mockGame._needsRender = false;

      await mgr.showAIGenerateMenu();

      expect(mockGame._needsRender).toBe(true);
      expect(mockGame.changeScreen).toHaveBeenCalledWith('main');
    });

    it('_aiGenerating 락이 중복 호출을 방지해야 한다', async () => {
      let resolvePrompt;
      mockGame.showPrompt.mockReturnValue(new Promise(r => { resolvePrompt = r; }));

      const p1 = mgr.showAIGenerateMenu();
      const p2 = mgr.showAIGenerateMenu();
      const p3 = mgr.showAIGenerateMenu();

      expect(mgr._aiGenerating).toBe(true);
      expect(mockGame.showPrompt).toHaveBeenCalledTimes(1);

      resolvePrompt(null); // 취소
      await p1;
      await p2;
      await p3;

      expect(mgr._aiGenerating).toBe(false);
    });

    it('전체 프롬프트 → 생성 → 모달 흐름에서 모달이 1번만 표시되어야 한다', async () => {
      // 과목 → 주제 → 난이도 → 개수 순서로 응답
      mockGame.showPrompt
        .mockResolvedValueOnce('1')   // 수학
        .mockResolvedValueOnce('1')   // 대수
        .mockResolvedValueOnce('2')   // 보통
        .mockResolvedValueOnce('3');  // 3개

      problemGeneratorService.generateProblems.mockResolvedValue([
        { question: '2+2=?', answer: '4', choices: ['2','3','4','5'], correctIndex: 2, difficulty: 2 },
        { question: '3+3=?', answer: '6', choices: ['4','5','6','7'], correctIndex: 2, difficulty: 2 },
        { question: '4+4=?', answer: '8', choices: ['6','7','8','9'], correctIndex: 2, difficulty: 2 }
      ]);

      await mgr.showAIGenerateMenu();

      expect(mockGame.showToast).toHaveBeenCalledTimes(1);
      expect(mockGame.showToast.mock.calls[0][0]).toContain('generated');
    });

    it('생성 완료 후 메인화면으로 전환되어야 한다', async () => {
      mockGame.showPrompt
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('2')
        .mockResolvedValueOnce('3');

      problemGeneratorService.generateProblems.mockResolvedValue([
        { question: 'Q', answer: 'A', choices: ['A','B','C','D'], correctIndex: 0, difficulty: 2 }
      ]);

      await mgr.showAIGenerateMenu();

      expect(mockGame.changeScreen).toHaveBeenCalled();
      expect(mockGame.isGenerating).toBe(false);
    });

    it('API 에러 시에도 락이 정상 해제되어야 한다', async () => {
      mockGame.showPrompt
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('2')
        .mockResolvedValueOnce('3');

      problemGeneratorService.generateProblems.mockRejectedValue(new Error('서버 에러'));

      await mgr.showAIGenerateMenu();

      expect(mgr._aiGenerating).toBe(false);
      expect(mockGame.isGenerating).toBe(false);
      expect(mockGame.showToast).toHaveBeenCalledTimes(1);
    });

    it('생성 후 다시 호출하면 정상 동작해야 한다 (락 해제 확인)', async () => {
      // 첫 번째: 취소
      mockGame.showPrompt.mockResolvedValueOnce(null);
      await mgr.showAIGenerateMenu();
      expect(mgr._aiGenerating).toBe(false);

      // 두 번째: 다시 취소
      mockGame.showPrompt.mockResolvedValueOnce(null);
      await mgr.showAIGenerateMenu();
      expect(mgr._aiGenerating).toBe(false);

      // showPrompt 2번 호출 확인 (각 호출당 1번)
      expect(mockGame.showPrompt).toHaveBeenCalledTimes(2);
    });
  });

  // ──────────────────────────────────────────
  // 화면 복구 안전망 테스트 (finally 블록)
  // ──────────────────────────────────────────
  describe('화면 복구 안전망', () => {
    it('DB 저장 중 에러가 발생해도 finally에서 상태가 복구되어야 한다', async () => {
      mockGame.showPrompt
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce('2')
        .mockResolvedValueOnce('3');

      problemGeneratorService.generateProblems.mockResolvedValue([
        { question: 'Q', answer: 'A', choices: ['A','B','C','D'], correctIndex: 0, difficulty: 2 }
      ]);
      // DB 저장 실패 → catch에서 에러 메시지 설정 → _finishAndShowResult 호출
      mockGame.db.add.mockRejectedValue(new Error('DB error'));

      await mgr.showAIGenerateMenu();

      expect(mockGame.isGenerating).toBe(false);
      expect(mockGame._needsRender).toBe(true);
      expect(mockGame.changeScreen).toHaveBeenCalledWith('main');
      expect(mgr._aiGenerating).toBe(false);
    });

    it('testAIGeneration에서 에러 발생 시에도 finally에서 _needsRender가 true여야 한다', async () => {
      geminiService.generateNewProblems.mockRejectedValue(new Error('네트워크 실패'));
      mockGame._needsRender = false;

      await mgr.testAIGeneration();

      expect(mockGame.isGenerating).toBe(false);
      expect(mockGame._needsRender).toBe(true);
      expect(mockGame.changeScreen).toHaveBeenCalledWith('main');
      expect(mgr._aiGenerating).toBe(false);
    });
  });

  // ──────────────────────────────────────────
  // testAIGeneration과 showAIGenerateMenu 상호 락 테스트
  // ──────────────────────────────────────────
  describe('교차 락 테스트', () => {

    it('testAIGeneration 실행 중 showAIGenerateMenu 호출이 차단되어야 한다', async () => {
      let resolveGenerate;
      geminiService.generateNewProblems.mockReturnValue(
        new Promise(r => { resolveGenerate = r; })
      );

      const p1 = mgr.testAIGeneration();
      expect(mgr._aiGenerating).toBe(true);

      // 동시에 showAIGenerateMenu 호출 → 락에 의해 차단
      const p2 = mgr.showAIGenerateMenu();
      expect(mockGame.showPrompt).not.toHaveBeenCalled();

      resolveGenerate({ problems: [{ question: 'Q', answer: 'A', difficulty: 1 }] });
      await p1;
      await p2;

      expect(mockGame.showToast).toHaveBeenCalledTimes(1);
    });

    it('showAIGenerateMenu 실행 중 testAIGeneration 호출이 차단되어야 한다', async () => {
      let resolvePrompt;
      mockGame.showPrompt.mockReturnValue(new Promise(r => { resolvePrompt = r; }));

      const p1 = mgr.showAIGenerateMenu();
      expect(mgr._aiGenerating).toBe(true);

      // 동시에 testAIGeneration 호출 → 락에 의해 차단
      const p2 = mgr.testAIGeneration();
      expect(geminiService.generateNewProblems).not.toHaveBeenCalled();

      resolvePrompt(null); // 취소
      await p1;
      await p2;

      expect(mgr._aiGenerating).toBe(false);
    });
  });
});
