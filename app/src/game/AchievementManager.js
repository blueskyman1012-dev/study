// 업적 & 일일 미션 관리
import { ACHIEVEMENTS, DAILY_MISSIONS, WEEKLY_MISSIONS } from '../utils/constants.js';
import { t } from '../i18n/i18n.js';

export class AchievementManager {
  constructor(game) {
    this.game = game;
    this.notificationQueue = [];
  }

  get player() { return this.game.playerManager.player; }

  initDailyMissions() {
    if (!this.player) return;
    if (!this.player.achievements) this.player.achievements = {};
    if (!this.player.dailyMissions) this.player.dailyMissions = {};
    if (this.player.totalGoldEarned === undefined) this.player.totalGoldEarned = 0;
    if (this.player.totalCorrectAnswers === undefined) this.player.totalCorrectAnswers = 0;

    const today = new Date().toISOString().slice(0, 10);
    if (this.player.dailyMissions.date !== today) {
      const seed = this._dateSeed(today);
      const pool = [...DAILY_MISSIONS];
      const selected = [];
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        const idx = (seed + i * 7 + i * i * 3) % pool.length;
        const mission = pool.splice(idx, 1)[0];
        selected.push({
          id: mission.id,
          nameKey: mission.nameKey,
          progress: 0,
          target: mission.target,
          completed: false,
          claimed: false,
          event: mission.event,
          reward: { ...mission.reward }
        });
      }
      this.player.dailyMissions = { date: today, missions: selected };
      this.game.playerManager.save();
    }

