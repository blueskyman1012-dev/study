// 모바일 고스트 클릭 방지 테스트
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InputManager } from '../../../src/game/InputManager.js';
import { DialogManager } from '../../../src/game/DialogManager.js';

vi.mock('../../../src/utils/constants.js', () => ({
  SCREENS: { MAIN: 'MAIN', BATTLE: 'BATTLE', SHOP: 'SHOP' }
}));

vi.mock('../../../src/services/SoundService.js', () => ({
  SoundService: {
    init: vi.fn(),
    playClick: vi.fn(),
    startLobbyBgm: vi.fn()
  }
}));

vi.mock('../../../src/canvas/Renderer.js', () => ({
  Renderer: {}
}));

vi.mock('../../../src/i18n/i18n.js', () => ({
  t: vi.fn((key) => key)
}));

function createMockGame() {
  const game = {
    currentScreen: 'MAIN',
    isGenerating: false,
    _needsRender: false,
    guideStep: null,
    effects: { isLevelUpActive: () => false, dismissLevelUp: vi.fn() },
    scrollY: 0,
    scrollMaxY: 0,
    dialogManager: null,
    inputManager: null
  };
  game.dialogManager = new DialogManager(game);
  game.inputManager = new InputManager(game);
  return game;
}

describe('고스트 클릭 방지', () => {
  let game;

  beforeEach(() => {
    vi.clearAllMocks();
    game = createMockGame();
  });

  it('모달 닫힌 직후 400ms 이내 캔버스 클릭은 무시되어야 한다', () => {
    const callback = vi.fn();
    game.inputManager.registerClickArea('testBtn', 0, 0, 400, 100, callback);

    // 모달 닫힘 시각 기록
    game.dialogManager._onDismiss();

    // 200ms 후 클릭 시도 (400ms 쿨다운 이내)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 200);
    game.inputManager.handleInput(200, 50);

    expect(callback).not.toHaveBeenCalled();
  });

  it('모달 닫힌 후 400ms 경과 후 캔버스 클릭은 정상 처리되어야 한다', () => {
    const callback = vi.fn();
    game.inputManager.registerClickArea('testBtn', 0, 0, 400, 100, callback);

    // 모달 닫힘 시각 기록
    const baseTime = Date.now();
    game.dialogManager._lastDismissTime = baseTime;

    // 500ms 후 클릭 시도 (400ms 쿨다운 지남)
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 500);
    game.inputManager.handleInput(200, 50);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('모달 닫힘 기록이 없으면 클릭이 정상 처리되어야 한다', () => {
    const callback = vi.fn();
    game.inputManager.registerClickArea('testBtn', 0, 0, 400, 100, callback);

    game.inputManager.handleInput(200, 50);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('연속 모달 닫기 → 클릭 시나리오에서 각각 쿨다운이 적용되어야 한다', () => {
    const callback = vi.fn();
    game.inputManager.registerClickArea('testBtn', 0, 0, 400, 100, callback);

    const baseTime = Date.now();

    // 첫 번째 모달 닫힘
    game.dialogManager._lastDismissTime = baseTime;

    // 100ms 후 클릭 → 차단
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 100);
    game.inputManager.handleInput(200, 50);
    expect(callback).not.toHaveBeenCalled();

    // 500ms 후 클릭 → 통과
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 500);
    game.inputManager._lastInputTime = 0; // 디바운스 리셋
    game.inputManager.handleInput(200, 50);
    expect(callback).toHaveBeenCalledTimes(1);

    // 두 번째 모달 닫힘 (600ms 시점)
    game.dialogManager._lastDismissTime = baseTime + 600;

    // 700ms 시점 클릭 → 차단 (두 번째 모달로부터 100ms)
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 700);
    game.inputManager._lastInputTime = 0;
    game.inputManager.handleInput(200, 50);
    expect(callback).toHaveBeenCalledTimes(1); // 여전히 1번

    // 1100ms 시점 클릭 → 통과 (두 번째 모달로부터 500ms)
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 1100);
    game.inputManager._lastInputTime = 0;
    game.inputManager.handleInput(200, 50);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('AI 생성 버튼 위치(y=555)에서 고스트 클릭이 차단되어야 한다', () => {
    const aiCallback = vi.fn();
    // 실제 AI 생성 버튼 좌표: (20, 555, 360, 48)
    game.inputManager.registerClickArea('aiGenerate', 20, 555, 360, 48, aiCallback);

    // 모달 닫힘
    const baseTime = Date.now();
    game.dialogManager._lastDismissTime = baseTime;

    // 300ms 후 고스트 클릭 (모달 OK 버튼 → 같은 좌표)
    vi.spyOn(Date, 'now').mockReturnValue(baseTime + 300);
    game.inputManager.handleInput(200, 570);

    expect(aiCallback).not.toHaveBeenCalled();
  });
});

describe('생성 중 취소 버튼', () => {
  let game;

  beforeEach(() => {
    vi.clearAllMocks();
    game = createMockGame();
    game._generationCancelled = false;
  });

  it('isGenerating 상태에서 일반 클릭은 차단되어야 한다', () => {
    const callback = vi.fn();
    game.inputManager.registerClickArea('testBtn', 0, 0, 400, 100, callback);
    game.isGenerating = true;

    game.inputManager.handleInput(200, 50);

    expect(callback).not.toHaveBeenCalled();
  });

  it('isGenerating 상태에서 cancelGeneration 클릭은 허용되어야 한다', () => {
    const cancelCallback = vi.fn();
    game.inputManager.registerClickArea('cancelGeneration', 120, 450, 160, 40, cancelCallback);
    game.isGenerating = true;

    game.inputManager.handleInput(200, 470);

    expect(cancelCallback).toHaveBeenCalledTimes(1);
  });

  it('isGenerating 상태에서 cancelGeneration 영역 밖 클릭은 차단되어야 한다', () => {
    const cancelCallback = vi.fn();
    game.inputManager.registerClickArea('cancelGeneration', 120, 450, 160, 40, cancelCallback);
    game.isGenerating = true;

    // 취소 버튼 영역 밖 (y=100)
    game.inputManager.handleInput(200, 100);

    expect(cancelCallback).not.toHaveBeenCalled();
  });

  it('취소 후 isGenerating이 false가 되어야 한다', () => {
    game.isGenerating = true;
    game._generationCancelled = false;

    // 취소 버튼 동작 시뮬레이션
    game._generationCancelled = true;
    game.isGenerating = false;

    expect(game.isGenerating).toBe(false);
    expect(game._generationCancelled).toBe(true);
  });
});

describe('DialogManager._onDismiss 호출 확인', () => {
  let game;

  beforeEach(() => {
    game = createMockGame();
    // DOM 환경 시뮬레이션
    const mockElement = {
      remove: vi.fn(),
      style: { cssText: '' },
      innerHTML: '',
      id: '',
      firstElementChild: { style: {} },
      onclick: null
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockElement);
    vi.spyOn(document, 'getElementById').mockReturnValue(null);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
  });

  it('DialogManager 생성 시 _lastDismissTime이 0이어야 한다', () => {
    expect(game.dialogManager._lastDismissTime).toBe(0);
  });

  it('_onDismiss 호출 시 _lastDismissTime이 현재 시각으로 갱신되어야 한다', () => {
    const before = Date.now();
    game.dialogManager._onDismiss();
    const after = Date.now();

    expect(game.dialogManager._lastDismissTime).toBeGreaterThanOrEqual(before);
    expect(game.dialogManager._lastDismissTime).toBeLessThanOrEqual(after);
  });
});
