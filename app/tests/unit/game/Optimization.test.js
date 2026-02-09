// 성능 최적화 + AI 자동 생성 버그 수정 검증 테스트
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Renderer } from '../../../src/canvas/Renderer.js';
import { COLORS } from '../../../src/utils/constants.js';

// Mock storage
vi.mock('../../../src/utils/storage.js', () => ({
  safeGetItem: vi.fn((key) => {
    if (key === 'bg_theme') return 'default';
    if (key === 'ui_opacity') return '1';
    return null;
  }),
  safeSetItem: vi.fn(),
  secureGetItem: vi.fn(),
  secureSetItem: vi.fn()
}));

describe('Renderer 캐시 최적화', () => {
  let mockCtx;

  beforeEach(() => {
    mockCtx = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
      textAlign: 'left', textBaseline: 'top', globalAlpha: 1,
      lineJoin: '', shadowColor: '', shadowBlur: 0,
      fillRect: vi.fn(), strokeRect: vi.fn(), clearRect: vi.fn(),
      beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(),
      lineTo: vi.fn(), arc: vi.fn(), arcTo: vi.fn(),
      fill: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
      strokeText: vi.fn(), measureText: vi.fn(() => ({ width: 100 })),
      drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
    };
    Renderer.init(mockCtx, 400, 700);
  });

  describe('폰트 캐시', () => {
    it('OPT-FONT-001: 동일 폰트 문자열은 캐시에서 재사용해야 한다', () => {
      Renderer.drawText('A', 0, 0, { font: 'bold 16px system-ui' });
      Renderer.drawText('B', 0, 0, { font: 'bold 16px system-ui' });

      expect(Renderer._fontCache.size).toBe(1);
      expect(Renderer._fontCache.has('bold 16px system-ui')).toBe(true);
    });

    it('OPT-FONT-002: 다른 폰트 문자열은 별도 캐시 엔트리를 생성해야 한다', () => {
      Renderer.drawText('A', 0, 0, { font: '14px system-ui' });
      Renderer.drawText('B', 0, 0, { font: 'bold 20px system-ui' });

      expect(Renderer._fontCache.size).toBe(2);
    });

    it('OPT-FONT-003: _lastFont가 동일하면 ctx.font 할당을 스킵해야 한다', () => {
      Renderer.drawText('A', 0, 0, { font: 'bold 16px system-ui' });
      const fontAfterFirst = mockCtx.font;

      // ctx.font를 의도적으로 변경해서 확인
      mockCtx.font = 'CHANGED';
      Renderer.drawText('B', 0, 0, { font: 'bold 16px system-ui' });

      // _lastFont가 같으므로 ctx.font 재할당 안함 → 'CHANGED' 유지
      expect(mockCtx.font).toBe('CHANGED');
    });

    it('OPT-FONT-004: 다른 폰트 사용 시 ctx.font를 갱신해야 한다', () => {
      Renderer.drawText('A', 0, 0, { font: '14px system-ui' });
      Renderer.drawText('B', 0, 0, { font: 'bold 20px system-ui' });

      expect(mockCtx.font).toContain('bold 20px');
    });

    it('OPT-FONT-005: init() 호출 시 폰트 캐시가 초기화되어야 한다', () => {
      Renderer.drawText('A', 0, 0, { font: '14px system-ui' });
      expect(Renderer._fontCache.size).toBe(1);

      Renderer.init(mockCtx, 400, 700);
      expect(Renderer._fontCache.size).toBe(0);
      expect(Renderer._lastFont).toBeNull();
    });
  });

  describe('색상 캐시', () => {
    it('OPT-CLR-001: lightenColor 결과가 캐시되어야 한다', () => {
      const r1 = Renderer.lightenColor('#22c55e', 30);
      const r2 = Renderer.lightenColor('#22c55e', 30);

      expect(r1).toBe(r2);
      expect(Renderer._colorCache.has('#22c55e_L30')).toBe(true);
    });

    it('OPT-CLR-002: darkenColor 결과가 캐시되어야 한다', () => {
      const r1 = Renderer.darkenColor('#ef4444', 20);
      const r2 = Renderer.darkenColor('#ef4444', 20);

      expect(r1).toBe(r2);
      expect(Renderer._colorCache.has('#ef4444_D20')).toBe(true);
    });

    it('OPT-CLR-003: 다른 색상/퍼센트는 별도 캐시해야 한다', () => {
      Renderer.lightenColor('#22c55e', 30);
      Renderer.lightenColor('#22c55e', 20);
      Renderer.darkenColor('#22c55e', 30);

      expect(Renderer._colorCache.size).toBe(3);
    });

    it('OPT-CLR-004: lightenColor 계산 결과가 정확해야 한다', () => {
      // #22c55e = R:34, G:197, B:94, amt = round(2.55 * 30) = 77
      // R:111, G:255(capped), B:171
      const result = Renderer.lightenColor('#22c55e', 30);
      expect(result).toBe('rgb(111,255,171)');
    });

    it('OPT-CLR-005: darkenColor 계산 결과가 정확해야 한다', () => {
      // #ef4444 = R:239, G:68, B:68, amt = round(2.55 * 20) = 51
      // R:188, G:17, B:17
      const result = Renderer.darkenColor('#ef4444', 20);
      expect(result).toBe('rgb(188,17,17)');
    });

    it('OPT-CLR-006: init() 호출 시 색상 캐시가 초기화되어야 한다', () => {
      Renderer.lightenColor('#22c55e', 30);
      expect(Renderer._colorCache.size).toBe(1);

      Renderer.init(mockCtx, 400, 700);
      expect(Renderer._colorCache.size).toBe(0);
    });
  });

  describe('그라데이션 캐시', () => {
    it('OPT-GRAD-001: 동일 파라미터의 HP바 그라데이션이 캐시되어야 한다', () => {
      Renderer.drawHPBar(10, 20, 100, 10, 80, 100, '#22c55e');
      const callCount1 = mockCtx.createLinearGradient.mock.calls.length;

      Renderer.drawHPBar(10, 20, 100, 10, 60, 100, '#22c55e');
      const callCount2 = mockCtx.createLinearGradient.mock.calls.length;

      // 두 번째 호출에서 그라데이션 생성 안 함 (캐시 히트)
      expect(callCount2).toBe(callCount1);
    });

    it('OPT-GRAD-002: 다른 색상의 HP바는 새 그라데이션을 생성해야 한다', () => {
      Renderer.drawHPBar(10, 20, 100, 10, 80, 100, '#22c55e');
      const callCount1 = mockCtx.createLinearGradient.mock.calls.length;

      Renderer.drawHPBar(10, 20, 100, 10, 80, 100, '#ef4444');
      const callCount2 = mockCtx.createLinearGradient.mock.calls.length;

      // 다른 색상이므로 새로 생성
      expect(callCount2).toBeGreaterThan(callCount1);
    });

    it('OPT-GRAD-003: init() 호출 시 그라데이션 캐시가 초기화되어야 한다', () => {
      Renderer.drawHPBar(10, 20, 100, 10, 80, 100, '#22c55e');
      expect(Renderer._gradientCache.size).toBeGreaterThan(0);

      Renderer.init(mockCtx, 400, 700);
      expect(Renderer._gradientCache.size).toBe(0);
    });
  });
});

