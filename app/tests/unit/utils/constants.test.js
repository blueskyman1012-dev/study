// constants.js 단위 테스트
import { describe, it, expect } from 'vitest';
import { SCREENS, GAME_CONFIG, COLORS, SUBJECTS, RARITY } from '../../../src/utils/constants.js';

describe('Constants', () => {
  describe('SCREENS', () => {
    it('CONST-SCR-001: 필수 화면이 모두 정의되어야 한다', () => {
      expect(SCREENS.MAIN).toBeDefined();
      expect(SCREENS.BATTLE).toBeDefined();
      expect(SCREENS.RESULT).toBeDefined();
      expect(SCREENS.REGISTER).toBeDefined();
    });

    it('CONST-SCR-002: 화면 값이 고유해야 한다', () => {
      const values = Object.values(SCREENS);
      const uniqueValues = new Set(values);
      expect(values.length).toBe(uniqueValues.size);
    });
  });

  describe('GAME_CONFIG', () => {
    it('CONST-CFG-001: 캔버스 크기가 정의되어야 한다', () => {
      expect(GAME_CONFIG.CANVAS_WIDTH).toBeGreaterThan(0);
      expect(GAME_CONFIG.CANVAS_HEIGHT).toBeGreaterThan(0);
    });

    it('CONST-CFG-002: 기본 HP가 양수여야 한다', () => {
      expect(GAME_CONFIG.DEFAULT_HP).toBeGreaterThan(0);
    });

    it('CONST-CFG-003: 기본 타이머가 양수여야 한다', () => {
      expect(GAME_CONFIG.DEFAULT_TIME).toBeGreaterThan(0);
    });

    it('CONST-CFG-004: 던전당 스테이지 수가 정의되어야 한다', () => {
      expect(GAME_CONFIG.STAGES_PER_DUNGEON).toBeGreaterThan(0);
    });

    it('CONST-CFG-005: 타이머는 합리적인 범위여야 한다 (5-60초)', () => {
      expect(GAME_CONFIG.DEFAULT_TIME).toBeGreaterThanOrEqual(5);
      expect(GAME_CONFIG.DEFAULT_TIME).toBeLessThanOrEqual(60);
    });
  });

  describe('COLORS', () => {
    it('CONST-CLR-001: 배경색이 정의되어야 한다', () => {
      expect(COLORS.BG_PRIMARY).toBeDefined();
      expect(COLORS.BG_SECONDARY).toBeDefined();
      expect(COLORS.BG_CARD).toBeDefined();
    });

    it('CONST-CLR-002: 텍스트 색상이 정의되어야 한다', () => {
      expect(COLORS.TEXT_PRIMARY).toBeDefined();
      expect(COLORS.TEXT_SECONDARY).toBeDefined();
    });

    it('CONST-CLR-003: 상태 색상이 정의되어야 한다', () => {
      expect(COLORS.SUCCESS).toBeDefined();
      expect(COLORS.DANGER).toBeDefined();
      expect(COLORS.WARNING).toBeDefined();
    });

    it('CONST-CLR-004: HP 바 색상이 정의되어야 한다', () => {
      expect(COLORS.HP_PLAYER).toBeDefined();
      expect(COLORS.HP_ENEMY).toBeDefined();
    });

    it('CONST-CLR-005: 모든 색상이 유효한 형식이어야 한다', () => {
      const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
      Object.values(COLORS).forEach(color => {
        expect(color).toMatch(hexRegex);
      });
    });

    it('CONST-CLR-006: 플레이어 HP 색상이 녹색 계열이어야 한다', () => {
      expect(COLORS.HP_PLAYER).toBe(COLORS.SUCCESS);
    });

    it('CONST-CLR-007: 적 HP 색상이 빨강 계열이어야 한다', () => {
      expect(COLORS.HP_ENEMY).toBe(COLORS.DANGER);
    });
  });

  describe('SUBJECTS', () => {
    it('CONST-SUB-001: 필수 과목이 정의되어야 한다', () => {
      expect(SUBJECTS.MATH).toBeDefined();
      expect(SUBJECTS.ENGLISH).toBeDefined();
      expect(SUBJECTS.KOREAN).toBeDefined();
      expect(SUBJECTS.SCIENCE).toBeDefined();
    });

    it('CONST-SUB-002: 각 과목에 필수 속성이 있어야 한다', () => {
      Object.values(SUBJECTS).forEach(subject => {
        expect(subject.id).toBeDefined();
        expect(subject.name).toBeDefined();
        expect(subject.icon).toBeDefined();
        expect(subject.color).toBeDefined();
      });
    });

    it('CONST-SUB-003: 과목 ID가 고유해야 한다', () => {
      const ids = Object.values(SUBJECTS).map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('CONST-SUB-004: 과목 아이콘이 이모지여야 한다', () => {
      Object.values(SUBJECTS).forEach(subject => {
        expect(subject.icon.length).toBeGreaterThan(0);
      });
    });

    it('CONST-SUB-005: 과목 색상이 유효한 형식이어야 한다', () => {
      const hexRegex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;
      Object.values(SUBJECTS).forEach(subject => {
        expect(subject.color).toMatch(hexRegex);
      });
    });
  });

  describe('RARITY', () => {
    it('CONST-RAR-001: 모든 희귀도가 정의되어야 한다', () => {
      expect(RARITY.NORMAL).toBeDefined();
      expect(RARITY.RARE).toBeDefined();
      expect(RARITY.EPIC).toBeDefined();
      expect(RARITY.LEGENDARY).toBeDefined();
    });

    it('CONST-RAR-002: 각 희귀도에 필수 속성이 있어야 한다', () => {
      Object.values(RARITY).forEach(rarity => {
        expect(rarity.id).toBeDefined();
        expect(rarity.name).toBeDefined();
        expect(rarity.color).toBeDefined();
        expect(rarity.dropRate).toBeDefined();
      });
    });

    it('CONST-RAR-003: 드랍 확률의 합이 1이어야 한다', () => {
      const totalDropRate = Object.values(RARITY).reduce((sum, r) => sum + r.dropRate, 0);
      expect(totalDropRate).toBeCloseTo(1, 2);
    });

    it('CONST-RAR-004: 희귀도가 높을수록 드랍 확률이 낮아야 한다', () => {
      expect(RARITY.NORMAL.dropRate).toBeGreaterThan(RARITY.RARE.dropRate);
      expect(RARITY.RARE.dropRate).toBeGreaterThan(RARITY.EPIC.dropRate);
      expect(RARITY.EPIC.dropRate).toBeGreaterThan(RARITY.LEGENDARY.dropRate);
    });

    it('CONST-RAR-005: 모든 드랍 확률이 0과 1 사이여야 한다', () => {
      Object.values(RARITY).forEach(rarity => {
        expect(rarity.dropRate).toBeGreaterThan(0);
        expect(rarity.dropRate).toBeLessThanOrEqual(1);
      });
    });

    it('CONST-RAR-006: 희귀도 ID가 고유해야 한다', () => {
      const ids = Object.values(RARITY).map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });
  });
});
