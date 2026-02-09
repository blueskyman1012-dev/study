// 화면 상수
export const SCREENS = {
  MAIN: 'main',
  BATTLE: 'battle',
  RESULT: 'result',
  SHOP: 'shop',
  REGISTER: 'register',
  DUNGEON_SELECT: 'dungeon_select',
  SETTINGS: 'settings',
  STATS: 'stats',
  ACHIEVEMENT: 'achievement'
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
  maxLevel: 100,           // 실제 최대 레벨
  displayMaxLevel: 99      // UI에 표시되는 최대 레벨
};

// 보스 설정
export const BOSS_CONFIG = {
  NORMAL_BOSS: {
    stages: [10, 20, 30, 40, 60, 70, 80, 90],  // 일반 보스 층
    hpMultiplier: 2,
    damageMultiplier: 1.5,
    goldMultiplier: 3,
    icon: '👹',
    nameKey: 'boss'
  },
  MID_BOSS: {
    stages: [50],  // 중간 보스 층
    hpMultiplier: 3.5,
    damageMultiplier: 2,
    goldMultiplier: 5,
    icon: '👿',
    nameKey: 'midBoss'
  },
  FINAL_BOSS: {
    stages: [100],  // 최종 보스 층
    hpMultiplier: 5,
    damageMultiplier: 2.5,
    goldMultiplier: 10,
    icon: '🐉',
    nameKey: 'finalBoss'
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
  MATH: { id: 'math', nameKey: 'math', icon: '📐', color: '#6366f1' },
  ENGLISH: { id: 'english', nameKey: 'english', icon: '📖', color: '#22c55e' },
  KOREAN: { id: 'korean', nameKey: 'korean', icon: '📚', color: '#ef4444' },
  SCIENCE: { id: 'science', nameKey: 'science', icon: '🔬', color: '#fbbf24' }
};

// 희귀도 (아이템 드랍 시 등급 확률)
export const RARITY = {
  NORMAL: { id: 'normal', nameKey: 'rarityNormal', color: '#ffffff', dropRate: 0.45 },
  RARE: { id: 'rare', nameKey: 'rarityRare', color: '#3b82f6', dropRate: 0.35 },
  EPIC: { id: 'epic', nameKey: 'rarityEpic', color: '#a855f7', dropRate: 0.17 },
  LEGENDARY: { id: 'legendary', nameKey: 'rarityLegendary', color: '#fbbf24', dropRate: 0.03 }
};

// 드랍 확률
export const DROP_RATES = {
  MONSTER: 0.05,    // 일반 몬스터 5%
  BOSS: 0.35        // 보스 몬스터 35%
};

// 영구 강화 설정
export const UPGRADES = {
  hp: {
    nameKey: 'hpUpgrade',
    icon: '❤️',
    descKey: 'hpUpgradeDesc',
    basePrice: 500,
    priceIncrease: 300,  // 단계당 가격 증가
    maxLevel: 10,
    value: 10
  },
  time: {
    nameKey: 'timeUpgrade',
    icon: '⏱️',
    descKey: 'timeUpgradeDesc',
    basePrice: 800,
    priceIncrease: 500,
    maxLevel: 5,
    value: 3
  },
  goldBonus: {
    nameKey: 'goldBonus',
    icon: '💰',
    descKey: 'goldBonusDesc',
    basePrice: 1000,
    priceIncrease: 800,
    maxLevel: 30,
    value: 5,
    priceAccelStart: 10,
    priceAccelInterval: 5,
    priceAccelStep: 0.05
  },
  damage: {
    nameKey: 'damageUpgrade',
    icon: '⚔️',
    descKey: 'damageUpgradeDesc',
    basePrice: 900,
    priceIncrease: 1000,
    maxLevel: 10,
    value: 5
  }
};

// 상점 소비 아이템
export const SHOP_ITEMS = {
  reviveTicket: {
    id: 'reviveTicket',
    nameKey: 'reviveTicket',
    icon: '🪶',
    descKey: 'reviveTicketDesc',
    price: 500,
    hintKey: 'reviveTicketHint'
  },
  hintTicket: {
    id: 'hintTicket',
    nameKey: 'hintTicket',
    icon: '💡',
    descKey: 'hintTicketDesc',
    price: 100,
    hintKey: 'hintTicketHint'
  },
  timeBoost: {
    id: 'timeBoost',
    nameKey: 'timeBoost',
    icon: '⏰',
    descKey: 'timeBoostDesc',
    price: 200,
    hintKey: 'timeBoostHint'
  },
  doubleGold: {
    id: 'doubleGold',
    nameKey: 'doubleGold',
    icon: '✨',
    descKey: 'doubleGoldDesc',
    price: 500,
    hintKey: 'doubleGoldHint'
  },
  randomBg: {
    id: 'randomBg',
    nameKey: 'randomBg',
    icon: '🎨',
    descKey: 'randomBgDesc',
    price: 1
  },
};

// 꾸미기 아이템 정의
export const COSMETIC_ITEMS = {
  theme: {
    nameKey: 'cosmetic_themes',
    icon: '🎨',
    items: [
      { id: 'emerald', nameKey: 'theme_emerald', price: 100, color: '#34d399' },
      { id: 'crimson', nameKey: 'theme_crimson', price: 100, color: '#f87171' },
      { id: 'amber', nameKey: 'theme_amber', price: 100, color: '#fbbf24' },
      { id: 'violet', nameKey: 'theme_violet', price: 100, color: '#a78bfa' },
      { id: 'cyan', nameKey: 'theme_cyan', price: 100, color: '#22d3ee' },
      { id: 'rose', nameKey: 'theme_rose', price: 100, color: '#fb7185' },
    ]
  },
  particle: {
    nameKey: 'cosmetic_particle',
    icon: '✨',
    items: [
      { id: 'default', nameKey: 'cosmetic_particle_default', price: 0 },
      { id: 'gold', nameKey: 'cosmetic_particle_gold', price: 200, colors: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d'] },
      { id: 'rainbow', nameKey: 'cosmetic_particle_rainbow', price: 300, colors: ['#ef4444', '#f97316', '#fbbf24', '#22c55e', '#3b82f6', '#8b5cf6'] },
      { id: 'sakura', nameKey: 'cosmetic_particle_sakura', price: 300, colors: ['#fda4af', '#fb7185', '#f472b6', '#fecdd3'] },
    ]
  },
  damageText: {
    nameKey: 'cosmetic_damageText',
    icon: '💥',
    items: [
      { id: 'default', nameKey: 'cosmetic_dmg_default', price: 0 },
      { id: 'neon', nameKey: 'cosmetic_dmg_neon', price: 150, color: '#00ffff', glow: true },
      { id: 'pixel', nameKey: 'cosmetic_dmg_pixel', price: 150, fontScale: 1.4 },
    ]
  },
  correctFlash: {
    nameKey: 'cosmetic_flash',
    icon: '⚡',
    items: [
      { id: 'default', nameKey: 'cosmetic_flash_default', price: 0, color: '#22c55e' },
      { id: 'blue', nameKey: 'cosmetic_flash_blue', price: 100, color: '#3b82f6' },
      { id: 'purple', nameKey: 'cosmetic_flash_purple', price: 100, color: '#a855f7' },
    ]
  }
};

// 업적 정의
export const ACHIEVEMENTS = [
  { id: 'combo_3', nameKey: 'achv_combo_3', descKey: 'achv_combo_3_desc', icon: '🔥', category: 'combo', condition: { type: 'combo', value: 10 }, reward: 50 },
  { id: 'combo_5', nameKey: 'achv_combo_5', descKey: 'achv_combo_5_desc', icon: '🔥', category: 'combo', condition: { type: 'combo', value: 20 }, reward: 100 },
  { id: 'combo_10', nameKey: 'achv_combo_10', descKey: 'achv_combo_10_desc', icon: '🔥', category: 'combo', condition: { type: 'combo', value: 50 }, reward: 300 },
  { id: 'combo_20', nameKey: 'achv_combo_20', descKey: 'achv_combo_20_desc', icon: '🔥', category: 'combo', condition: { type: 'combo', value: 100 }, reward: 1000 },
  { id: 'combo_500', nameKey: 'achv_combo_500', descKey: 'achv_combo_500_desc', icon: '🔥', category: 'combo', condition: { type: 'combo', value: 500 }, reward: 5000 },
  { id: 'first_clear', nameKey: 'achv_first_clear', descKey: 'achv_first_clear_desc', icon: '⭐', category: 'run', condition: { type: 'clear', value: 1 }, reward: 200, rewardExp: 30 },
  { id: 'clear_10', nameKey: 'achv_clear_10', descKey: 'achv_clear_10_desc', icon: '⭐', category: 'run', condition: { type: 'clear', value: 20 }, reward: 500, rewardExp: 80 },
  { id: 'clear_50', nameKey: 'achv_clear_50', descKey: 'achv_clear_50_desc', icon: '⭐', category: 'run', condition: { type: 'clear', value: 80 }, reward: 2000, rewardExp: 200 },
  { id: 'perfect_run', nameKey: 'achv_perfect_run', descKey: 'achv_perfect_run_desc', icon: '💎', category: 'run', condition: { type: 'perfect_run' }, reward: 1000, rewardExp: 150 },
  { id: 'boss_normal', nameKey: 'achv_boss_normal', descKey: 'achv_boss_normal_desc', icon: '👹', category: 'boss', condition: { type: 'boss', value: 'NORMAL_BOSS' }, reward: 100, rewardExp: 50 },
  { id: 'boss_mid', nameKey: 'achv_boss_mid', descKey: 'achv_boss_mid_desc', icon: '👿', category: 'boss', condition: { type: 'boss', value: 'MID_BOSS' }, reward: 300, rewardExp: 120 },
  { id: 'boss_final', nameKey: 'achv_boss_final', descKey: 'achv_boss_final_desc', icon: '🐉', category: 'boss', condition: { type: 'boss', value: 'FINAL_BOSS' }, reward: 500, rewardExp: 300 },
  { id: 'level_10', nameKey: 'achv_level_10', descKey: 'achv_level_10_desc', icon: '📈', category: 'level', condition: { type: 'level', value: 10 }, reward: 200 },
  { id: 'level_25', nameKey: 'achv_level_25', descKey: 'achv_level_25_desc', icon: '📈', category: 'level', condition: { type: 'level', value: 25 }, reward: 500 },
  { id: 'level_50', nameKey: 'achv_level_50', descKey: 'achv_level_50_desc', icon: '📈', category: 'level', condition: { type: 'level', value: 50 }, reward: 1500 },
  { id: 'level_99', nameKey: 'achv_level_99', descKey: 'achv_level_99_desc', icon: '👑', category: 'level', condition: { type: 'level', value: 99 }, reward: 5000 },
  { id: 'level_100', nameKey: 'achv_level_100', descKey: 'achv_level_100_desc', icon: '🌟', category: 'level', condition: { type: 'level', value: 100 }, reward: 10000, hidden: true },
  { id: 'gold_1000', nameKey: 'achv_gold_1000', descKey: 'achv_gold_1000_desc', icon: '💰', category: 'gold', condition: { type: 'gold', value: 1000 }, reward: 100 },
  { id: 'gold_10000', nameKey: 'achv_gold_10000', descKey: 'achv_gold_10000_desc', icon: '💰', category: 'gold', condition: { type: 'gold', value: 10000 }, reward: 500 },
  { id: 'gold_100000', nameKey: 'achv_gold_100000', descKey: 'achv_gold_100000_desc', icon: '💰', category: 'gold', condition: { type: 'gold', value: 100000 }, reward: 3000 },
  { id: 'kills_50', nameKey: 'achv_kills_50', descKey: 'achv_kills_50_desc', icon: '⚔️', category: 'kills', condition: { type: 'kills', value: 50 }, reward: 200 },
  { id: 'kills_100', nameKey: 'achv_kills_100', descKey: 'achv_kills_100_desc', icon: '⚔️', category: 'kills', condition: { type: 'kills', value: 100 }, reward: 500 },
  { id: 'kills_500', nameKey: 'achv_kills_500', descKey: 'achv_kills_500_desc', icon: '⚔️', category: 'kills', condition: { type: 'kills', value: 500 }, reward: 2000 },
  { id: 'master_math', nameKey: 'achv_master_math', descKey: 'achv_master_math_desc', icon: '📐', category: 'subject', condition: { type: 'subject', value: 'math', count: 150 }, reward: 300 },
  { id: 'master_science', nameKey: 'achv_master_science', descKey: 'achv_master_science_desc', icon: '🔬', category: 'subject', condition: { type: 'subject', value: 'science', count: 150 }, reward: 300 },
  { id: 'answer_100', nameKey: 'achv_answer_100', descKey: 'achv_answer_100_desc', icon: '✅', category: 'study', condition: { type: 'answers', value: 100 }, reward: 200 },
  { id: 'answer_500', nameKey: 'achv_answer_500', descKey: 'achv_answer_500_desc', icon: '✅', category: 'study', condition: { type: 'answers', value: 500 }, reward: 1000 },
  { id: 'damage_100', nameKey: 'achv_damage_100', descKey: 'achv_damage_100_desc', icon: '⚔️', category: 'power', condition: { type: 'damage', value: 100 }, reward: 500, rewardBonusDamage: 1 },
  { id: 'hp_500', nameKey: 'achv_hp_500', descKey: 'achv_hp_500_desc', icon: '❤️', category: 'power', condition: { type: 'hp', value: 500 }, reward: 500, rewardBonusHp: 1 },
];

// 일일 미션 풀
export const DAILY_MISSIONS = [
  // 난이도: ★☆☆ (쉬움)
  { id: 'correct_10', nameKey: 'dm_correct_10', target: 10, event: 'correctAnswer', reward: { gold: 40, exp: 20 } },
  { id: 'combo_5', nameKey: 'dm_combo_5', target: 5, event: 'combo', reward: { gold: 40, exp: 20 } },
  { id: 'earn_100', nameKey: 'dm_earn_100', target: 100, event: 'goldEarned', reward: { gold: 30, exp: 15 } },
  // 난이도: ★★☆ (보통)
  { id: 'correct_20', nameKey: 'dm_correct_20', target: 20, event: 'correctAnswer', reward: { gold: 80, exp: 50 } },
  { id: 'defeat_3', nameKey: 'dm_defeat_3', target: 3, event: 'monsterDefeated', reward: { gold: 70, exp: 40 } },
  { id: 'combo_10', nameKey: 'dm_combo_10', target: 10, event: 'combo', reward: { gold: 80, exp: 50 } },
  { id: 'answer_30', nameKey: 'dm_answer_30', target: 30, event: 'totalAnswers', reward: { gold: 70, exp: 40 } },
  // 난이도: ★★★ (어려움)
  { id: 'defeat_5', nameKey: 'dm_defeat_5', target: 5, event: 'monsterDefeated', reward: { gold: 120, exp: 80 } },
  { id: 'earn_500', nameKey: 'dm_earn_500', target: 500, event: 'goldEarned', reward: { gold: 100, exp: 60 } },
  { id: 'clear_1', nameKey: 'dm_clear_1', target: 1, event: 'dungeonClear', reward: { gold: 150, exp: 100 } },
];

// 주간 미션 풀
export const WEEKLY_MISSIONS = [
  // 난이도: ★☆☆ (쉬움)
  { id: 'wm_correct_150', nameKey: 'wm_correct_150', target: 150, event: 'correctAnswer', reward: { gold: 250, exp: 150 } },
  { id: 'wm_defeat_30', nameKey: 'wm_defeat_30', target: 30, event: 'monsterDefeated', reward: { gold: 300, exp: 180 } },
  { id: 'wm_earn_3000', nameKey: 'wm_earn_3000', target: 3000, event: 'goldEarned', reward: { gold: 250, exp: 150 } },
  // 난이도: ★★☆ (보통)
  { id: 'wm_correct_300', nameKey: 'wm_correct_300', target: 300, event: 'correctAnswer', reward: { gold: 500, exp: 350 } },
  { id: 'wm_defeat_50', nameKey: 'wm_defeat_50', target: 50, event: 'monsterDefeated', reward: { gold: 550, exp: 350 } },
  { id: 'wm_combo_50', nameKey: 'wm_combo_50', target: 50, event: 'combo', reward: { gold: 450, exp: 300 } },
  { id: 'wm_answer_200', nameKey: 'wm_answer_200', target: 200, event: 'totalAnswers', reward: { gold: 500, exp: 350 } },
  // 난이도: ★★★ (어려움)
  { id: 'wm_combo_100', nameKey: 'wm_combo_100', target: 100, event: 'combo', reward: { gold: 700, exp: 500 } },
  { id: 'wm_earn_7000', nameKey: 'wm_earn_7000', target: 7000, event: 'goldEarned', reward: { gold: 800, exp: 600 } },
  { id: 'wm_clear_7', nameKey: 'wm_clear_7', target: 7, event: 'dungeonClear', reward: { gold: 1000, exp: 700 } },
];
