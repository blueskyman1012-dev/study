// 게임 메인 컨트롤러 (초기화, update, render, 화면전환)
import { Renderer } from '../canvas/Renderer.js';
import { SCREENS, COLORS } from '../utils/constants.js';
import { geminiService } from '../services/GeminiService.js';
import { problemGeneratorService } from '../services/ProblemGeneratorService.js';
import { safeGetItem } from '../utils/storage.js';
import { SoundService } from '../services/SoundService.js';
import { apiService } from '../services/ApiService.js';
import { t } from '../i18n/i18n.js';

import { EffectSystem } from './EffectSystem.js';
import { PlayerManager } from './PlayerManager.js';
import { MonsterManager } from './MonsterManager.js';
import { BattleManager } from './BattleManager.js';
import { ShopManager } from './ShopManager.js';
import { ItemManager } from './ItemManager.js';
import { StatsManager } from './StatsManager.js';
import { AchievementManager } from './AchievementManager.js';
import { DialogManager } from './DialogManager.js';
import { InputManager } from './InputManager.js';
import { GuideManager } from './GuideManager.js';
import { RegisterManager } from './RegisterManager.js';
import { DataManager } from './DataManager.js';
import { AIGenerateManager } from './AIGenerateManager.js';

import { renderMainScreen } from './screens/MainScreen.js';
import { renderBattleScreen } from './screens/BattleScreen.js';
import { renderResultScreen } from './screens/ResultScreen.js';
import { renderShopScreen, renderShopFixedHeader } from './screens/ShopScreen.js';
import { renderSettingsScreen, renderSettingsFixedHeader } from './screens/SettingsScreen.js';
import { renderRegisterScreen } from './screens/RegisterScreen.js';
import { renderStatsScreen, renderStatsFixedHeader } from './screens/StatsScreen.js';
import { renderDungeonSelectScreen } from './screens/DungeonSelectScreen.js';
import { renderAchievementScreen } from './screens/AchievementScreen.js';

export class Game {
  constructor(db) {
    this.db = db;
    this.currentScreen = SCREENS.MAIN;

    // 매니저들
    this.inputManager = new InputManager(this);
    this.dialogManager = new DialogManager(this);
    this.guideManager = new GuideManager(this);
    this.registerManager = new RegisterManager(this);
    this.dataManager = new DataManager(this);
    this.aiGenerateManager = new AIGenerateManager(this);
    this.playerManager = new PlayerManager(db, this);
    this.monsterManager = new MonsterManager(db);
    this.effects = new EffectSystem();
    this.battleManager = new BattleManager(this);
    this.shopManager = new ShopManager(this);
    this.itemManager = new ItemManager(this);
    this.statsManager = new StatsManager(this);
    this.achievementManager = new AchievementManager(this);
    this.cachedStats = null;

    // 전투 상태
    this.currentMonster = null;
    this.currentRun = null;
    this.stage = 0;
    this.combo = 0;
    this.timer = 30;
    this.lastTime = 0;
    this.finalBossWrongLastTurn = false;

    // 로딩/생성 상태
    this.isGenerating = false;
    this.generatingMessage = '';
    this.generatingSubMessage = '';

    // 렌더링 최적화: dirty 플래그
    this._needsRender = true;

  }

  async init() {
    await this.playerManager.loadPlayer();
    await this.monsterManager.loadMonsters();
    geminiService.loadApiKey();
    this.achievementManager.initDailyMissions();
    this.effects.setCosmetics(this.playerManager.player.cosmetics);
    console.log('🎮 Game initialized');

    // 신규 유저 가이드 자동 표시
    const player = this.playerManager.player;
    if (player && player.stats && player.stats.totalRuns === 0 && !safeGetItem('guide_shown')) {
      this.guideStep = 0;
    }
  }

  // 렌더 요청 (dirty 플래그 설정)
  requestRender() {
    this._needsRender = true;
  }

