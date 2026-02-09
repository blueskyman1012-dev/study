// 전투 로직 (정답/오답, 데미지, 타이머, 콤보)
import { GAME_CONFIG, LEVEL_CONFIG, UPGRADES, DROP_RATES, RARITY } from '../utils/constants.js';
import { SoundService } from '../services/SoundService.js';
import { geminiService } from '../services/GeminiService.js';
import { problemGeneratorService } from '../services/ProblemGeneratorService.js';
import { t } from '../i18n/i18n.js';

export class BattleManager {
  constructor(game) {
    this.game = game;
  }

  get player() { return this.game.playerManager.player; }
  get effects() { return this.game.effects; }
  get monsterManager() { return this.game.monsterManager; }
  get itemManager() { return this.game.itemManager; }

  updateBattle() {
    const now = Date.now();
    if (this.game.lastTime > 0) {
      const delta = (now - this.game.lastTime) / 1000;
      const prevTimer = this.game.timer;
      this.game.timer -= delta;

      if (this.game.timer <= 10 && this.game.timer > 0) {
        const prevSec = Math.ceil(prevTimer);
        const currSec = Math.ceil(this.game.timer);
        if (prevSec !== currSec) {
          SoundService.playTimerWarning();
        }
      }

      if (this.game.timer <= 0) {
        this.onTimeOut();
      }
    }
    this.game.lastTime = now;
  }

  selectAnswer(index) {
    const isCorrect = index === (this.game.currentMonster.correctIndex || 0);
    if (isCorrect) {
      this.onCorrectAnswer();
    } else {
      this.onWrongAnswer();
    }
  }

  async onCorrectAnswer() {
    const game = this.game;
    const monster = game.currentMonster;
    const run = game.currentRun;

    run.correctAnswers++;
    run.totalAnswers++;

    game.combo++;
    if (game.combo > run.bestCombo) {
      run.bestCombo = game.combo;
    }

    if (game.combo >= 3) {
      SoundService.playCombo(game.combo);
      this.effects.addComboText(game.combo);
      if (game.combo >= 5) {
        this.effects.addParticleExplosion(200, 350, '#fbbf24', game.combo * 2);
      }
    } else {
      SoundService.playCorrectWithVibrate();
    }

    this.effects.flashScreen('#22c55e', 0.15);

    const baseDamage = game.playerManager.getTotalDamage();
    const damage = baseDamage + game.combo * 2;
    monster.hp -= damage;

    this.effects.addDamageText(200 + (Math.random() - 0.5) * 40, 280, damage, false);

    await game.playerManager.gainExp(LEVEL_CONFIG.expPerCorrect);

    const baseGold = Math.floor(Math.random() * 16) + 5;
    const goldBonusUpgrade = this.player.permanentUpgrades?.goldBonus || 0;
    const goldBonusMultiplier = 1 + (goldBonusUpgrade * UPGRADES.goldBonus.value / 100);
    const monsterGoldMultiplier = monster.goldMultiplier || 1;
    const runGoldMultiplier = run?.goldMultiplier || 1;
    const multipliedGold = Math.round(baseGold * goldBonusMultiplier * monsterGoldMultiplier * runGoldMultiplier);
    const comboBonus = Math.min(game.combo, 10) * 2;
    const gold = multipliedGold + comboBonus;
    this.player.gold += gold;
    run.earnedGold += gold;
    SoundService.playGold();
    if (game.achievementManager) {
      game.achievementManager.onCorrectAnswer(game.combo);
      game.achievementManager.onGoldEarned(gold);
    }

    this.effects.addGoldText(350, 30, gold);

    if (monster.hp <= 0) {
      game.finalBossWrongLastTurn = false;
      await this.onMonsterDefeated();
    } else {
      // 최종보스: 이전 턴 오답 후 정답 시 페널티 플래그만 해제 (정답 보상은 유지)
      if (monster.bossType === 'FINAL_BOSS' && game.finalBossWrongLastTurn) {
        game.finalBossWrongLastTurn = false;
      }

      this.selectNextQuestion();

      const difficulty = monster.difficulty || 2;
      game.timer = game.playerManager.getTotalTime(difficulty);
      game.lastTime = Date.now();

      if (this.player.currentHp <= 0) {
        await game.endRun(false);
      }
    }
  }