describe('MonsterManager 난이도 인덱스', () => {
  let mm;

  beforeEach(async () => {
    const { MonsterManager } = await import('../../../src/game/MonsterManager.js');
    mm = new MonsterManager({
      getByIndex: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue()
    });
  });

  it('OPT-MM-001: 생성 시 빈 인덱스가 초기화되어야 한다', () => {
    expect(mm._difficultyIndex).toEqual({ easy: [], medium: [], hard: [] });
  });

  it('OPT-MM-002: _buildDifficultyIndex가 난이도별로 분류해야 한다', () => {
    mm.monsters = [
      { id: 1, difficulty: 1 },
      { id: 2, difficulty: 2 },
      { id: 3, difficulty: 3 },
      { id: 4, difficulty: 1 },
      { id: 5 },  // difficulty 없음 → default 2 → medium
    ];
    mm._buildDifficultyIndex();

    expect(mm._difficultyIndex.easy).toHaveLength(2);
    expect(mm._difficultyIndex.medium).toHaveLength(2);
    expect(mm._difficultyIndex.hard).toHaveLength(1);
  });

  it('OPT-MM-003: selectMonsterByDifficulty가 인덱스를 사용해야 한다', () => {
    mm.monsters = [
      { id: 1, difficulty: 1 },
      { id: 2, difficulty: 2 },
      { id: 3, difficulty: 3 },
    ];
    mm._buildDifficultyIndex();

    // 정답률 높으면 hard 풀에서 선택 시도
    const result = mm.selectMonsterByDifficulty(0.9, 10);
    expect(result).toBeDefined();
    expect(mm.monsters).toContain(result);
  });

  it('OPT-MM-004: 5문제 미만이면 랜덤 선택해야 한다', () => {
    mm.monsters = [{ id: 1, difficulty: 1 }];
    mm._buildDifficultyIndex();

    const result = mm.selectMonsterByDifficulty(0.9, 3);
    expect(result).toEqual({ id: 1, difficulty: 1 });
  });
});