  // 화면 전환
  changeScreen(screen) {
    this.currentScreen = screen;
    this.clearClickAreas();
    this.scrollY = 0;
    this.scrollMaxY = 0;
    this._needsRender = true;

    // 메인 화면이 아니면 HTML 오답등록 버튼 즉시 숨기기
    const regBtn = document.getElementById('register-btn');
    if (regBtn) {
      if (screen === SCREENS.MAIN) {
        regBtn.classList.add('visible');
      } else {
        regBtn.classList.remove('visible');
      }
    }

    if (screen === SCREENS.MAIN && this.playerManager.player) {
      this.playerManager.resetHp();
      this.playerManager.save();
      SoundService.init();
      SoundService.startLobbyBgm();
    }

    if (screen === SCREENS.ACHIEVEMENT) {
      this.achievementManager.initDailyMissions();
    }

    if (screen === SCREENS.STATS) {
      this.statsManager.aggregateStats().then(() => this.render()).catch(err => console.error('통계 집계 오류:', err));
    }

    if (screen === SCREENS.BATTLE) {
      SoundService.stopBgm();
    }
  }

  // 입력 관리 (위임)
  get clickAreas() { return this.inputManager.clickAreas; }
  set clickAreas(v) { this.inputManager.clickAreas = v; }
  get scrollY() { return this.inputManager.scrollY; }
  set scrollY(v) { this.inputManager.scrollY = v; }
  get scrollMaxY() { return this.inputManager.scrollMaxY; }
  set scrollMaxY(v) { this.inputManager.scrollMaxY = v; }
  get _isTouchScrolling() { return this.inputManager._isTouchScrolling; }
  get _dragging() { return this.inputManager._dragging; }
  get _bgmInitiated() { return this.inputManager._bgmInitiated; }
  set _bgmInitiated(v) { this.inputManager._bgmInitiated = v; }
  registerClickArea(id, x, y, w, h, cb) { return this.inputManager.registerClickArea(id, x, y, w, h, cb); }
  registerDragArea(id, x, y, w, h, handler) { return this.inputManager.registerDragArea(id, x, y, w, h, handler); }
  clearClickAreas() { return this.inputManager.clearClickAreas(); }
  handleInput(x, y) { return this.inputManager.handleInput(x, y); }
  handleTouchStart(x, y) { return this.inputManager.handleTouchStart(x, y); }
  handleTouchMove(x, y) { return this.inputManager.handleTouchMove(x, y); }
  handleTouchEnd() { return this.inputManager.handleTouchEnd(); }

  // 업데이트
  update() {
    const hadEffects = this.effects.hasActiveEffects();
    this.effects.update();

    if (this.currentScreen === SCREENS.BATTLE) {
      this.battleManager.updateBattle();
      this._needsRender = true;
    } else if (this.isGenerating) {
      this._needsRender = true;
    } else if (hadEffects || this.effects.hasActiveEffects()) {
      this._needsRender = true;
    }
  }