    this.initWeeklyMissions();
  }

  _getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const yearStart = new Date(d.getFullYear(), 0, 4);
    const weekNum = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  initWeeklyMissions() {
    if (!this.player) return;
    if (!this.player.weeklyMissions) this.player.weeklyMissions = {};

    const currentWeek = this._getISOWeek(new Date());
    if (this.player.weeklyMissions.week !== currentWeek) {
      const seed = this._dateSeed(currentWeek);
      const pool = [...WEEKLY_MISSIONS];
      const selected = [];
      for (let i = 0; i < 3 && pool.length > 0; i++) {
        const idx = (seed + i * 7 + i * i * 3) % pool.length;
        const mission = pool.splice(idx, 1)[0];
        selected.push({
          id: mission.id,
          nameKey: mission.nameKey,
          progress: 0,
          target: mission.target,
          completed: false,
          claimed: false,
          event: mission.event,
          reward: { ...mission.reward }
        });
      }
      this.player.weeklyMissions = { week: currentWeek, missions: selected };
      this.game.playerManager.save();
    }
  }

  _dateSeed(dateStr) {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = ((hash << 5) - hash) + dateStr.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  async unlock(id) {
    if (this.player.achievements[id]) return;
    const achv = ACHIEVEMENTS.find(a => a.id === id);
    if (!achv) return;

    this.player.achievements[id] = Date.now();
    this.player.gold += achv.reward;

    if (achv.rewardExp) {
      await this.game.playerManager.gainExp(achv.rewardExp);
    }
    if (achv.rewardBonusDamage) {
      this.player.achievementBonusDamage = (this.player.achievementBonusDamage || 0) + achv.rewardBonusDamage;
    }
    if (achv.rewardBonusHp) {
      this.player.achievementBonusHp = (this.player.achievementBonusHp || 0) + achv.rewardBonusHp;
      this.player.maxHp = this.game.playerManager.getTotalMaxHp();
      this.player.currentHp = Math.min(this.player.currentHp + achv.rewardBonusHp, this.player.maxHp);
    }

    if (this.game.effects) {
      this.game.effects.showAchievementUnlock(achv);
    }

    await this.game.playerManager.save();
  }

  async claimDailyReward(index) {
    const missions = this.player.dailyMissions?.missions;
    if (!missions || !missions[index]) return false;
    const mission = missions[index];
    if (!mission.completed || mission.claimed) return false;

    mission.claimed = true;
    if (mission.reward.gold) this.player.gold += mission.reward.gold;
    if (mission.reward.exp) await this.game.playerManager.gainExp(mission.reward.exp);
    await this.game.playerManager.save();
    return true;
  }

  async claimWeeklyReward(index) {
    const missions = this.player.weeklyMissions?.missions;
    if (!missions || !missions[index]) return false;
    const mission = missions[index];
    if (!mission.completed || mission.claimed) return false;

    mission.claimed = true;
    if (mission.reward.gold) this.player.gold += mission.reward.gold;
    if (mission.reward.exp) await this.game.playerManager.gainExp(mission.reward.exp);
    await this.game.playerManager.save();
    return true;
  }

  _updateDaily(event, amount = 1) {
    const missions = this.player.dailyMissions?.missions;
    if (missions) {
      for (const m of missions) {
        if (m.event === event && !m.completed) {
          m.progress = Math.min(m.progress + amount, m.target);
          if (m.progress >= m.target) m.completed = true;
        }
      }
    }
    const weekly = this.player.weeklyMissions?.missions;
    if (weekly) {
      for (const m of weekly) {
        if (m.event === event && !m.completed) {
          m.progress = Math.min(m.progress + amount, m.target);
          if (m.progress >= m.target) m.completed = true;
        }
      }
    }
  }

  onCorrectAnswer(combo) {
    this._updateDaily('correctAnswer');
    this._updateDaily('totalAnswers');
    this.player.totalCorrectAnswers = (this.player.totalCorrectAnswers || 0) + 1;

    if (combo >= 10) this.unlock('combo_3');
    if (combo >= 20) this.unlock('combo_5');
    if (combo >= 50) this.unlock('combo_10');
    if (combo >= 100) this.unlock('combo_20');
    if (combo >= 500) this.unlock('combo_500');

    const missions = this.player.dailyMissions?.missions;
    if (missions) {
      for (const m of missions) {
        if (m.event === 'combo' && !m.completed && combo >= m.target) {
          m.progress = m.target;
          m.completed = true;
        }
      }
    }
    const weekly = this.player.weeklyMissions?.missions;
    if (weekly) {
      for (const m of weekly) {
        if (m.event === 'combo' && !m.completed && combo >= m.target) {
          m.progress = m.target;
          m.completed = true;
        }
      }
    }

    const total = this.player.totalCorrectAnswers || 0;
    if (total >= 100) this.unlock('answer_100');
    if (total >= 500) this.unlock('answer_500');
  }

  onGoldEarned(amount) {
    this.player.totalGoldEarned = (this.player.totalGoldEarned || 0) + amount;
    this._updateDaily('goldEarned', amount);

    const total = this.player.totalGoldEarned;
    if (total >= 1000) this.unlock('gold_1000');
    if (total >= 10000) this.unlock('gold_10000');
    if (total >= 100000) this.unlock('gold_100000');
  }

  onMonsterDefeated(bossType) {
    this._updateDaily('monsterDefeated');

    if (bossType === 'NORMAL_BOSS') this.unlock('boss_normal');
    if (bossType === 'MID_BOSS') this.unlock('boss_mid');
    if (bossType === 'FINAL_BOSS') this.unlock('boss_final');

    const kills = (this.player.stats?.totalKills || 0);
    if (kills >= 50) this.unlock('kills_50');
    if (kills >= 100) this.unlock('kills_100');
    if (kills >= 500) this.unlock('kills_500');
  }

  onLevelUp(level) {
    if (level >= 10) this.unlock('level_10');
    if (level >= 25) this.unlock('level_25');
    if (level >= 50) this.unlock('level_50');
    if (level >= 99) this.unlock('level_99');
    if (level >= 100) this.unlock('level_100');
    this.checkPowerAchievements();
  }

  checkPowerAchievements() {
    const pm = this.game.playerManager;
    if (pm.getTotalDamage() >= 100) this.unlock('damage_100');
    if (pm.getTotalMaxHp() >= 500) this.unlock('hp_500');
  }

  onRunEnd(run) {
    if (!run) return;
    if (run.result === 'clear') {
      this._updateDaily('dungeonClear');

      if (!this.player.stats.totalClears) this.player.stats.totalClears = 0;
      const clears = this.player.stats.totalClears + 1;
      this.player.stats.totalClears = clears;
      if (clears >= 1) this.unlock('first_clear');
      if (clears >= 20) this.unlock('clear_10');
      if (clears >= 80) this.unlock('clear_50');

      if (run.totalAnswers >= 10 && run.correctAnswers === run.totalAnswers) {
        this.unlock('perfect_run');
      }
    }
    this.game.playerManager.save();
  }

  onMonsterRegistered(subject) {
    if (!this.player.subjectCounts) this.player.subjectCounts = {};
    this.player.subjectCounts[subject] = (this.player.subjectCounts[subject] || 0) + 1;
    if (subject === 'math' && this.player.subjectCounts.math >= 150) this.unlock('master_math');
    if (subject === 'science' && this.player.subjectCounts.science >= 150) this.unlock('master_science');
  }
}