  selectNextQuestion() {
    const monster = this.game.currentMonster;
    if (!monster) return;

    if (!monster.questions) {
      monster.questions = [{
        question: monster.question, answer: monster.answer,
        choices: monster.choices || [], correctIndex: monster.correctIndex || 0,
        explanation: monster.explanation || ''
      }];
      monster.currentQuestionIndex = 0;
      this.monsterManager.fillQuestionsFromOtherMonsters(monster);
    }

    const MIN_QUESTIONS = 3;
    if (monster.questions.length < MIN_QUESTIONS && !monster.isGenerating) {
      monster.isGenerating = true;
      this.monsterManager.autoGenerateQuestions(monster);
    }

    const currentIdx = monster.currentQuestionIndex ?? -1;
    let nextIdx;
    if (monster.questions.length <= 1) {
      nextIdx = 0;
    } else {
      let attempts = 0;
      do {
        nextIdx = Math.floor(Math.random() * monster.questions.length);
        attempts++;
      } while (nextIdx === currentIdx && attempts < 10);
      if (nextIdx === currentIdx) {
        nextIdx = (currentIdx + 1) % monster.questions.length;
      }
    }
    monster.currentQuestionIndex = nextIdx;

    const nextQ = monster.questions[nextIdx];
    if (!nextQ) {
      console.warn('문제를 찾을 수 없음, 인덱스 0으로 폴백');
      nextIdx = 0;
      monster.currentQuestionIndex = 0;
    }
    const safeQ = monster.questions[nextIdx] || monster.questions[0];
    if (!safeQ) return;
    monster.question = safeQ.question;
    monster.answer = safeQ.answer;
    monster.choices = safeQ.choices || [];
    monster.correctIndex = safeQ.correctIndex || 0;
    monster.explanation = safeQ.explanation || '';

    if (!monster.choices || monster.choices.length === 0) {
      const wrongAnswers = this.monsterManager.generateWrongAnswers(monster.answer);
      monster.choices = [monster.answer, ...wrongAnswers];
    }

    this.reshuffleChoices();
  }

  reshuffleChoices() {
    const monster = this.game.currentMonster;
    if (!monster || !monster.choices) return;
    const answer = monster.answer;
    monster.choices = this.monsterManager.shuffleArray([...monster.choices]);
    monster.correctIndex = monster.choices.indexOf(answer);
  }

  async onWrongAnswer() {
    const game = this.game;
    const monster = game.currentMonster;
    const run = game.currentRun;

    run.totalAnswers++;
    game.combo = 0;

    if (!monster._wrongCounts) monster._wrongCounts = {};
    const qKey = monster.question || '_default';
    monster._wrongCounts[qKey] = (monster._wrongCounts[qKey] || 0) + 1;

    if (monster._wrongCounts[qKey] >= 2) {
      monster.hp = monster.maxHp;
      this.effects.floatingTexts.push({
        x: 200, y: 250,
        text: t('monsterHpRecover'),
        color: '#ef4444',
        fontSize: 18,
        speed: 1.5,
        life: 1200,
        maxLife: 1200,
        alpha: 1,
        scale: 1
      });
    }

    let damage = 25;
    const bossType = monster?.bossType;
    if (bossType === 'NORMAL_BOSS') {
      damage = 30;
    } else if (bossType === 'MID_BOSS') {
      damage = 40;
      monster.hp = Math.min(monster.hp + 30, monster.maxHp);
    } else if (bossType === 'FINAL_BOSS') {
      damage = 80;
      if (game.finalBossWrongLastTurn) {
        this.player.currentHp -= 10;
        monster.hp = Math.min(monster.hp + 25, monster.maxHp);
      }
      game.finalBossWrongLastTurn = true;
    }
    this.player.currentHp -= damage;

    SoundService.playWrongWithVibrate();
    this.effects.flashScreen('#ef4444', 0.25);
    this.effects.shakeScreen(12);
    this.effects.addDamageText(100 + (Math.random() - 0.5) * 30, 35, damage, true);

    if (this.player.currentHp <= 0 && this.player.inventory?.reviveTicket > 0) {
      this.player.inventory.reviveTicket--;
      this.player.currentHp = Math.round(this.player.maxHp * 0.5);
      game.playerManager.save();
      await this.game.showModal(t('reviveUsed', this.player.inventory.reviveTicket));
    }

    this.selectNextQuestion();

    const difficulty = monster.difficulty || 2;
    const maxTime = game.playerManager.getTotalTime(difficulty);
    game.timer = Math.min(game.timer + 50, maxTime);
    game.lastTime = Date.now();

    if (monster) {
      if (problemGeneratorService.hasApiKey()) {
        this.monsterManager.generateSimilarWithProblemGenerator(monster, game.currentMonster);
      } else if (geminiService.hasApiKey()) {
        this.monsterManager.generateSimilarMonsters(monster, game.currentMonster);
      }
    }

    if (this.player.currentHp <= 0) {
      await game.endRun(false);
    }
  }

  async onTimeOut() {
    const game = this.game;
    game.combo = 0;
    this.player.currentHp -= 45;

    if (this.player.currentHp <= 0 && this.player.inventory?.reviveTicket > 0) {
      this.player.inventory.reviveTicket--;
      this.player.currentHp = Math.round(this.player.maxHp * 0.5);
      game.playerManager.save();
      await this.game.showModal(t('reviveUsed', this.player.inventory.reviveTicket));
    }

    this.selectNextQuestion();

    const difficulty = game.currentMonster?.difficulty || 2;
    game.timer = game.playerManager.getTotalTime(difficulty);
    game.lastTime = Date.now();

    if (this.player.currentHp <= 0) {
      game.endRun(false);
    }
  }

