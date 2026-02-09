// 게임 메인 컨트롤러 (초기화, update, render, 화면전환)
import { Renderer } from '../canvas/Renderer.js';
import { SCREENS, GAME_CONFIG, LEVEL_CONFIG, COLORS, SUBJECTS, UPGRADES } from '../utils/constants.js';
import { geminiService } from '../services/GeminiService.js';
import { imageAnalysisService } from '../services/ImageAnalysisService.js';
import { safeGetItem, safeSetItem, safeRemoveItem } from '../utils/storage.js';
import { problemGeneratorService } from '../services/ProblemGeneratorService.js';
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

import { renderMainScreen } from './screens/MainScreen.js';
import { renderBattleScreen } from './screens/BattleScreen.js';
import { renderResultScreen } from './screens/ResultScreen.js';
import { renderShopScreen, renderShopFixedHeader } from './screens/ShopScreen.js';
import { renderSettingsScreen } from './screens/SettingsScreen.js';
import { renderRegisterScreen } from './screens/RegisterScreen.js';
import { renderStatsScreen } from './screens/StatsScreen.js';
import { renderDungeonSelectScreen } from './screens/DungeonSelectScreen.js';
import { renderAchievementScreen } from './screens/AchievementScreen.js';

export class Game {
  constructor(db) {
    this.db = db;
    this.currentScreen = SCREENS.MAIN;
    this.clickAreas = [];

    // 매니저들
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

    // 오답 등록 상태
    this.pendingImage = null;
    this.previewImg = null;
    this.previewImageLoaded = false;

    // 로딩/생성 상태
    this.isGenerating = false;
    this.generatingMessage = '';
    this.generatingSubMessage = '';

    // 신규 유저 가이드
    this.guideStep = null;

    // 설정 화면 스크롤
    this.scrollY = 0;
    this.scrollMaxY = 0;
    this._touchStartY = null;
    this._touchLastY = null;
    this._isTouchScrolling = false;

    // 드래그 슬라이더
    this._dragging = null; // { id, handler }
  }

  async init() {
    await this.playerManager.loadPlayer();
    await this.monsterManager.loadMonsters();
    geminiService.loadApiKey();
    this.achievementManager.initDailyMissions();
    console.log('🎮 Game initialized');

    // 신규 유저 가이드 자동 표시
    const player = this.playerManager.player;
    if (player && player.stats && player.stats.totalRuns === 0 && !safeGetItem('guide_shown')) {
      this.guideStep = 0;
    }
  }