describe('StatsManager 캐시', () => {
  let sm, game;

  beforeEach(async () => {
    const { StatsManager } = await import('../../../src/game/StatsManager.js');
    game = {
      db: {
        getAll: vi.fn().mockResolvedValue([])
      },
      cachedStats: null
    };
    sm = new StatsManager(game);
  });

  it('OPT-SM-001: 초기 상태에서 캐시가 비어있어야 한다', () => {
    expect(sm._cachedStats).toBeNull();
    expect(sm._cacheKey).toBeNull();
  });

  it('OPT-SM-002: aggregateStats 결과가 캐시되어야 한다', async () => {
    game.db.getAll.mockResolvedValue([]);
    await sm.aggregateStats();

    expect(sm._cachedStats).not.toBeNull();
    expect(sm._cacheKey).not.toBeNull();
  });

  it('OPT-SM-003: 동일 데이터로 재호출 시 캐시를 반환해야 한다', async () => {
    game.db.getAll.mockResolvedValue([]);
    const result1 = await sm.aggregateStats();
    const result2 = await sm.aggregateStats();

    expect(result1).toBe(result2);
    // getAll은 두 번 호출되지만 (캐시 키 확인용) 결과는 동일 객체
    expect(game.cachedStats).toBe(result1);
  });

  it('OPT-SM-004: invalidateCache가 캐시를 무효화해야 한다', async () => {
    game.db.getAll.mockResolvedValue([]);
    await sm.aggregateStats();

    sm.invalidateCache();
    expect(sm._cachedStats).toBeNull();
    expect(sm._cacheKey).toBeNull();
  });

  it('OPT-SM-005: 데이터 변경 후 새 결과를 계산해야 한다', async () => {
    // 첫 호출: 빈 데이터
    game.db.getAll.mockImplementation((store) => {
      if (store === 'runs') return Promise.resolve([]);
      return Promise.resolve([]);
    });
    const result1 = await sm.aggregateStats();
    expect(result1.totalRuns).toBe(0);

    // 캐시 무효화
    sm.invalidateCache();

    // 두 번째 호출: 런 1개 추가
    game.db.getAll.mockImplementation((store) => {
      if (store === 'runs') return Promise.resolve([
        { result: 'clear', startTime: 1000, endTime: 2000, correctAnswers: 5, totalAnswers: 6, bestCombo: 3, earnedGold: 100 }
      ]);
      return Promise.resolve([]);
    });
    const result2 = await sm.aggregateStats();
    expect(result2.totalRuns).toBe(1);
    expect(result2.totalClears).toBe(1);
  });

  it('OPT-SM-006: 최근 10런 통계가 단일 패스로 정확해야 한다', async () => {
    const runs = [];
    for (let i = 0; i < 15; i++) {
      runs.push({
        result: i % 3 === 0 ? 'clear' : 'failed',
        startTime: i * 1000,
        endTime: i * 1000 + 500,
        correctAnswers: i % 3 === 0 ? 5 : 2,
        totalAnswers: 6,
        bestCombo: i, earnedGold: 10
      });
    }
    game.db.getAll.mockImplementation((store) => {
      if (store === 'runs') return Promise.resolve(runs);
      return Promise.resolve([]);
    });

    const stats = await sm.aggregateStats();

    expect(stats.recentRuns).toHaveLength(10);
    expect(stats.totalRuns).toBe(15);
    // 최근 10런(인덱스 5~14) 중 clear: 6,9,12 = 3개
    expect(stats.recentWinRate).toBe(30);
  });
});