  // 렌더링
  render() {
    const ctx = Renderer.ctx;

    ctx.save();
    if (this.effects.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.effects.screenShake;
      const shakeY = (Math.random() - 0.5) * this.effects.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    Renderer.clear();
    this.clearClickAreas();

    // 생성/분석 중이면 로딩 화면만 표시
    if (this.isGenerating) {
      Renderer.drawGrid();
      const pulse = 0.6 + Math.sin(Date.now() / 300) * 0.4;
      ctx.globalAlpha = pulse;
      Renderer.drawText('⏳', 200, 260, { font: '48px system-ui', align: 'center' });
      ctx.globalAlpha = 1;
      Renderer.drawText(this.generatingMessage || t('generating'), 200, 320, {
        font: 'bold 22px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center'
      });
      Renderer.drawText(this.generatingSubMessage || '', 200, 360, {
        font: '15px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
      });
      Renderer.drawText(t('pleaseWait'), 200, 400, {
        font: '14px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
      });
      this.effects.render();
      ctx.restore();
      return;
    }

    // 전투/결과 화면 외에는 UI 투명도 적용
    const applyOpacity = this.currentScreen !== SCREENS.BATTLE && this.currentScreen !== SCREENS.RESULT;
    if (applyOpacity) Renderer.applyUiOpacity();

    switch (this.currentScreen) {
      case SCREENS.MAIN: renderMainScreen(this); break;
      case SCREENS.REGISTER: renderRegisterScreen(this); break;
      case SCREENS.BATTLE: renderBattleScreen(this); break;
      case SCREENS.RESULT: renderResultScreen(this); break;
      case SCREENS.SETTINGS:
        this._renderScrollableScreen(() => renderSettingsScreen(this), () => renderSettingsFixedHeader(this));
        break;
      case SCREENS.DUNGEON_SELECT: renderDungeonSelectScreen(this); break;
      case SCREENS.SHOP:
        this._renderScrollableScreen(() => renderShopScreen(this), () => renderShopFixedHeader(this));
        break;
      case SCREENS.STATS:
        this._renderScrollableScreen(() => renderStatsScreen(this), () => renderStatsFixedHeader(this));
        break;
      case SCREENS.ACHIEVEMENT:
        this._renderScrollableScreen(() => renderAchievementScreen(this), () => {
          Renderer.roundRect(0, 0, 400, 60, 0, COLORS.BG_SECONDARY);
          Renderer.drawText(t('achievementTitle'), 200, 20, { font: 'bold 18px system-ui', align: 'center' });
          Renderer.drawText(t('back'), 30, 22, { font: '14px system-ui', color: COLORS.ACCENT_LIGHT });
        });
        break;
    }

    if (applyOpacity) Renderer.resetOpacity();

    this.effects.render();

    // 신규 유저 가이드 오버레이
    if (this.guideStep !== null) {
      this._renderGuide(ctx);
    }

    ctx.restore();
  }

  // 스크롤 가능 화면 공통 렌더 헬퍼 (save/restore + 고정헤더 + 스크롤바)
  _renderScrollableScreen(renderFn, headerFn) {
    const ctx = Renderer.ctx;
    ctx.save();
    ctx.translate(0, -this.scrollY);
    renderFn();
    ctx.restore();
    // 고정 헤더 재렌더
    if (headerFn) headerFn();
    // 스크롤 인디케이터
    if (this.scrollMaxY > 0) {
      const barH = Math.max(30, 700 * (700 / (700 + this.scrollMaxY)));
      const barY = (this.scrollY / this.scrollMaxY) * (700 - barH);
      Renderer.roundRect(394, barY, 4, barH, 2, 'rgba(255,255,255,0.2)');
    }
  }

  // 가이드 관리 (위임)
  get guideStep() { return this.guideManager.guideStep; }
  set guideStep(v) { this.guideManager.guideStep = v; }
  _renderGuide(ctx) { return this.guideManager.renderGuide(ctx); }
  showGuide() { return this.guideManager.showGuide(); }

  // 정답률 계산
  getAccuracyRate() {
    if (!this.currentRun || this.currentRun.totalAnswers === 0) return 0.5;
    return this.currentRun.correctAnswers / this.currentRun.totalAnswers;
  }

  // 다음 몬스터
  async nextMonster() {
    if (this._loadingMonster) return;
    this._loadingMonster = true;
    try { await this._nextMonsterImpl(); } finally { this._loadingMonster = false; }
  }

  async _nextMonsterImpl() {
    // 몬스터가 없으면 cleared 몬스터를 부활시켜 재활용
    if (this.monsterManager.monsters.length === 0) {
      await this._reviveClearedMonsters();
      await this.monsterManager.loadMonstersBySubject(this.currentSubject || 'math');
      if (this.monsterManager.monsters.length === 0) {
        this.endRun(true);
        return;
      }
    }

    const accuracy = this.getAccuracyRate();
    const totalAnswers = this.currentRun?.totalAnswers || 0;
    const selectedMonster = this.monsterManager.selectMonsterByDifficulty(accuracy, totalAnswers);
    this.currentMonster = this.monsterManager.prepareMonster(selectedMonster, this.stage, this.effects);

    const difficulty = this.currentMonster.difficulty || 2;
    this.timer = this.playerManager.getTotalTime(difficulty);
    this.lastTime = Date.now();
  }

  // 던전 시작
  async startDungeon(subject = 'math') {
    if (this.isGenerating) return;

    this.currentSubject = subject;
    await this.monsterManager.loadMonstersBySubject(subject);

    // 문제 30개 미만이면 AI로 자동 채우기
    const MIN_PROBLEMS = 30;
    if (this.monsterManager.monsters.length < MIN_PROBLEMS) {
      const hasAI = problemGeneratorService.hasApiKey() || geminiService.hasApiKey();
      if (hasAI) {
        await this._autoFillProblems(subject, MIN_PROBLEMS - this.monsterManager.monsters.length);
        await this.monsterManager.loadMonstersBySubject(subject);
      }
    }

    if (this.monsterManager.monsters.length === 0) {
      await this.showModal(t('noProblems'));
      return;
    }

    SoundService.playDungeonStart();

    let runGoldMultiplier = 1;
    if (this.playerManager.player.inventory?.doubleGold > 0) {
      this.playerManager.player.inventory.doubleGold--;
      runGoldMultiplier = 1.25;
      this.playerManager.save();
      await this.showModal(t('goldMultiplierApplied'));
    }

    this.currentRun = {
      startTime: Date.now(), defeatedMonsters: [], earnedGold: 0, earnedExp: 0,
      bestCombo: 0, goldMultiplier: runGoldMultiplier, result: 'ongoing',
      correctAnswers: 0, totalAnswers: 0, skipCount: 0,
      hintCount: 0, timeBoostCount: 0, reviveCount: 0, timeoutCount: 0,
      wrongBySubject: {}, correctBySubject: {},
      wrongByTopic: {}, correctByTopic: {},
      wrongByDifficulty: {}
    };

    this.stage = 1;
    this.combo = 0;
    this.finalBossWrongLastTurn = false;

    this.playerManager.resetHp();
    await this.nextMonster();
    this.changeScreen(SCREENS.BATTLE);
  }

  // 런 종료
  async endRun(isWin) {
    this.currentRun.result = isWin ? 'clear' : 'failed';
    this.currentRun.endTime = Date.now();

    if (isWin) { SoundService.playClear(); } else { SoundService.playGameOver(); }

    this.playerManager.resetHp();
    await this.playerManager.save();
    await this.db.add('runs', this.currentRun);
    this.statsManager.invalidateCache();
    if (apiService.isLoggedIn()) {
      apiService.postRun(this.currentRun).catch(() => {});
    }

    this.achievementManager.onRunEnd(this.currentRun);

    if (isWin) {
      await this._reviveClearedMonsters();
    }

    this.changeScreen(SCREENS.RESULT);
  }

  // cleared 상태 몬스터를 alive로 복구
  async _reviveClearedMonsters() {
    try {
      const cleared = await this.db.getByIndex('monsters', 'status', 'cleared');
      if (cleared.length === 0) return;
      await Promise.all(cleared.map(m => {
        m.status = 'alive';
        return this.db.put('monsters', m);
      }));
    } catch (err) {
      console.error('몬스터 부활 오류:', err);
    }
  }

  // 오답 등록 관리 (위임)
  get pendingImage() { return this.registerManager.pendingImage; }
  set pendingImage(v) { this.registerManager.pendingImage = v; }
  get previewImg() { return this.registerManager.previewImg; }
  set previewImg(v) { this.registerManager.previewImg = v; }
  get previewImageLoaded() { return this.registerManager.previewImageLoaded; }
  set previewImageLoaded(v) { this.registerManager.previewImageLoaded = v; }
  get _previewImageLoading() { return this.registerManager._previewImageLoading; }
  set _previewImageLoading(v) { this.registerManager._previewImageLoading = v; }
  startRegister() { return this.registerManager.startRegister(); }
  completeRegister(subjectId) { return this.registerManager.completeRegister(subjectId); }

  // AI 생성 관리 (위임)
  promptApiKey() { return this.aiGenerateManager.promptApiKey(); }
  promptSmilePrintApiKey() { return this.aiGenerateManager.promptSmilePrintApiKey(); }
  testAIGeneration() { return this.aiGenerateManager.testAIGeneration(); }
  showAIGenerateMenu() { return this.aiGenerateManager.showAIGenerateMenu(); }

  showLevelProgress() { return this.dialogManager.showLevelProgress(); }

  // 데이터 관리 (위임)
  resetAllProblems() { return this.dataManager.resetAllProblems(); }
  resetAccount() { return this.dataManager.resetAccount(); }
  exportProblems() { return this.dataManager.exportProblems(); }
  importProblems() { return this.dataManager.importProblems(); }

  // UI 헬퍼 (위임)
  showAnalyzingScreen(apiName) { return this.dialogManager.showAnalyzingScreen(apiName); }
  showGeneratingScreen(count) { return this.dialogManager.showGeneratingScreen(count); }
  showModal(message) { return this.dialogManager.showModal(message); }
  showConfirm(message) { return this.dialogManager.showConfirm(message); }
  showPrompt(message, defaultValue) { return this.dialogManager.showPrompt(message, defaultValue); }

  // 문제 자동 채우기 (30개 미만 시 AI 생성)
  async _autoFillProblems(subject, needed) {
    const topics = problemGeneratorService.getTopics(subject);
    const topicKeys = Object.keys(topics);
    let remaining = needed;
    let totalAdded = 0;

    this.isGenerating = true;
    this.generatingMessage = t('autoFillGenerating') || '문제 자동 생성 중...';
    this.generatingSubMessage = t('autoFillDesc', remaining) || `${remaining}개 문제를 만들고 있습니다`;
    this._needsRender = true;

    try {
      while (remaining > 0) {
        const batchSize = Math.min(remaining, 5);
        const randomTopic = topicKeys[Math.floor(Math.random() * topicKeys.length)];
        const difficulty = Math.random() < 0.5 ? 1 : 2;

        try {
          let problems = null;
          if (problemGeneratorService.hasApiKey()) {
            problems = await problemGeneratorService.generateProblems(randomTopic, difficulty, batchSize, subject);
          } else if (geminiService.hasApiKey()) {
            const topicName = topics[randomTopic].name;
            const result = await geminiService.generateNewProblems(subject, topicName, batchSize);
            problems = result?.problems;
          }

          if (problems && problems.length > 0) {
            for (const p of problems) {
              if (!p.question || !p.answer) continue;
              const monster = {
                subject,
                question: p.question,
                answer: p.answer,
                answers: p.answers || [p.answer],
                choices: p.choices || [],
                correctIndex: p.correctIndex || 0,
                explanation: p.explanation || '',
                topic: p.topic || topics[randomTopic].name,
                hp: 80 + (p.difficulty || difficulty) * 20,
                maxHp: 80 + (p.difficulty || difficulty) * 20,
                difficulty: p.difficulty || difficulty,
                isGenerated: true,
                createdAt: Date.now(),
                status: 'alive'
              };
              await this.db.add('monsters', monster);
              totalAdded++;
            }
            remaining -= problems.length;
          } else {
            break;
          }
        } catch (err) {
          console.error('자동 채우기 배치 오류:', err);
          break;
        }

        this.generatingSubMessage = t('autoFillProgress', totalAdded, needed) || `${totalAdded}/${needed}개 생성 완료`;
        this._needsRender = true;
      }

      if (totalAdded > 0) {
        console.log(`✅ 자동 채우기 완료: ${totalAdded}개 문제 생성`);
      }
    } finally {
      this.isGenerating = false;
      this._needsRender = true;
    }
  }

  async save() {
    await this.playerManager.save();
  }
}
