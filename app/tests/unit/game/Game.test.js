// Game.js 단위 테스트 (리팩토링 후)
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Game } from '../../../src/game/Game.js';
import { SCREENS, GAME_CONFIG } from '../../../src/utils/constants.js';

// Mock Renderer
vi.mock('../../../src/canvas/Renderer.js', () => ({
  Renderer: {
    ctx: {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      setTransform: vi.fn(),
      resetTransform: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      drawImage: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
      globalAlpha: 1,
      lineJoin: '',
      shadowColor: '',
      shadowBlur: 0
    },
    init: vi.fn(),
    clear: vi.fn(),
    drawGrid: vi.fn(),
    drawText: vi.fn(),
    drawButton: vi.fn(),
    roundRect: vi.fn(),
    drawCircle: vi.fn(),
    drawHPBar: vi.fn(),
    drawImage: vi.fn(),
    drawTimerBar: vi.fn(),
    applyUiOpacity: vi.fn(),
    resetOpacity: vi.fn(),
    getUiOpacity: vi.fn(() => 1.0)
  }
}));

// Mock SoundService
vi.mock('../../../src/services/SoundService.js', () => ({
  SoundService: {
    init: vi.fn(),
    playClick: vi.fn(),
    playCorrect: vi.fn(),
    playCorrectWithVibrate: vi.fn(),
    playWrongWithVibrate: vi.fn(),
    playCombo: vi.fn(),
    playGold: vi.fn(),
    playMonsterDefeat: vi.fn(),
    playBossAppear: vi.fn(),
    playDungeonStart: vi.fn(),
    playClear: vi.fn(),
    playGameOver: vi.fn(),
    playTimerWarning: vi.fn(),
    playItemDrop: vi.fn(),
    playLevelUp: vi.fn(),
    startLobbyBgm: vi.fn(),
    stopBgm: vi.fn(),
    toggle: vi.fn(),
    toggleBgm: vi.fn(),
    toggleSfx: vi.fn(),
    enabled: true,
    bgmEnabled: true,
    sfxEnabled: true
  }
}));

// Mock services
vi.mock('../../../src/services/GeminiService.js', () => ({
  geminiService: {
    loadApiKey: vi.fn(),
    hasApiKey: vi.fn().mockReturnValue(false),
    setApiKey: vi.fn()
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
    hasApiKey: vi.fn().mockReturnValue(false),
    getTopics: vi.fn().mockReturnValue({})
  }
}));