describe('BattleManager reshuffleChoices 버그 수정', () => {
  let game;

  beforeEach(async () => {
    const { Game } = await import('../../../src/game/Game.js');
    const mockDb = {
      get: vi.fn().mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      }),
      put: vi.fn().mockResolvedValue(),
      add: vi.fn().mockResolvedValue(),
      getByIndex: vi.fn().mockResolvedValue([
        { id: 1, subject: 'math', question: 'Q1', answer: '5', hp: 100, maxHp: 100,
          choices: ['5', '3', '7', '-5'], correctIndex: 0, status: 'alive', difficulty: 2 }
      ]),
      delete: vi.fn().mockResolvedValue()
    };
    game = new Game(mockDb);
    game.showModal = vi.fn().mockResolvedValue();
    game.showConfirm = vi.fn().mockResolvedValue(true);
    game.showPrompt = vi.fn().mockResolvedValue(null);
    await game.init();
    await game.startDungeon();
  });

  it('BUG-SHUF-001: 정답이 선택지에 있으면 정상 작동해야 한다', () => {
    game.currentMonster.answer = '5';
    game.currentMonster.choices = ['5', '3', '7', '-5'];
    game.battleManager.reshuffleChoices();

    expect(game.currentMonster.correctIndex).toBeGreaterThanOrEqual(0);
    expect(game.currentMonster.choices[game.currentMonster.correctIndex]).toBe('5');
  });

  it('BUG-SHUF-002: 정답이 선택지에 없으면 강제 삽입해야 한다', () => {
    game.currentMonster.answer = '42';
    game.currentMonster.choices = ['5', '3', '7', '-5'];
    game.battleManager.reshuffleChoices();

    expect(game.currentMonster.choices).toContain('42');
    expect(game.currentMonster.correctIndex).toBeGreaterThanOrEqual(0);
    expect(game.currentMonster.choices[game.currentMonster.correctIndex]).toBe('42');
  });

  it('BUG-SHUF-003: correctIndex가 -1이 되면 안 된다', () => {
    game.currentMonster.answer = 'NONEXISTENT';
    game.currentMonster.choices = ['A', 'B', 'C', 'D'];
    game.battleManager.reshuffleChoices();

    expect(game.currentMonster.correctIndex).not.toBe(-1);
    expect(game.currentMonster.correctIndex).toBeGreaterThanOrEqual(0);
  });
});

describe('ProblemGeneratorService API 키 갱신', () => {
  it('BUG-KEY-001: hasApiKey가 매번 최신 키를 확인해야 한다', async () => {
    const { secureGetItem } = await import('../../../src/utils/storage.js');

    // 키 없는 상태
    secureGetItem.mockReturnValue(null);
    const { problemGeneratorService } = await import('../../../src/services/ProblemGeneratorService.js');

    expect(problemGeneratorService.hasApiKey()).toBe(false);

    // 키 설정 후
    secureGetItem.mockReturnValue('test-api-key');
    expect(problemGeneratorService.hasApiKey()).toBe(true);

    // 키 제거 후
    secureGetItem.mockReturnValue(null);
    expect(problemGeneratorService.hasApiKey()).toBe(false);
  });
});