  // 화면 전환
  changeScreen(screen) {
    this.currentScreen = screen;
    this.clearClickAreas();
    this.scrollY = 0;
    this.scrollMaxY = 0;

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

  // 클릭 영역 관리
  registerClickArea(id, x, y, width, height, callback) {
    this.clickAreas.push({ id, x, y, width, height, callback });
  }

  registerDragArea(id, x, y, width, height, handler) {
    this.clickAreas.push({ id, x, y, width, height, callback: handler, draggable: true });
  }

  clearClickAreas() {
    this.clickAreas = [];
  }

  // 화면별 고정 헤더 높이
  _getFixedHeaderHeight() {
    if (this.currentScreen === SCREENS.SHOP) return 86;
    return 60;
  }

  // 입력 처리
  handleInput(x, y) {
    if (this._isTouchScrolling) return;
    if (this.isGenerating) return;

    // 더블클릭 방지 (200ms)
    const now = Date.now();
    if (this._lastInputTime && now - this._lastInputTime < 200) return;
    this._lastInputTime = now;

    if (this.guideStep !== null) {
      // 가이드 중: 등록된 guide_ 클릭 영역 체크 (모바일 터치 여유 +8px)
      const pad = 8;
      for (const area of this.clickAreas) {
        if (area.id && area.id.startsWith('guide_') &&
            x >= area.x - pad && x <= area.x + area.width + pad &&
            y >= area.y - pad && y <= area.y + area.height + pad) {
          area.callback(x, y);
          return;
        }
      }
      return;
    }

    if (this.effects.isLevelUpActive()) {
      this.effects.dismissLevelUp();
      return;
    }

    if (!this._bgmInitiated) {
      this._bgmInitiated = true;
      SoundService.init();
      if (this.currentScreen === SCREENS.MAIN) {
        SoundService.startLobbyBgm();
      }
    }

    // 스크롤 가능한 화면에서는 클릭 y좌표에 스크롤 오프셋 적용
    // 단, 헤더 영역은 고정이므로 오프셋 미적용
    const fixedH = this._getFixedHeaderHeight();
    const adjustedY = (this.scrollMaxY > 0 && y >= fixedH) ? y + this.scrollY : y;

    for (const area of this.clickAreas) {
      if (x >= area.x && x <= area.x + area.width &&
          adjustedY >= area.y && adjustedY <= area.y + area.height) {
        if (area.id === 'toggleSfx' || area.id === 'toggleBgm') {
          area.callback(x, adjustedY);
        } else {
          SoundService.playClick();
          area.callback(x, adjustedY);
        }
        return;
      }
    }
  }

  // 터치 스크롤 처리
  handleTouchStart(canvasX, canvasY) {
    // 드래그 가능 영역 체크
    const fixedH = this._getFixedHeaderHeight();
    const adjustedY = (this.scrollMaxY > 0 && canvasY >= fixedH) ? canvasY + this.scrollY : canvasY;
    for (const area of this.clickAreas) {
      if (area.draggable && canvasX >= area.x && canvasX <= area.x + area.width &&
          adjustedY >= area.y && adjustedY <= area.y + area.height) {
        this._dragging = { id: area.id, handler: area.callback };
        area.callback(canvasX, adjustedY);
        return;
      }
    }
    if (this.scrollMaxY <= 0) return;
    this._touchStartY = canvasY;
    this._touchLastY = canvasY;
    this._isTouchScrolling = false;
  }

  handleTouchMove(canvasX, canvasY) {
    if (this._dragging) {
      this._dragging.handler(canvasX);
      this.render();
      return;
    }
    if (this._touchLastY === null || this.scrollMaxY <= 0) return;
    const delta = this._touchLastY - canvasY;
    this._touchLastY = canvasY;

    // 모바일 터치는 탭 시에도 10px 이상 미세 이동이 흔함
    // 임계값을 15px로 설정하여 탭과 스크롤을 정확히 구분
    if (Math.abs(canvasY - this._touchStartY) > 15) {
      this._isTouchScrolling = true;
    }

    // 스크롤 판정 후에만 실제 스크롤 적용
    if (this._isTouchScrolling) {
      this.scrollY = Math.max(0, Math.min(this.scrollMaxY, this.scrollY + delta));
    }
  }

  handleTouchEnd() {
    if (this._dragging) {
      this._dragging = null;
      return;
    }
    this._touchStartY = null;
    this._touchLastY = null;
    // 짧은 딜레이 후 스크롤 플래그 해제 (클릭 방지)
    setTimeout(() => { this._isTouchScrolling = false; }, 50);
  }

  // 업데이트
  update() {
    this.effects.update();
    if (this.currentScreen === SCREENS.BATTLE) {
      this.battleManager.updateBattle();
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
        ctx.save();
        ctx.translate(0, -this.scrollY);
        renderSettingsScreen(this);
        ctx.restore();
        // 헤더를 스크롤 위에 고정 렌더링
        Renderer.roundRect(0, 0, 400, 60, 0, COLORS.BG_SECONDARY);
        Renderer.drawText(t('settingsTitle'), 200, 20, { font: 'bold 18px system-ui', align: 'center' });
        Renderer.drawText(t('back'), 30, 22, { font: '14px system-ui', color: COLORS.ACCENT_LIGHT });
        // 스크롤 인디케이터
        if (this.scrollMaxY > 0) {
          const barH = Math.max(30, 700 * (700 / (700 + this.scrollMaxY)));
          const barY = (this.scrollY / this.scrollMaxY) * (700 - barH);
          Renderer.roundRect(394, barY, 4, barH, 2, 'rgba(255,255,255,0.2)');
        }
        break;
      case SCREENS.DUNGEON_SELECT: renderDungeonSelectScreen(this); break;
      case SCREENS.SHOP:
        ctx.save();
        ctx.translate(0, -this.scrollY);
        renderShopScreen(this);
        ctx.restore();
        // 고정 헤더 + 탭 바 (86px)
        renderShopFixedHeader(this);
        if (this.scrollMaxY > 0) {
          const barH = Math.max(30, 700 * (700 / (700 + this.scrollMaxY)));
          const barY = (this.scrollY / this.scrollMaxY) * (700 - barH);
          Renderer.roundRect(394, barY, 4, barH, 2, 'rgba(255,255,255,0.2)');
        }
        break;
      case SCREENS.STATS: renderStatsScreen(this); break;
      case SCREENS.ACHIEVEMENT:
        ctx.save();
        ctx.translate(0, -this.scrollY);
        renderAchievementScreen(this);
        ctx.restore();
        Renderer.roundRect(0, 0, 400, 60, 0, COLORS.BG_SECONDARY);
        Renderer.drawText(t('achievementTitle'), 200, 20, { font: 'bold 18px system-ui', align: 'center' });
        Renderer.drawText(t('back'), 30, 22, { font: '14px system-ui', color: COLORS.ACCENT_LIGHT });
        if (this.scrollMaxY > 0) {
          const barH = Math.max(30, 700 * (700 / (700 + this.scrollMaxY)));
          const barY = (this.scrollY / this.scrollMaxY) * (700 - barH);
          Renderer.roundRect(394, barY, 4, barH, 2, 'rgba(255,255,255,0.2)');
        }
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

  _renderGuide(ctx) {
    const totalPages = 4;
    const step = this.guideStep;

    // 반투명 어두운 배경
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, 400, 700);

    // 중앙 카드
    const cardX = 30, cardY = 90, cardW = 340, cardH = 520;
    const r = 16;
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.moveTo(cardX + r, cardY);
    ctx.lineTo(cardX + cardW - r, cardY);
    ctx.quadraticCurveTo(cardX + cardW, cardY, cardX + cardW, cardY + r);
    ctx.lineTo(cardX + cardW, cardY + cardH - r);
    ctx.quadraticCurveTo(cardX + cardW, cardY + cardH, cardX + cardW - r, cardY + cardH);
    ctx.lineTo(cardX + r, cardY + cardH);
    ctx.quadraticCurveTo(cardX, cardY + cardH, cardX, cardY + cardH - r);
    ctx.lineTo(cardX, cardY + r);
    ctx.quadraticCurveTo(cardX, cardY, cardX + r, cardY);
    ctx.closePath();
    ctx.fill();

    // 카드 테두리
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 페이지별 아이콘
    const icons = ['👋', '📸', '⚔️', '📈'];
    Renderer.drawText(icons[step], 200, 150, { font: '56px system-ui', align: 'center' });

    // 제목
    Renderer.drawText(t(`guide_title_${step}`), 200, 230, {
      font: 'bold 22px system-ui', color: '#818cf8', align: 'center'
    });

    // 설명 텍스트 (줄바꿈 처리)
    const desc = t(`guide_desc_${step}`);
    const lines = desc.split('\n');
    let lineY = 280;
    for (const line of lines) {
      Renderer.drawText(line, 200, lineY, {
        font: '15px system-ui', color: '#e2e8f0', align: 'center'
      });
      lineY += 24;
    }

    // 페이지 인디케이터
    const indicatorY = 530;
    for (let i = 0; i < totalPages; i++) {
      const ix = 200 + (i - (totalPages - 1) / 2) * 20;
      ctx.beginPath();
      ctx.arc(ix, indicatorY, 5, 0, Math.PI * 2);
      ctx.fillStyle = i === step ? '#818cf8' : 'rgba(255,255,255,0.3)';
      ctx.fill();
    }

    // 버튼
    const btnY = 555, btnW = 200, btnH = 44;
    const btnX = 100;
    const isLast = step === totalPages - 1;
    const btnText = isLast ? t('guide_start') : t('guide_next');

    Renderer.roundRect(btnX, btnY, btnW, btnH, 12, '#6366f1');
    Renderer.drawText(btnText, 200, btnY + btnH / 2, {
      font: 'bold 17px system-ui', color: '#ffffff', align: 'center'
    });

    this.registerClickArea('guide_btn', btnX, btnY, btnW, btnH, () => {
      this._advanceGuide();
    });
  }

  showGuide() {
    this.guideStep = 0;
    this.render();
  }

  _advanceGuide() {
    const totalPages = 4;
    if (this.guideStep < totalPages - 1) {
      this.guideStep++;
    } else {
      this.guideStep = null;
      safeSetItem('guide_shown', '1');
    }
    this.render();
  }

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
      correctAnswers: 0, totalAnswers: 0
    };

    this.stage = 1;
    this.combo = 0;

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
      for (const m of cleared) {
        m.status = 'alive';
        await this.db.put('monsters', m);
      }
    } catch (err) {
      console.error('몬스터 부활 오류:', err);
    }
  }

  // 오답 등록
  startRegister() {
    this.pendingImage = null;
    this.previewImg = null;
    this.previewImageLoaded = false;
    this.changeScreen(SCREENS.MAIN);
  }

  // 오답 등록 완료
  async completeRegister(subjectId) {
    if (this.isGenerating) return;
    if (!this.pendingImage) {
      await this.showModal(t('noPhoto'));
      this.changeScreen(SCREENS.MAIN);
      return;
    }

    const imageData = this.pendingImage;
    const subjectKey = SUBJECTS[subjectId.toUpperCase()]?.nameKey || 'math';
    const subjectName = t(subjectKey);

    let question = '', answer = '', answers = [], choices = [], correctIndex = 0;
    let explanation = '', aiAnalysis = null, topic = '', difficulty = 2;
    let keywords = [], questionType = t('multipleChoice'), formula = '';

    // SmilePrint API 우선
    if (imageAnalysisService.hasApiKey()) {
      try {
        this.isGenerating = true;
        this.generatingMessage = t('analyzing', 'SmilePrint');
        this.generatingSubMessage = t('analyzingDesc');
        const result = await imageAnalysisService.analyze(imageData, subjectId);
        if (result && result.success && result.question) {
          question = result.question; answer = result.answer || '';
          choices = result.choices || []; correctIndex = result.correctIndex || 0;
          explanation = result.explanation || ''; topic = result.topic || '';
          difficulty = this._parseDifficulty(result.difficulty);
          keywords = result.keywords || []; aiAnalysis = result.aiAnalysis;
          answers = result.answers || [answer];
          questionType = result.questionType || t('multipleChoice');
          formula = result.formula || '';

          this.isGenerating = false;
          const displayQ = question.length > 100 ? question.substring(0, 100) + '...' : question;
          const answerDisplay = answers.length > 1 ? answers.join(', ') : answer;
          const confirmed = await this.showConfirm(t('aiAnalyzed', displayQ, answerDisplay, topic, explanation));
          if (!confirmed) {
            question = await this.showPrompt(t('editQuestion'), question) || question;
            answer = await this.showPrompt(t('editAnswer'), answer) || answer;
          }
        } else {
          throw new Error(result?.message || t('noAnalysisResult'));
        }
      } catch (err) {
        console.error('SmilePrint 분석 실패:', err);
        if (geminiService.hasApiKey()) {
          try {
            this.generatingMessage = t('analyzing', 'Gemini');
            const result = await geminiService.analyzeImage(imageData, subjectName);
            this.isGenerating = false;
            if (result && result.question) {
              question = result.question; answer = result.answer || '';
              choices = result.choices || []; correctIndex = result.correctIndex || 0;
              explanation = result.explanation || '';
              const displayQ = question.length > 100 ? question.substring(0, 100) + '...' : question;
              const confirmed = await this.showConfirm(t('aiAnalyzedSimple', displayQ, answer));
              if (!confirmed) {
                question = await this.showPrompt(t('editQuestion'), question) || question;
                answer = await this.showPrompt(t('editAnswer'), answer) || answer;
              }
            } else { throw new Error(t('noAnalysisResult')); }
          } catch (geminiErr) {
            this.isGenerating = false;
            await this.showModal(t('aiFailed', err.message));
            question = await this.showPrompt(t('inputQuestion')) || '';
            if (!question) return;
            answer = await this.showPrompt(t('inputAnswer')) || '';
          }
        } else {
          this.isGenerating = false;
          await this.showModal(t('aiFailed', err.message));
          question = await this.showPrompt(t('inputQuestion')) || '';
          if (!question) return;
          answer = await this.showPrompt(t('inputAnswer')) || '';
        }
      }
    } else if (geminiService.hasApiKey()) {
      try {
        this.isGenerating = true;
        this.generatingMessage = t('analyzing', 'Gemini');
        this.generatingSubMessage = t('analyzingDesc');
        const result = await geminiService.analyzeImage(imageData, subjectName);
        this.isGenerating = false;
        if (result && result.question) {
          question = result.question; answer = result.answer || '';
          choices = result.choices || []; correctIndex = result.correctIndex || 0;
          explanation = result.explanation || '';
          const displayQ = question.length > 100 ? question.substring(0, 100) + '...' : question;
          const confirmed = await this.showConfirm(t('aiAnalyzedSimple', displayQ, answer));
          if (!confirmed) {
            question = await this.showPrompt(t('editQuestion'), question) || question;
            answer = await this.showPrompt(t('editAnswer'), answer) || answer;
          }
        } else { throw new Error(t('noAnalysisResult')); }
      } catch (err) {
        this.isGenerating = false;
        await this.showModal(t('aiFailed', err.message));
        question = await this.showPrompt(t('inputQuestion')) || '';
        if (!question) return;
        answer = await this.showPrompt(t('inputAnswer')) || '';
      }
    } else {
      question = await this.showPrompt(t('inputQuestion')) || '';
      if (!question) return;
      answer = await this.showPrompt(t('inputAnswer')) || '';
    }

    if (!answer && choices && choices.length > 0) {
      answer = choices[correctIndex] || choices[0];
    }
    if (!answer) {
      answer = await this.showPrompt(t('inputAnswerNum')) || '';
      if (!answer) { await this.showModal(t('noAnswer')); return; }
    }

    if (!choices || choices.length < 4) {
      const wrongAnswers = this.monsterManager.generateWrongAnswers(answer);
      choices = [answer, ...wrongAnswers];
      correctIndex = 0;
    }

    const monster = {
      subject: subjectId, imageData, question, answer,
      answers: answers.length > 0 ? answers : [answer],
      choices, correctIndex, explanation, topic, difficulty, keywords,
      questionType, formula,
      hp: 80 + difficulty * 20, maxHp: 80 + difficulty * 20,
      createdAt: Date.now(), status: 'alive', aiAnalysis,
      stats: { attempts: 0, correct: 0, wrong: 0, lastAttempt: null, averageTime: 0 },
      review: { nextReviewDate: null, reviewCount: 0, masteryLevel: 0 }
    };

    await this.db.add('monsters', monster);
    if (apiService.isLoggedIn()) {
      apiService.postMonster(monster).catch(() => {});
    }
    await this.monsterManager.loadMonsters();
    this.achievementManager.onMonsterRegistered(subjectId);

    this.pendingImage = null;
    this.previewImg = null;
    this.previewImageLoaded = false;

    await this.showModal(t('monsterRegistered'));
    this.changeScreen(SCREENS.MAIN);
  }

  _parseDifficulty(diffStr) {
    if (diffStr === '상' || diffStr === 'high' || diffStr === '高') return 3;
    if (diffStr === '하' || diffStr === 'low' || diffStr === '低') return 1;
    return 2;
  }

  // API 키 입력
  async promptApiKey() {
    const key = await this.showPrompt(t('inputGeminiKey'));
    if (key && key.trim()) {
      geminiService.setApiKey(key.trim());
      await this.showModal(t('geminiKeySaved'));
    }
  }

  async promptSmilePrintApiKey() {
    const key = await this.showPrompt(t('inputSmilePrintApiKey'));
    if (key && key.trim()) {
      imageAnalysisService.setApiKey(key.trim());
      await this.showModal(t('smilePrintKeySaved'));
    }
  }

  // AI 테스트
  async testAIGeneration() {
    try {
      await this.showModal(t('testGenerating'));
      const result = await geminiService.generateNewProblems(t('defaultTopic'), t('linearEquation'), 3);
      if (result && result.problems && result.problems.length > 0) {
        let addedCount = 0;
        for (const p of result.problems) {
          const monster = {
            subject: 'math', question: p.question, answer: p.answer,
            choices: p.choices || [], correctIndex: p.correctIndex || 0,
            explanation: p.explanation || '',
            hp: 80 + (p.difficulty || 1) * 20, maxHp: 80 + (p.difficulty || 1) * 20,
            difficulty: p.difficulty || 1, isGenerated: true, createdAt: Date.now(), status: 'alive'
          };
          await this.db.add('monsters', monster);
          addedCount++;
        }
        await this.monsterManager.loadMonsters();
        const p = result.problems[0];
        await this.showModal(t('testGenerated', addedCount, p.question, p.answer));
      } else {
        await this.showModal(t('generateFailed'));
      }
    } catch (err) {
      await this.showModal(t('error') + err.message);
    }
  }

  // AI 문제 생성 메뉴
  async showAIGenerateMenu() {
    if (this._aiGenerating) return;
    this._aiGenerating = true;
    try { await this._doAIGenerateMenu(); } finally { this._aiGenerating = false; }
  }

  async _doAIGenerateMenu() {
    const subjectChoice = await this.showPrompt(t('aiGenerateMenu', t('math'), t('science')));
    if (subjectChoice === null) return;
    const subjectIndex = parseInt(subjectChoice);
    if (isNaN(subjectIndex) || subjectIndex < 1 || subjectIndex > 2) {
      await this.showModal(t('invalidInput')); return;
    }
    const subject = subjectIndex === 1 ? 'math' : 'science';
    const subjectName = subjectIndex === 1 ? t('math') : t('science');

    const topics = problemGeneratorService.getTopics(subject);
    const topicKeys = Object.keys(topics);
    const topicList = Object.entries(topics).map(([key, info], i) => `${i + 1}. ${info.name}`).join('\n');

    const topicChoice = await this.showPrompt(t('aiTopicMenu', subjectName, topicList, topicKeys.length));
    if (topicChoice === null) return;
    const topicIndex = parseInt(topicChoice) - 1;
    if (isNaN(topicIndex) || topicIndex < 0 || topicIndex >= topicKeys.length) {
      await this.showModal(t('invalidInput')); return;
    }
    const selectedTopic = topicKeys[topicIndex];

    const difficultyChoice = await this.showPrompt(t('difficultyMenu', topics[selectedTopic].name, t('easy'), t('normal'), t('hard')), '2');
    if (difficultyChoice === null) return;
    const diff = parseInt(difficultyChoice);
    if (isNaN(diff) || diff < 1 || diff > 3) {
      await this.showModal(t('invalidInput')); return;
    }

    const diffName = [t('easy'), t('normal'), t('hard')][diff - 1];
    const countChoice = await this.showPrompt(t('countMenu', topics[selectedTopic].name, diffName), '5');
    if (countChoice === null) return;
    const count = parseInt(countChoice);
    if (isNaN(count) || count < 1 || count > 10) {
      await this.showModal(t('invalidInput')); return;
    }

    try {
      this.isGenerating = true;
      this.generatingMessage = t('generating');
      this.generatingSubMessage = t('generatingDesc', count);
      const problems = await problemGeneratorService.generateProblems(selectedTopic, diff, count, subject);
      this.isGenerating = false;

      if (problems && problems.length > 0) {
        let addedCount = 0;
        for (const p of problems) {
          const monster = {
            subject, question: p.question, answer: p.answer,
            answers: p.answers || [p.answer], choices: p.choices || [],
            correctIndex: p.correctIndex || 0, explanation: p.explanation || '',
            topic: p.topic || topics[selectedTopic].name,
            hp: 80 + (p.difficulty || diff) * 20, maxHp: 80 + (p.difficulty || diff) * 20,
            difficulty: p.difficulty || diff, isGenerated: true, createdAt: Date.now(), status: 'alive'
          };
          await this.db.add('monsters', monster);
          addedCount++;
        }
        await this.monsterManager.loadMonsters();
        const example = problems[0];
        await this.showModal(t('generated', addedCount, topics[selectedTopic].name, diffName, example.question, example.answer));
      } else { await this.showModal(t('generateFailed')); }
    } catch (err) {
      this.isGenerating = false;
      console.error('AI 문제 생성 오류:', err);
      await this.showModal(t('error') + err.message);
    }
  }

  // 레벨 진척도 상세
  showLevelProgress() {
    const pm = this.playerManager;
    const player = pm.player;
    const level = player.level;
    const currentExp = player.exp;
    const expForCurrentLevel = pm.getExpForLevel(level);
    const progress = pm.getLevelProgress();
    const progressPercent = Math.round(progress * 100);

    const hpBonus = pm.getLevelBonusHp();
    const damageBonus = pm.getLevelBonusDamage();
    const timeBonus = pm.getLevelBonusTime();

    const totalHp = pm.getTotalMaxHp();
    const totalDamage = pm.getTotalDamage();
    const totalTime = pm.getTotalTime(this.currentMonster?.difficulty);

    const nextDamageLevel = Math.ceil(level / LEVEL_CONFIG.damageLevelInterval) * LEVEL_CONFIG.damageLevelInterval + 1;
    const nextTimeLevel = Math.ceil(level / LEVEL_CONFIG.timeLevelInterval) * LEVEL_CONFIG.timeLevelInterval + 1;

    const existingModal = document.getElementById('level-modal');
    if (existingModal) existingModal.remove();

    let hpDetail = `${t('base')} ${GAME_CONFIG.DEFAULT_HP}`;
    if (hpBonus > 0) hpDetail += ` + ${t('level')} ${hpBonus}`;
    if (player.permanentUpgrades?.hp > 0) hpDetail += ` + ${t('upgrade')} ${player.permanentUpgrades.hp * UPGRADES.hp.value}`;

    let dmgDetail = `${t('base')} ${GAME_CONFIG.DEFAULT_DAMAGE}`;
    if (damageBonus > 0) dmgDetail += ` + ${t('level')} ${damageBonus}`;
    if (player.permanentUpgrades?.damage > 0) dmgDetail += ` + ${t('upgrade')} ${player.permanentUpgrades.damage * UPGRADES.damage.value}`;

    let timeDetail = `${t('base')} ${GAME_CONFIG.DEFAULT_TIME}`;
    if (timeBonus > 0) timeDetail += ` + ${t('level')} ${timeBonus}`;
    if (player.permanentUpgrades?.time > 0) timeDetail += ` + ${t('upgrade')} ${player.permanentUpgrades.time * UPGRADES.time.value}`;

    const modal = document.createElement('div');
    modal.id = 'level-modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; justify-content: center; align-items: center; font-family: system-ui, -apple-system, sans-serif;`;

    modal.innerHTML = `
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 20px; width: 340px; max-height: 80vh; overflow-y: auto; color: #e2e8f0; border: 1px solid #6366f1;">
        <h2 style="margin: 0 0 15px; text-align: center; color: #818cf8;">${t('levelProgress')}</h2>
        <div style="background: rgba(99,102,241,0.15); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 24px; font-weight: bold; color: #818cf8;">LV.${level}</span>
            <span style="color: #94a3b8;">/ ${LEVEL_CONFIG.displayMaxLevel}</span>
          </div>
          <div style="background: #0a0a0f; border-radius: 8px; height: 20px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #6366f1, #818cf8); height: 100%; width: ${progressPercent}%;"></div>
          </div>
          <div style="text-align: center; margin-top: 5px; font-size: 13px; color: #94a3b8;">${currentExp} / ${expForCurrentLevel} EXP (${progressPercent}%)</div>
        </div>
        <div style="background: rgba(34,197,94,0.1); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #22c55e;">${t('currentStats')}</div>
          <div style="font-size: 13px; line-height: 1.8;">
            <div>❤️ HP: <b>${totalHp}</b> <span style="color:#94a3b8; font-size:11px;">(${hpDetail})</span></div>
            <div>⚔️ ${t('attack')}: <b>${totalDamage}</b> <span style="color:#94a3b8; font-size:11px;">(${dmgDetail})</span></div>
            <div>⏱️ ${t('time')}: <b>${totalTime}${t('seconds')}</b> <span style="color:#94a3b8; font-size:11px;">(${timeDetail})</span></div>
          </div>
        </div>
        <div style="background: rgba(251,191,36,0.1); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #fbbf24;">${t('nextBonus')}</div>
          <div style="font-size: 13px; line-height: 1.8;">
            ${level >= LEVEL_CONFIG.maxLevel
              ? `<div style="color:#fbbf24;font-weight:bold;">${t('maxLevelBonus')}</div>`
              : `<div>${t('level')} ${level + 1}: ❤️ HP +1</div>
            ${nextDamageLevel <= LEVEL_CONFIG.displayMaxLevel ? `<div>${t('level')} ${nextDamageLevel}: ⚔️ ${t('attack')} +${LEVEL_CONFIG.damagePerLevels}</div>` : ''}
            ${nextTimeLevel <= LEVEL_CONFIG.displayMaxLevel ? `<div>${t('level')} ${nextTimeLevel}: ⏱️ ${t('time')} +${LEVEL_CONFIG.timePerLevels}${t('seconds')}</div>` : ''}
            <div style="color:#94a3b8;font-size:12px;">${t('level')} 100: 🏆 ${t('maxLevelBonus')}</div>`}
          </div>
        </div>
        <div style="background: rgba(99,102,241,0.1); border-radius: 10px; padding: 12px; margin-bottom: 15px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #818cf8;">${t('expGain')}</div>
          <div style="font-size: 13px; line-height: 1.8;">
            <div>${t('correctAnswer')}: <b>+${LEVEL_CONFIG.expPerCorrect}</b> EXP</div>
            <div>${t('monsterKill')}: <b>+${LEVEL_CONFIG.expPerMonsterKill}</b> EXP</div>
            <div>${t('normalBossLabel')} 👹: <b>+${LEVEL_CONFIG.expPerNormalBoss}</b> EXP</div>
            <div>${t('midBossLabel')} 👿: <b>+${LEVEL_CONFIG.expPerMidBoss}</b> EXP</div>
            <div>${t('finalBossLabel')} 🐉: <b>+${LEVEL_CONFIG.expPerFinalBoss}</b> EXP</div>
          </div>
        </div>
        <button id="close-level-modal" style="width: 100%; padding: 12px; border: none; border-radius: 10px; background: #6366f1; color: white; font-size: 16px; font-weight: bold; cursor: pointer;">${t('close')}</button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('close-level-modal').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }

  // 데이터 관리
  async resetAllProblems() {
    const monsters = this.monsterManager.monsters;
    if (monsters.length === 0) { await this.showModal(t('noProblemsToReset')); return; }

    if (!await this.showConfirm(t('confirmReset', monsters.length))) return;
    if (!await this.showConfirm(t('confirmResetFinal', monsters.length))) return;

    try {
      for (const monster of monsters) { await this.db.delete('monsters', monster.id); }
      this.monsterManager.monsters = [];
      await this.showModal(t('resetDone', monsters.length));
      this.render();
    } catch (error) {
      console.error('문제 초기화 오류:', error);
      await this.showModal(t('resetError'));
    }
  }

  async resetAccount() {
    if (!await this.showConfirm(t('confirmAccountReset'))) return;
    if (!await this.showConfirm(t('confirmAccountResetFinal'))) return;

    try {
      // 런 기록 삭제
      await this.db.clear('runs');
      // 아이템 삭제
      await this.db.clear('items');
      // 플레이어 초기화
      const newPlayer = this.playerManager.createNewPlayer();
      await this.db.put('player', newPlayer);
      this.playerManager.player = newPlayer;
      this.playerManager.player.maxHp = this.playerManager.getTotalMaxHp();
      this.playerManager.player.currentHp = this.playerManager.player.maxHp;
      // 업적/일일미션 초기화
      this.achievementManager.initDailyMissions();
      // 서버 동기화
      if (apiService.isLoggedIn()) {
        apiService.putPlayer(newPlayer).catch(() => {});
      }
      // localStorage 가이드 플래그 초기화
      safeRemoveItem('guide_shown');

      await this.showModal(t('accountResetDone'));
      this.changeScreen(SCREENS.MAIN);
    } catch (error) {
      console.error('계정 초기화 오류:', error);
      await this.showModal(t('accountResetError'));
    }
  }

  async exportProblems() {
    const monsters = this.monsterManager.monsters;
    if (monsters.length === 0) { await this.showModal(t('noExportData')); return; }

    try {
      const exportData = monsters.map(m => ({
        question: m.question, answer: m.answer, answers: m.answers,
        choices: m.choices, correctIndex: m.correctIndex, explanation: m.explanation,
        topic: m.topic, difficulty: m.difficulty, keywords: m.keywords,
        subject: m.subject, questionType: m.questionType, formula: m.formula
      }));

      const dataStr = JSON.stringify({ version: '1.0', exportDate: new Date().toISOString(), count: exportData.length, problems: exportData }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('exportFilename')}_${new Date().toISOString().slice(0, 10)}_${exportData.length}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await this.showModal(t('exported', exportData.length));
    } catch (error) {
      console.error('내보내기 오류:', error);
      await this.showModal(t('exportError'));
    }
  }

  importProblems() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.problems || !Array.isArray(data.problems)) { await this.showModal(t('invalidFile')); return; }
        if (data.problems.length === 0) { await this.showModal(t('noImportData')); return; }
        if (!await this.showConfirm(t('confirmImport', data.problems.length))) return;

        let addedCount = 0;
        for (const problem of data.problems) {
          if (!problem.question) continue;
          const monster = {
            id: Date.now() + Math.random(), subject: problem.subject || 'math',
            createdAt: Date.now(), status: 'alive', question: problem.question,
            answer: problem.answer || '', answers: problem.answers || [problem.answer],
            choices: problem.choices || [], correctIndex: problem.correctIndex || 0,
            explanation: problem.explanation || '', topic: problem.topic || '',
            difficulty: problem.difficulty || 2, keywords: problem.keywords || [],
            questionType: problem.questionType || t('multipleChoice'), formula: problem.formula || '',
            hp: 100, maxHp: 100
          };
          await this.db.add('monsters', monster);
          this.monsterManager.monsters.push(monster);
          addedCount++;
        }
        await this.showModal(t('imported', addedCount));
        this.render();
      } catch (error) {
        console.error('불러오기 오류:', error);
        await this.showModal(t('importError'));
      }
    };
    input.click();
  }

  // UI 헬퍼
  showAnalyzingScreen(apiName = 'AI') {
    Renderer.clear(); Renderer.drawGrid();
    Renderer.drawText(t('analyzing', apiName), 200, 300, { font: 'bold 24px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center' });
    Renderer.drawText(t('analyzingDesc'), 200, 350, { font: '16px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  }

  showGeneratingScreen(count) {
    Renderer.clear(); Renderer.drawGrid();
    Renderer.drawText(t('generating'), 200, 280, { font: 'bold 24px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center' });
    Renderer.drawText(t('generatingDesc', count), 200, 330, { font: '16px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
    Renderer.drawText(t('pleaseWait'), 200, 370, { font: '14px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  }

  // 커스텀 모달 (iOS Safari 대화상자 숨기기 방지)
  showModal(message) {
    return new Promise((resolve) => {
      const existing = document.getElementById('custom-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'custom-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

      modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:20px;width:320px;max-height:80vh;overflow-y:auto;color:#e2e8f0;border:1px solid #6366f1;">
          <div style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin-bottom:16px;">${message}</div>
          <button id="modal-ok-btn" style="width:100%;padding:12px;border:none;border-radius:10px;background:#6366f1;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('close')}</button>
        </div>
      `;

      document.body.appendChild(modal);
      document.getElementById('modal-ok-btn').onclick = () => { modal.remove(); resolve(); };
      modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(); } };
    });
  }

  showConfirm(message) {
    return new Promise((resolve) => {
      const existing = document.getElementById('custom-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'custom-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

      modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:20px;width:320px;max-height:80vh;overflow-y:auto;color:#e2e8f0;border:1px solid #6366f1;">
          <div style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin-bottom:16px;">${message}</div>
          <div style="display:flex;gap:10px;">
            <button id="modal-cancel-btn" style="flex:1;padding:12px;border:none;border-radius:10px;background:#374151;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('cancel') || '취소'}</button>
            <button id="modal-ok-btn" style="flex:1;padding:12px;border:none;border-radius:10px;background:#6366f1;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('confirm') || '확인'}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.getElementById('modal-ok-btn').onclick = () => { modal.remove(); resolve(true); };
      document.getElementById('modal-cancel-btn').onclick = () => { modal.remove(); resolve(false); };
      modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
    });
  }

  showPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
      const existing = document.getElementById('custom-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'custom-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

      modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:20px;width:320px;max-height:80vh;overflow-y:auto;color:#e2e8f0;border:1px solid #6366f1;">
          <div style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin-bottom:12px;">${message}</div>
          <input id="modal-input" type="text" value="${defaultValue}" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #4b5563;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:15px;margin-bottom:12px;">
          <div style="display:flex;gap:10px;">
            <button id="modal-cancel-btn" style="flex:1;padding:12px;border:none;border-radius:10px;background:#374151;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('cancel') || '취소'}</button>
            <button id="modal-ok-btn" style="flex:1;padding:12px;border:none;border-radius:10px;background:#6366f1;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('confirm') || '확인'}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const input = document.getElementById('modal-input');
      const modalContent = modal.firstElementChild;

      // iOS Safari: 지연 focus로 키보드 확실히 띄우기
      setTimeout(() => {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      // Android: 키보드 올라오면 모달 위치 조정
      const adjustForKeyboard = () => {
        if (window.visualViewport) {
          const vpHeight = window.visualViewport.height;
          modalContent.style.maxHeight = `${vpHeight * 0.7}px`;
          modal.style.alignItems = 'flex-start';
          modal.style.paddingTop = `${Math.max(20, (vpHeight - modalContent.offsetHeight) / 3)}px`;
        }
      };
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjustForKeyboard);
      }

      const cleanup = (value) => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', adjustForKeyboard);
        }
        modal.remove();
        resolve(value);
      };

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') cleanup(input.value); });
      document.getElementById('modal-ok-btn').onclick = () => cleanup(input.value);
      document.getElementById('modal-cancel-btn').onclick = () => cleanup(null);
      modal.onclick = (e) => { if (e.target === modal) cleanup(null); };
    });
  }

  async save() {
    await this.playerManager.save();
  }
}