  async onMonsterDefeated() {
    const game = this.game;
    const monster = game.currentMonster;
    const run = game.currentRun;

    run.defeatedMonsters.push(monster.id);

    SoundService.playMonsterDefeat();
    const bossType = monster.bossType;
    if (bossType === 'FINAL_BOSS') {
      this.effects.addParticleExplosion(200, 300, '#ff0000', 30);
      this.effects.addParticleExplosion(200, 300, '#ffd700', 20);
      this.effects.shakeScreen(20);
    } else if (bossType === 'MID_BOSS') {
      this.effects.addParticleExplosion(200, 300, '#9932cc', 25);
      this.effects.shakeScreen(15);
    } else if (bossType === 'NORMAL_BOSS') {
      this.effects.addParticleExplosion(200, 300, '#ff6b35', 20);
      this.effects.shakeScreen(10);
    } else {
      this.effects.addParticleExplosion(200, 300, '#6366f1', 12);
    }
    this.effects.flashScreen('#ffffff', 0.3);

    let expGain = LEVEL_CONFIG.expPerMonsterKill;
    if (bossType === 'FINAL_BOSS') expGain = LEVEL_CONFIG.expPerFinalBoss;
    else if (bossType === 'MID_BOSS') expGain = LEVEL_CONFIG.expPerMidBoss;
    else if (bossType === 'NORMAL_BOSS') expGain = LEVEL_CONFIG.expPerNormalBoss;
    await game.playerManager.gainExp(expGain);

    await this.monsterManager.onMonsterDefeated(monster.id);
    if (game.achievementManager) {
      game.achievementManager.onMonsterDefeated(monster.bossType);
    }

    this.itemManager.checkDrop(monster, game);

    game.stage++;

    if (game.stage > GAME_CONFIG.STAGES_PER_DUNGEON) {
      await game.endRun(true);
    } else {
      await game.nextMonster();
    }
  }

  async skipQuestion() {
    const game = this.game;
    game.combo = 0;
    this.player.currentHp -= 10;

    if (this.player.currentHp <= 0) {
      if (this.player.inventory?.reviveTicket > 0) {
        this.player.inventory.reviveTicket--;
        this.player.currentHp = Math.round(this.player.maxHp * 0.5);
        game.playerManager.save();
        await this.game.showModal(t('reviveUsed', this.player.inventory.reviveTicket));
      } else {
        game.endRun(false);
        return;
      }
    }

    this.selectNextQuestion();

    const difficulty = game.currentMonster?.difficulty || 2;
    game.timer = game.playerManager.getTotalTime(difficulty);
    game.lastTime = Date.now();
  }

  async useHint() {
    const game = this.game;
    const monster = game.currentMonster;
    if (!monster) return;

    if (this.player.inventory?.hintTicket > 0) {
      this.player.inventory.hintTicket--;
      game.playerManager.save();
      await this._showHintInfo(monster);
      return;
    }

    if (this.player.gold < 50) {
      await this.game.showModal(t('noHintNoGold'));
      return;
    }

    const useGold = await this.game.showConfirm(t('useGoldForHint', this.player.gold));
    if (!useGold) return;

    this.player.gold -= 50;
    game.playerManager.save();
    await this._showHintInfo(monster);
  }

  async _showHintInfo(monster) {
    const hints = [];

    if (monster.topic) hints.push(t('topicHint', monster.topic));

    if (monster.explanation) {
      const firstHint = monster.explanation.split(/[.!?。]/)[0];
      if (firstHint && firstHint.length > 5) {
        hints.push(t('explanationHint', firstHint.substring(0, 50)));
      }
    }

    const choices = monster.choices || [];
    const correctIdx = monster.correctIndex || 0;
    const wrongIndices = choices.map((_, i) => i).filter(i => i !== correctIdx);
    if (wrongIndices.length > 0) {
      const randomWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
      hints.push(t('wrongChoiceHint', randomWrong + 1));
    }

    if (monster.keywords && monster.keywords.length > 0) {
      hints.push(t('keywordHint', monster.keywords.slice(0, 2).join(', ')));
    }

    if (hints.length === 0) {
      hints.push(t('readCarefully'));
      hints.push(t('trySubstitute'));
    }

    await this.game.showModal(`${t('hintTitle')}\n\n${hints.join('\n\n')}`);
  }

  async useTimeBoost() {
    if (this.player.inventory?.timeBoost > 0) {
      this.player.inventory.timeBoost--;
      this.game.timer += 60;
      this.game.playerManager.save();
      SoundService.playClick();
      await this.game.showModal(t('timeBoostUsed', this.player.inventory.timeBoost));
    } else {
      await this.game.showModal(t('noTimeBoost'));
    }
  }

  async showFullQuestion() {
    const monster = this.game.currentMonster;
    if (!monster) return;

    const question = monster.question || t('noQuestion');
    const topic = monster.topic || '';

    let message = `${t('questionLabel')}\n\n${question}`;
    if (topic) message += `\n\n${t('topicHint', topic)}`;

    await this.game.showModal(message);
  }
}