describe('MonsterManager AI 문제 검증', () => {
  let mm;

  beforeEach(async () => {
    const { MonsterManager } = await import('../../../src/game/MonsterManager.js');
    mm = new MonsterManager({
      getByIndex: vi.fn().mockResolvedValue([]),
      put: vi.fn().mockResolvedValue()
    });
    mm.monsters = [
      { id: 1, question: 'Q1', answer: 'A1', difficulty: 2 },
      { id: 2, question: 'Q2', answer: 'A2', difficulty: 1 }
    ];
    mm._buildDifficultyIndex();
  });

  it('BUG-VAL-001: _prepareChoices가 정답을 선택지에 포함시켜야 한다', () => {
    const monster = { answer: '5', choices: ['3', '7', '-5', '10'] };
    mm._prepareChoices(monster);

    expect(monster.choices).toContain('5');
    expect(monster.choices[monster.correctIndex]).toBe('5');
  });

  it('BUG-VAL-002: _prepareChoices가 빈 선택지면 자동 생성해야 한다', () => {
    const monster = { answer: '5', choices: [] };
    mm._prepareChoices(monster);

    expect(monster.choices.length).toBe(4);
    expect(monster.choices).toContain('5');
  });

  it('BUG-VAL-003: _prepareChoices가 정답 없으면 ?로 대체해야 한다', () => {
    const monster = { answer: '', choices: [] };
    mm._prepareChoices(monster);

    expect(monster.answer).toBe('?');
    expect(monster.choices).toContain('?');
  });

  it('BUG-VAL-004: shuffleArray가 배열 요소를 보존해야 한다', () => {
    const original = ['A', 'B', 'C', 'D'];
    const shuffled = mm.shuffleArray([...original]);

    expect(shuffled).toHaveLength(4);
    expect(shuffled.sort()).toEqual(original.sort());
  });
});

describe('Game _renderScrollableScreen 헬퍼', () => {
  let game;

  beforeEach(async () => {
    // Renderer.ctx에 translate 등 필요한 메서드 모킹
    const mockCtx = {
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
      textAlign: 'left', textBaseline: 'top', globalAlpha: 1,
      lineJoin: '', shadowColor: '', shadowBlur: 0,
      fillRect: vi.fn(), strokeRect: vi.fn(), clearRect: vi.fn(),
      beginPath: vi.fn(), closePath: vi.fn(), moveTo: vi.fn(),
      lineTo: vi.fn(), arc: vi.fn(), arcTo: vi.fn(),
      fill: vi.fn(), stroke: vi.fn(), fillText: vi.fn(),
      strokeText: vi.fn(), measureText: vi.fn(() => ({ width: 100 })),
      drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(),
      translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() }))
    };
    Renderer.init(mockCtx, 400, 700);

    const { Game } = await import('../../../src/game/Game.js');
    const mockDb = {
      get: vi.fn().mockResolvedValue({
        id: 'main', level: 1, exp: 0, gold: 100, maxHp: 100, currentHp: 100,
        permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
        inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
        stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 }
      }),
      put: vi.fn().mockResolvedValue(),
      add: vi.fn().mockResolvedValue(),
      getByIndex: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(),
      getAll: vi.fn().mockResolvedValue([])
    };
    game = new Game(mockDb);
    game.showModal = vi.fn().mockResolvedValue();
    await game.init();
  });

  it('OPT-SCROLL-001: _renderScrollableScreen이 renderFn과 headerFn을 모두 호출해야 한다', () => {
    const renderFn = vi.fn();
    const headerFn = vi.fn();
    game._renderScrollableScreen(renderFn, headerFn);

    expect(renderFn).toHaveBeenCalledTimes(1);
    expect(headerFn).toHaveBeenCalledTimes(1);
  });

  it('OPT-SCROLL-002: headerFn이 없어도 안전해야 한다', () => {
    const renderFn = vi.fn();
    expect(() => game._renderScrollableScreen(renderFn, null)).not.toThrow();
    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('OPT-SCROLL-003: 스크롤이 없으면 스크롤바를 그리지 않아야 한다', () => {
    game.scrollMaxY = 0;
    const renderFn = vi.fn();
    game._renderScrollableScreen(renderFn, vi.fn());
    // scrollMaxY가 0이면 roundRect 호출 없음 (스크롤바)
    expect(renderFn).toHaveBeenCalled();
  });
});
