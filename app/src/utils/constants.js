// 화면 상수
export const SCREENS = {
  MAIN: 'main',
  BATTLE: 'battle',
  RESULT: 'result',
  SHOP: 'shop',
  REGISTER: 'register',
  DUNGEON_SELECT: 'dungeon_select',
  SETTINGS: 'settings'
};

// 게임 설정
export const GAME_CONFIG = {
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 700,
  DEFAULT_HP: 100,
  DEFAULT_TIME: 60,
  DEFAULT_DAMAGE: 34,
  STAGES_PER_DUNGEON: 100
};

// 레벨 시스템 설정
export const LEVEL_CONFIG = {
  // 레벨당 필요 경험치 (100 기준, 10%씩 증가, 1의자리 반올림)
  expPerLevel: (level) => Math.round(100 * Math.pow(1.1, level - 1) / 10) * 10,
  // 레벨당 보너스
  hpPerLevel: 1,           // 1레벨당 HP +1
  damagePerLevels: 5,      // 5레벨마다 공격력 +5
  damageLevelInterval: 5,
  timePerLevels: 5,        // 10레벨마다 시간 +5초
  timeLevelInterval: 10,
  // 경험치 획득량
  expPerCorrect: 5,        // 정답 시 경험치
  expPerMonsterKill: 20,   // 몬스터 처치 시 경험치
  expPerNormalBoss: 50,    // 일반 보스 처치 시 경험치
  expPerMidBoss: 150,      // 중간 보스 처치 시 경험치
  expPerFinalBoss: 350,    // 최종 보스 처치 시 경험치
  maxLevel: 99             // 최대 레벨
};

// 보스 설정
export const BOSS_CONFIG = {
  NORMAL_BOSS: {
    stages: [10, 20, 30, 40, 60, 70, 80, 90],  // 일반 보스 층
    hpMultiplier: 2,
    damageMultiplier: 1.5,
    goldMultiplier: 3,
    icon: '👹',
    name: '보스'
  },
  MID_BOSS: {
    stages: [50],  // 중간 보스 층
    hpMultiplier: 3.5,
    damageMultiplier: 2,
    goldMultiplier: 5,
    icon: '👿',
    name: '중간보스'
  },
  FINAL_BOSS: {
    stages: [100],  // 최종 보스 층
    hpMultiplier: 5,
    damageMultiplier: 2.5,
    goldMultiplier: 10,
    icon: '🐉',
    name: '최종보스'
  }
};

// 색상
export const COLORS = {
  BG_PRIMARY: '#0a0a0f',
  BG_SECONDARY: '#12121a',
  BG_CARD: '#1a1a24',
  ACCENT: '#6366f1',
  ACCENT_LIGHT: '#818cf8',
  TEXT_PRIMARY: '#e2e8f0',
  TEXT_SECONDARY: '#94a3b8',
  SUCCESS: '#22c55e',
  DANGER: '#ef4444',
  WARNING: '#fbbf24',
  HP_PLAYER: '#22c55e',
  HP_ENEMY: '#ef4444'
};

// 과목
export const SUBJECTS = {
  MATH: { id: 'math', name: '수학', icon: '📐', color: '#6366f1' },
  ENGLISH: { id: 'english', name: '영어', icon: '📖', color: '#22c55e' },
  KOREAN: { id: 'korean', name: '국어', icon: '📚', color: '#ef4444' },
  SCIENCE: { id: 'science', name: '과학', icon: '🔬', color: '#fbbf24' }
};

// 희귀도 (아이템 드랍 시 등급 확률)
export const RARITY = {
  NORMAL: { id: 'normal', name: '일반', color: '#ffffff', dropRate: 0.45 },
  RARE: { id: 'rare', name: '레어', color: '#3b82f6', dropRate: 0.35 },
  EPIC: { id: 'epic', name: '에픽', color: '#a855f7', dropRate: 0.17 },
  LEGENDARY: { id: 'legendary', name: '전설', color: '#fbbf24', dropRate: 0.03 }
};

// 드랍 확률
export const DROP_RATES = {
  MONSTER: 0.05,    // 일반 몬스터 5%
  BOSS: 0.35        // 보스 몬스터 35%
};

// 영구 강화 설정
export const UPGRADES = {
  hp: {
    name: 'HP 강화',
    icon: '❤️',
    description: '최대 HP +15',
    basePrice: 500,
    priceIncrease: 300,  // 단계당 가격 증가
    maxLevel: 10,
    value: 15
  },
  time: {
    name: '시간 강화',
    icon: '⏱️',
    description: '제한 시간 +3초',
    basePrice: 800,
    priceIncrease: 500,
    maxLevel: 5,
    value: 3
  },
  goldBonus: {
    name: '골드 보너스',
    icon: '💰',
    description: '골드 획득 +15%',
    basePrice: 1000,
    priceIncrease: 800,
    maxLevel: 5,
    value: 15
  },
  damage: {
    name: '공격력 강화',
    icon: '⚔️',
    description: '기본 데미지 +10',
    basePrice: 900,
    priceIncrease: 1000,
    maxLevel: 10,
    value: 10
  }
};

// 상점 소비 아이템
export const SHOP_ITEMS = {
  reviveTicket: {
    id: 'reviveTicket',
    name: '부활권',
    icon: '🪶',
    description: '사망 시 HP 50% 회복 후 부활',
    price: 500
  },
  hintTicket: {
    id: 'hintTicket',
    name: '힌트권',
    icon: '💡',
    description: '힌트 1회 무료 사용',
    price: 100
  },
  timeBoost: {
    id: 'timeBoost',
    name: '시간 연장',
    icon: '⏰',
    description: '전투 중 사용 시 현재 문제 +60초',
    price: 200
  },
  doubleGold: {
    id: 'doubleGold',
    name: '골드 2배',
    icon: '✨',
    description: '다음 런 골드 획득 2배',
    price: 500
  }
};