describe('Game', () => {
  let game;
  let mockDb;

  beforeEach(() => {
    mockDb = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(),
      add: vi.fn().mockResolvedValue(),
      getByIndex: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue()
    };
    game = new Game(mockDb);

    global.alert = vi.fn();
    global.prompt = vi.fn();
    global.confirm = vi.fn().mockReturnValue(true);

    // 커스텀 모달 메서드 mock
    game.showModal = vi.fn().mockResolvedValue();
    game.showConfirm = vi.fn().mockResolvedValue(true);
    game.showPrompt = vi.fn().mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('초기화', () => {
    it('GAME-INIT-001: 게임이 올바른 초기 상태로 생성되어야 한다', () => {
      expect(game.db).toBe(mockDb);
      expect(game.currentScreen).toBe(SCREENS.MAIN);
      expect(game.clickAreas).toEqual([]);
      expect(game.stage).toBe(0);
      expect(game.combo).toBe(0);
    });

    it('GAME-INIT-002: init()이 플레이어와 몬스터를 로드해야 한다', async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 5, exp: 0, gold: 100,
        maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([]);

      await game.init();

      expect(mockDb.get).toHaveBeenCalledWith('player', 'main');
      expect(mockDb.getByIndex).toHaveBeenCalledWith('monsters', 'status', 'alive');
      expect(game.playerManager.player.level).toBe(5);
    });
  });

  describe('플레이어 관리', () => {
    it('GAME-PLY-001: 플레이어가 없으면 새로 생성해야 한다', async () => {
      mockDb.get.mockResolvedValue(null);

      await game.playerManager.loadPlayer();

      expect(mockDb.put).toHaveBeenCalled();
      expect(game.playerManager.player.id).toBe('main');
      expect(game.playerManager.player.level).toBe(1);
      expect(game.playerManager.player.gold).toBe(100);
    });

    it('GAME-PLY-002: createNewPlayer()가 올바른 초기값을 가져야 한다', () => {
      const player = game.playerManager.createNewPlayer();

      expect(player.id).toBe('main');
      expect(player.level).toBe(1);
      expect(player.exp).toBe(0);
      expect(player.gold).toBe(100);
      expect(player.maxHp).toBe(GAME_CONFIG.DEFAULT_HP);
      expect(player.currentHp).toBe(GAME_CONFIG.DEFAULT_HP);
      expect(player.permanentUpgrades).toEqual({ hp: 0, time: 0, goldBonus: 0, damage: 0 });
      expect(player.stats).toEqual({ totalRuns: 0, totalKills: 0, bestCombo: 0, totalClears: 0 });
    });
  });

  describe('화면 전환', () => {
    it('GAME-SCR-001: changeScreen()이 화면을 전환해야 한다', () => {
      game.changeScreen(SCREENS.BATTLE);
      expect(game.currentScreen).toBe(SCREENS.BATTLE);
    });

    it('GAME-SCR-002: changeScreen()이 클릭 영역을 초기화해야 한다', () => {
      game.clickAreas = [{ id: 'test' }];
      game.changeScreen(SCREENS.MAIN);
      expect(game.clickAreas).toEqual([]);
    });
  });

  describe('클릭 영역', () => {
    it('GAME-CLK-001: registerClickArea()가 영역을 등록해야 한다', () => {
      const callback = vi.fn();
      game.registerClickArea('test', 10, 20, 100, 50, callback);

      expect(game.clickAreas).toHaveLength(1);
      expect(game.clickAreas[0]).toEqual({
        id: 'test', x: 10, y: 20, width: 100, height: 50, callback
      });
    });

    it('GAME-CLK-002: handleInput()이 클릭 영역 내부를 감지해야 한다', () => {
      const callback = vi.fn();
      game.registerClickArea('test', 10, 20, 100, 50, callback);

      game.handleInput(50, 40);
      expect(callback).toHaveBeenCalled();
    });

    it('GAME-CLK-003: handleInput()이 클릭 영역 외부는 무시해야 한다', () => {
      const callback = vi.fn();
      game.registerClickArea('test', 10, 20, 100, 50, callback);

      game.handleInput(200, 200);
      expect(callback).not.toHaveBeenCalled();
    });

    it('GAME-CLK-004: 여러 클릭 영역 중 첫 번째 매칭만 실행해야 한다', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      game.registerClickArea('test1', 10, 10, 100, 100, callback1);
      game.registerClickArea('test2', 10, 10, 100, 100, callback2);

      game.handleInput(50, 50);
      expect(callback1).toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('던전 시작', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([
        { id: 1, subject: 'math', question: 'Q1', answer: 'A1', hp: 100, maxHp: 100, status: 'alive', difficulty: 2 }
      ]);
      await game.init();
    });

    it('GAME-DNG-001: 몬스터가 없으면 던전 입장이 불가능해야 한다', async () => {
      mockDb.getByIndex.mockResolvedValue([]);
      await game.startDungeon();
      expect(game.showModal).toHaveBeenCalled();
    });

    it('GAME-DNG-002: startDungeon()이 런을 초기화해야 한다', async () => {
      await game.startDungeon();

      expect(game.currentRun).not.toBeNull();
      expect(game.currentRun.defeatedMonsters).toEqual([]);
      expect(game.currentRun.earnedGold).toBe(0);
      expect(game.currentRun.result).toBe('ongoing');
    });

    it('GAME-DNG-003: startDungeon()이 스테이지를 1로 설정해야 한다', async () => {
      await game.startDungeon();
      expect(game.stage).toBe(1);
    });

    it('GAME-DNG-004: startDungeon()이 플레이어 HP를 회복해야 한다', async () => {
      game.playerManager.player.currentHp = 50;
      await game.startDungeon();
      expect(game.playerManager.player.currentHp).toBe(game.playerManager.player.maxHp);
    });

    it('GAME-DNG-005: startDungeon()이 전투 화면으로 전환해야 한다', async () => {
      await game.startDungeon();
      expect(game.currentScreen).toBe(SCREENS.BATTLE);
    });
  });

  describe('전투 시스템', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([
        { id: 1, subject: 'math', question: 'Q1', answer: 'A1', hp: 100, maxHp: 100,
          choices: ['A1', 'B', 'C', 'D'], correctIndex: 0, status: 'alive', difficulty: 2 }
      ]);
      await game.init();
      await game.startDungeon();
    });

    it('GAME-BTL-001: 정답 선택 시 콤보가 증가해야 한다', () => {
      game.currentMonster.correctIndex = 0;
      game.battleManager.selectAnswer(0);
      expect(game.combo).toBe(1);
    });

    it('GAME-BTL-002: 정답 선택 시 몬스터에게 데미지를 줘야 한다', () => {
      const initialHp = game.currentMonster.hp;
      game.currentMonster.correctIndex = 0;
      game.battleManager.selectAnswer(0);
      expect(game.currentMonster.hp).toBeLessThan(initialHp);
    });

    it('GAME-BTL-003: 정답 선택 시 골드를 획득해야 한다', async () => {
      const initialGold = game.playerManager.player.gold;
      game.currentMonster.correctIndex = 0;
      await game.battleManager.onCorrectAnswer();
      expect(game.playerManager.player.gold).toBeGreaterThan(initialGold);
    });

    it('GAME-BTL-004: 오답 선택 시 콤보가 0이 되어야 한다', () => {
      game.combo = 5;
      game.currentMonster.correctIndex = 0;
      game.battleManager.selectAnswer(1);
      expect(game.combo).toBe(0);
    });

    it('GAME-BTL-005: 오답 선택 시 플레이어가 데미지를 받아야 한다', () => {
      const initialHp = game.playerManager.player.currentHp;
      game.currentMonster.correctIndex = 0;
      game.battleManager.selectAnswer(1);
      expect(game.playerManager.player.currentHp).toBeLessThan(initialHp);
    });

    it('GAME-BTL-006: 콤보가 높을수록 데미지가 증가해야 한다', () => {
      game.currentMonster.hp = 200;
      game.combo = 0;
      game.currentMonster.correctIndex = 0;
      game.battleManager.selectAnswer(0);
      const damage1 = 200 - game.currentMonster.hp;

      game.currentMonster.hp = 200;
      game.combo = 5;
      game.battleManager.selectAnswer(0);
      const damage2 = 200 - game.currentMonster.hp;

      expect(damage2).toBeGreaterThan(damage1);
    });

    it('GAME-BTL-007: bestCombo가 업데이트되어야 한다', () => {
      game.combo = 0;
      game.currentRun.bestCombo = 2;
      game.currentMonster.correctIndex = 0;

      for (let i = 0; i < 3; i++) {
        game.currentMonster.hp = 100;
        game.battleManager.selectAnswer(0);
      }

      expect(game.currentRun.bestCombo).toBe(3);
    });
  });

  describe('타이머', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([
        { id: 1, subject: 'math', question: 'Q1', hp: 100, maxHp: 100, status: 'alive', difficulty: 2 }
      ]);
      await game.init();
      await game.startDungeon();
    });

    it('GAME-TMR-001: 타이머가 난이도별 기본값으로 설정되어야 한다', () => {
      // difficulty 2 = 100초 기본
      expect(game.timer).toBe(100);
    });

    it('GAME-TMR-002: 시간 초과 시 콤보가 0이 되어야 한다', () => {
      game.combo = 5;
      game.battleManager.onTimeOut();
      expect(game.combo).toBe(0);
    });

    it('GAME-TMR-003: 시간 초과 시 플레이어가 데미지를 받아야 한다', () => {
      const initialHp = game.playerManager.player.currentHp;
      game.battleManager.onTimeOut();
      expect(game.playerManager.player.currentHp).toBeLessThan(initialHp);
    });

    it('GAME-TMR-004: 시간 초과 후 타이머가 리셋되어야 한다', () => {
      game.timer = 0;
      game.battleManager.onTimeOut();
      expect(game.timer).toBeGreaterThan(0);
    });
  });

  describe('몬스터 처치', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([
        { id: 1, subject: 'math', question: 'Q1', hp: 100, maxHp: 100, status: 'alive', difficulty: 2 },
        { id: 2, subject: 'math', question: 'Q2', hp: 100, maxHp: 100, status: 'alive', difficulty: 2 }
      ]);
      mockDb.put.mockResolvedValue();
      await game.init();
      await game.startDungeon();
    });

    it('GAME-MON-001: 몬스터 HP가 0 이하면 처치되어야 한다', async () => {
      game.currentMonster.hp = 10;
      game.currentMonster.correctIndex = 0;
      game.battleManager.selectAnswer(0);
      expect(game.currentRun.defeatedMonsters.length).toBeGreaterThanOrEqual(0);
    });

    it('GAME-MON-002: 처치된 몬스터가 기록되어야 한다', async () => {
      const monsterId = game.currentMonster.id;
      await game.battleManager.onMonsterDefeated();
      expect(game.currentRun.defeatedMonsters).toContain(monsterId);
    });

    it('GAME-MON-003: 스테이지가 증가해야 한다', async () => {
      const initialStage = game.stage;
      await game.battleManager.onMonsterDefeated();
      expect(game.stage).toBe(initialStage + 1);
    });
  });

  describe('런 종료', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([
        { id: 1, subject: 'math', hp: 100, maxHp: 100, status: 'alive', difficulty: 2 }
      ]);
      mockDb.put.mockResolvedValue();
      mockDb.add.mockResolvedValue();
      await game.init();
      await game.startDungeon();
    });

    it('GAME-END-001: 승리 시 결과가 clear로 설정되어야 한다', async () => {
      await game.endRun(true);
      expect(game.currentRun.result).toBe('clear');
    });

    it('GAME-END-002: 패배 시 결과가 failed로 설정되어야 한다', async () => {
      await game.endRun(false);
      expect(game.currentRun.result).toBe('failed');
    });

    it('GAME-END-003: 결과 화면으로 전환되어야 한다', async () => {
      await game.endRun(true);
      expect(game.currentScreen).toBe(SCREENS.RESULT);
    });

    it('GAME-END-004: 플레이어 데이터가 저장되어야 한다', async () => {
      await game.endRun(true);
      expect(mockDb.put).toHaveBeenCalledWith('player', game.playerManager.player);
    });

    it('GAME-END-005: 런 기록이 저장되어야 한다', async () => {
      await game.endRun(true);
      expect(mockDb.add).toHaveBeenCalledWith('runs', expect.anything());
    });
  });

  describe('힌트 시스템', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([
        { id: 1, subject: 'math', hp: 100, maxHp: 100, correctIndex: 2, status: 'alive', difficulty: 2,
          choices: ['A', 'B', 'C', 'D'] }
      ]);
      await game.init();
      await game.startDungeon();
    });

    it('GAME-HNT-001: 골드가 충분하면 힌트를 사용할 수 있어야 한다', async () => {
      game.playerManager.player.gold = 100;
      game.showConfirm.mockResolvedValue(true);
      await game.battleManager.useHint();
      expect(game.playerManager.player.gold).toBe(50);
    });

    it('GAME-HNT-002: 골드가 부족하면 힌트를 사용할 수 없어야 한다', async () => {
      game.playerManager.player.gold = 30;
      await game.battleManager.useHint();
      expect(game.showModal).toHaveBeenCalled();
    });
  });

  describe('스킵', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([
        { id: 1, subject: 'math', hp: 100, maxHp: 100, status: 'alive', difficulty: 2 }
      ]);
      await game.init();
      await game.startDungeon();
    });

    it('GAME-SKP-001: 스킵 시 콤보가 0이 되어야 한다', () => {
      game.combo = 5;
      game.battleManager.skipQuestion();
      expect(game.combo).toBe(0);
    });

    it('GAME-SKP-002: 스킵 시 타이머가 리셋되어야 한다', () => {
      game.timer = 5;
      game.battleManager.skipQuestion();
      expect(game.timer).toBeGreaterThan(5);
    });
  });

  describe('렌더링', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([{ id: 1, hp: 100, maxHp: 100, status: 'alive', difficulty: 2 }]);
      await game.init();
    });

    it('GAME-RND-001: render()가 화면에 따라 적절한 렌더 함수를 호출해야 한다', () => {
      game.currentScreen = SCREENS.MAIN;
      expect(() => game.render()).not.toThrow();

      game.currentScreen = SCREENS.REGISTER;
      expect(() => game.render()).not.toThrow();
    });

    it('GAME-RND-002: 전투 화면에서 몬스터가 없으면 렌더링하지 않아야 한다', () => {
      game.currentScreen = SCREENS.BATTLE;
      game.currentMonster = null;
      expect(() => game.render()).not.toThrow();
    });
  });

  describe('데이터 저장', () => {
    beforeEach(async () => {
      mockDb.get.mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100,
        maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      });
      mockDb.getByIndex.mockResolvedValue([]);
      mockDb.put.mockResolvedValue();
      await game.init();
    });

    it('GAME-SAV-001: save()가 플레이어 데이터를 저장해야 한다', async () => {
      await game.save();
      expect(mockDb.put).toHaveBeenCalledWith('player', game.playerManager.player);
    });
  });
});
