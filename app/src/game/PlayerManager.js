// 플레이어 관리 (레벨, 경험치, 스탯 계산, 저장)
import { GAME_CONFIG, LEVEL_CONFIG, UPGRADES } from '../utils/constants.js';
import { SoundService } from '../services/SoundService.js';
import { apiService } from '../services/ApiService.js';
import { t } from '../i18n/i18n.js';

export class PlayerManager {
  constructor(db, game) {
    this.db = db;
    this.game = game;
    this.player = null;
  }

  async loadPlayer() {
    let playerData = await this.db.get('player', 'main');

    if (!playerData) {
      playerData = this.createNewPlayer();
      await this.db.put('player', playerData);
    }

    this.player = playerData;

    // cosmetics 필드 마이그레이션
    let cosmeticsMigrated = false;
    if (!this.player.cosmetics) {
      this.player.cosmetics = {
        purchasedThemes: ['default'],
        particleStyle: 'default',
        purchasedParticles: ['default'],
        damageTextStyle: 'default',
        purchasedDamageText: ['default'],
        correctFlash: 'default',
        purchasedFlash: ['default']
      };
      cosmeticsMigrated = true;
    }

    this.player.maxHp = this.getTotalMaxHp();
    this.player.currentHp = this.player.maxHp;
    await this.db.put('player', this.player);

    // 마이그레이션 후 서버에도 즉시 동기화
    if (cosmeticsMigrated && apiService.isLoggedIn()) {
      apiService.putPlayer(this.player).catch(e => console.warn('서버 동기화 실패:', e.message));
    }
  }

  createNewPlayer() {
    return {
      id: 'main',
      level: 1,
      exp: 0,
      gold: 100,
      maxHp: GAME_CONFIG.DEFAULT_HP,
      currentHp: GAME_CONFIG.DEFAULT_HP,
      permanentUpgrades: { hp: 0, time: 0, goldBonus: 0, damage: 0 },
      inventory: { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 },
      stats: { totalRuns: 0, totalKills: 0, bestCombo: 0, totalClears: 0 },
      cosmetics: {
        purchasedThemes: ['default'],
        particleStyle: 'default',
        purchasedParticles: ['default'],
        damageTextStyle: 'default',
        purchasedDamageText: ['default'],
        correctFlash: 'default',
        purchasedFlash: ['default']
      },
      achievements: {},
      dailyMissions: {},
      totalGoldEarned: 0,
      totalCorrectAnswers: 0,
      subjectCounts: {},
      createdAt: Date.now()
    };
  }

  getExpForLevel(level) {
    return LEVEL_CONFIG.expPerLevel(level);
  }

  getLevelProgress() {
    const currentExp = this.player.exp;
    const requiredExp = this.getExpForLevel(this.player.level);
    return Math.min(currentExp / requiredExp, 1);
  }

  getLevelBonusHp() {
    let bonus = (this.player.level - 1) * LEVEL_CONFIG.hpPerLevel;
    if (this.player.level >= LEVEL_CONFIG.maxLevel) bonus += 10;
    return bonus;
  }

  getLevelBonusDamage() {
    let bonus = Math.floor(this.player.level / LEVEL_CONFIG.damageLevelInterval) * LEVEL_CONFIG.damagePerLevels;
    if (this.player.level >= LEVEL_CONFIG.maxLevel) bonus += 10;
    return bonus;
  }

  getLevelBonusTime() {
    let bonus = Math.floor(this.player.level / LEVEL_CONFIG.timeLevelInterval) * LEVEL_CONFIG.timePerLevels;
    if (this.player.level >= LEVEL_CONFIG.maxLevel) bonus += 15;
    return bonus;
  }

  getTotalMaxHp() {
    const base = GAME_CONFIG.DEFAULT_HP;
    const levelBonus = this.getLevelBonusHp();
    const upgradeBonus = (this.player.permanentUpgrades?.hp || 0) * (UPGRADES.hp?.value || 10);
    const achvBonus = this.player.achievementBonusHp || 0;
    return base + levelBonus + upgradeBonus + achvBonus;
  }

  getTotalDamage() {
    const base = GAME_CONFIG.DEFAULT_DAMAGE;
    const levelBonus = this.getLevelBonusDamage();
    const upgradeBonus = (this.player.permanentUpgrades?.damage || 0) * (UPGRADES.damage?.value || 5);
    const achvBonus = this.player.achievementBonusDamage || 0;
    return base + levelBonus + upgradeBonus + achvBonus;
  }

  getTotalTime(difficulty) {
    const diff = difficulty || 2;
    let base;
    if (diff <= 1) {
      base = 60;
    } else if (diff >= 3) {
      base = 160;
    } else {
      base = 100;
    }
    const levelBonus = this.getLevelBonusTime();
    const upgradeBonus = (this.player.permanentUpgrades?.time || 0) * (UPGRADES.time?.value || 3);
    return base + levelBonus + upgradeBonus;
  }

  async gainExp(amount) {
    if (this.player.level >= LEVEL_CONFIG.maxLevel) return;

    this.player.exp += amount;

    while (this.player.exp >= this.getExpForLevel(this.player.level) &&
           this.player.level < LEVEL_CONFIG.maxLevel) {
      this.player.exp -= this.getExpForLevel(this.player.level);
      this.player.level++;

      const oldMaxHp = this.player.maxHp;
      this.player.maxHp = this.getTotalMaxHp();
      this.player.currentHp = Math.min(this.player.currentHp + (this.player.maxHp - oldMaxHp), this.player.maxHp);

      SoundService.playLevelUp();

      let bonusMsg = this.getLevelUpBonusMessage() || `HP +${LEVEL_CONFIG.hpPerLevel}`;

      // 레벨 100 달성 시 특별 보너스
      if (this.player.level === LEVEL_CONFIG.maxLevel) {
        bonusMsg = t('maxLevelBonus') || '🏆 MAX! ATK+10, HP+10, TIME+15';
      }

      if (this.game?.effects) {
        this.game.effects.showLevelUp(this.player.level, bonusMsg);
      }
      if (this.game?.achievementManager) {
        this.game.achievementManager.onLevelUp(this.player.level);
      }
    }

    await this.save();
  }

  getLevelUpBonusMessage() {
    const level = this.player.level;
    const bonuses = [`HP +${LEVEL_CONFIG.hpPerLevel}`];

    if (level % LEVEL_CONFIG.damageLevelInterval === 0) {
      bonuses.push(t('attackBonus', LEVEL_CONFIG.damagePerLevels));
    }
    if (level % LEVEL_CONFIG.timeLevelInterval === 0) {
      bonuses.push(t('timeBonus', LEVEL_CONFIG.timePerLevels));
    }

    return bonuses.join('\n');
  }

  resetHp() {
    this.player.maxHp = this.getTotalMaxHp();
    this.player.currentHp = this.player.maxHp;
  }

  async save() {
    await this.db.put('player', this.player);
    // 서버 동기화는 디바운싱 (1초)
    if (apiService.isLoggedIn()) {
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this._saveTimer = setTimeout(() => {
        apiService.putPlayer(this.player).catch(e => console.warn('서버 동기화 실패:', e.message));
      }, 1000);
    }
  }
}
