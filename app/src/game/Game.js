// 게임 메인 클래스
import { Renderer } from '../canvas/Renderer.js';
import { SCREENS, GAME_CONFIG, LEVEL_CONFIG, COLORS, SUBJECTS, RARITY, DROP_RATES, BOSS_CONFIG, UPGRADES, SHOP_ITEMS } from '../utils/constants.js';
import { geminiService } from '../services/GeminiService.js';
import { imageAnalysisService } from '../services/ImageAnalysisService.js';
import { problemGeneratorService } from '../services/ProblemGeneratorService.js';
import { SoundService } from '../services/SoundService.js';

export class Game {
  constructor(db) {
    this.db = db;
    this.player = null;
    this.currentScreen = SCREENS.MAIN;
    this.clickAreas = [];

    // 전투 상태
    this.battle = null;
    this.currentMonster = null;
    this.monsters = [];

    // 런 상태
    this.currentRun = null;
    this.stage = 0;
    this.combo = 0;
    this.timer = 30;
    this.lastTime = 0;
    this.finalBossWrongLastTurn = false;  // 최종보스 오답 플래그

    // 오답 등록 상태
    this.pendingImage = null;
    this.previewImg = null;
    this.previewImageLoaded = false;

    // 시각 효과 시스템
    this.effects = {
      particles: [],      // 파티클 효과
      floatingTexts: [],  // 떠오르는 텍스트 (데미지, 골드 등)
      screenShake: 0,     // 화면 흔들림 강도
      screenFlash: null,  // 화면 플래시 {color, alpha, duration}
      comboGlow: 0,       // 콤보 글로우 효과
      bossEntrance: 0,    // 보스 등장 연출
      pulseTime: 0        // 펄스 애니메이션 시간
    };
  }

  // 이펙트 업데이트
  updateEffects() {
    const now = Date.now();
    this.effects.pulseTime = now;

    // 파티클 업데이트
    this.effects.particles = this.effects.particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.life -= 16;
      p.alpha = Math.max(0, p.life / p.maxLife);
      return p.life > 0;
    });

    // 떠오르는 텍스트 업데이트
    this.effects.floatingTexts = this.effects.floatingTexts.filter(t => {
      t.y -= t.speed;
      t.life -= 16;
      t.alpha = Math.max(0, t.life / t.maxLife);
      t.scale = 1 + (1 - t.alpha) * 0.3;
      return t.life > 0;
    });

    // 화면 흔들림 감소
    if (this.effects.screenShake > 0) {
      this.effects.screenShake *= 0.85;
      if (this.effects.screenShake < 0.5) this.effects.screenShake = 0;
    }

    // 화면 플래시 감소
    if (this.effects.screenFlash) {
      this.effects.screenFlash.alpha -= 0.05;
      if (this.effects.screenFlash.alpha <= 0) {
        this.effects.screenFlash = null;
      }
    }

    // 콤보 글로우 감소
    if (this.effects.comboGlow > 0) {
      this.effects.comboGlow *= 0.95;
    }

    // 보스 등장 연출
    if (this.effects.bossEntrance > 0) {
      this.effects.bossEntrance -= 0.02;
    }
  }

  // 이펙트 렌더링
  renderEffects() {
    const ctx = Renderer.ctx;

    // 파티클 렌더링
    for (const p of this.effects.particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 떠오르는 텍스트 렌더링
    for (const t of this.effects.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.font = `bold ${Math.round(t.fontSize * t.scale)}px system-ui`;
      ctx.fillStyle = t.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // 외곽선
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }

    // 화면 플래시
    if (this.effects.screenFlash) {
      ctx.save();
      ctx.globalAlpha = this.effects.screenFlash.alpha;
      ctx.fillStyle = this.effects.screenFlash.color;
      ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
      ctx.restore();
    }
  }

  // 데미지 숫자 띄우기
  addDamageText(x, y, damage, isPlayerDamage = false) {
    this.effects.floatingTexts.push({
      x, y,
      text: isPlayerDamage ? `-${damage}` : `-${damage}`,
      color: isPlayerDamage ? '#ef4444' : '#fbbf24',
      fontSize: isPlayerDamage ? 24 : 20,
      speed: 2,
      life: 800,
      maxLife: 800,
      alpha: 1,
      scale: 1
    });
  }

  // 골드 획득 텍스트
  addGoldText(x, y, amount) {
    this.effects.floatingTexts.push({
      x, y,
      text: `+${amount}G`,
      color: '#fbbf24',
      fontSize: 18,
      speed: 1.5,
      life: 1000,
      maxLife: 1000,
      alpha: 1,
      scale: 1
    });
  }

  // 콤보 텍스트
  addComboText(combo) {
    this.effects.floatingTexts.push({
      x: 200,
      y: 400,
      text: `${combo} COMBO!`,
      color: combo >= 10 ? '#ff6b6b' : combo >= 5 ? '#fbbf24' : '#22c55e',
      fontSize: combo >= 10 ? 36 : combo >= 5 ? 30 : 24,
      speed: 1,
      life: 600,
      maxLife: 600,
      alpha: 1,
      scale: 1
    });
    this.effects.comboGlow = 1;
  }

  // 파티클 폭발
  addParticleExplosion(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      this.effects.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.1,
        size: 3 + Math.random() * 4,
        color,
        life: 500 + Math.random() * 300,
        maxLife: 800,
        alpha: 1
      });
    }
  }

  // 화면 흔들림
  shakeScreen(intensity = 10) {
    this.effects.screenShake = intensity;
  }

  // 화면 플래시
  flashScreen(color, alpha = 0.3) {
    this.effects.screenFlash = { color, alpha };
  }

  // 보스 등장 연출 시작
  startBossEntrance() {
    this.effects.bossEntrance = 1;
    this.flashScreen('#ff0000', 0.4);
    this.shakeScreen(15);
  }

  async init() {
    await this.loadPlayer();
    await this.loadMonsters();

    // Gemini API 키 로드
    geminiService.loadApiKey();

    console.log('🎮 Game initialized');
  }

  // 플레이어 로드
  async loadPlayer() {
    let playerData = await this.db.get('player', 'main');

    if (!playerData) {
      playerData = this.createNewPlayer();
      await this.db.put('player', playerData);
    }

    this.player = playerData;

    // HP 최대치로 리셋 (게임 시작 시 항상 풀 HP)
    this.player.maxHp = this.getTotalMaxHp();
    this.player.currentHp = this.player.maxHp;
    await this.db.put('player', this.player);
  }

  // 새 플레이어 생성
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
      stats: { totalRuns: 0, totalKills: 0, bestCombo: 0 },
      createdAt: Date.now()
    };
  }

  // 몬스터 로드
  async loadMonsters() {
    this.monsters = await this.db.getByIndex('monsters', 'status', 'alive');
  }

  // ===== 레벨 시스템 =====

  // 레벨업에 필요한 경험치
  getExpForLevel(level) {
    return LEVEL_CONFIG.expPerLevel(level);
  }

  // 현재 레벨의 진행도 (0~1)
  getLevelProgress() {
    const currentExp = this.player.exp;
    const requiredExp = this.getExpForLevel(this.player.level);
    return Math.min(currentExp / requiredExp, 1);
  }

  // 레벨 보너스: HP
  getLevelBonusHp() {
    return (this.player.level - 1) * LEVEL_CONFIG.hpPerLevel;
  }

  // 레벨 보너스: 공격력 (5레벨마다 +5)
  getLevelBonusDamage() {
    const bonusCount = Math.floor(this.player.level / LEVEL_CONFIG.damageLevelInterval);
    return bonusCount * LEVEL_CONFIG.damagePerLevels;
  }

  // 레벨 보너스: 시간 (10레벨마다 +5초)
  getLevelBonusTime() {
    const bonusCount = Math.floor(this.player.level / LEVEL_CONFIG.timeLevelInterval);
    return bonusCount * LEVEL_CONFIG.timePerLevels;
  }

  // 총 최대 HP (기본 + 레벨 보너스 + 영구 강화)
  getTotalMaxHp() {
    const base = GAME_CONFIG.DEFAULT_HP;
    const levelBonus = this.getLevelBonusHp();
    const upgradeBonus = (this.player.permanentUpgrades?.hp || 0) * (UPGRADES.hp?.value || 10);
    return base + levelBonus + upgradeBonus;
  }

  // 총 공격력 (기본 + 레벨 보너스 + 영구 강화)
  getTotalDamage() {
    const base = GAME_CONFIG.DEFAULT_DAMAGE;
    const levelBonus = this.getLevelBonusDamage();
    const upgradeBonus = (this.player.permanentUpgrades?.damage || 0) * (UPGRADES.damage?.value || 5);
    return base + levelBonus + upgradeBonus;
  }

  // 총 문제 풀이 시간 (난이도별 기본 + 레벨 보너스 + 영구 강화)
  getTotalTime() {
    // 난이도별 기본 시간: 쉬움(1)=60초, 중간(2)=100초, 어려움(3)=160초
    const difficulty = this.currentMonster?.difficulty || 2;
    let base;
    if (difficulty <= 1) {
      base = 60;   // 쉬움
    } else if (difficulty >= 3) {
      base = 160;  // 어려움
    } else {
      base = 100;  // 중간
    }
    const levelBonus = this.getLevelBonusTime();
    const upgradeBonus = (this.player.permanentUpgrades?.time || 0) * (UPGRADES.time?.value || 3);
    return base + levelBonus + upgradeBonus;
  }

  // 경험치 획득
  async gainExp(amount) {
    if (this.player.level >= LEVEL_CONFIG.maxLevel) return;

    this.player.exp += amount;
    console.log(`✨ 경험치 +${amount} (현재: ${this.player.exp})`);

    // 레벨업 체크
    while (this.player.exp >= this.getExpForLevel(this.player.level) &&
           this.player.level < LEVEL_CONFIG.maxLevel) {
      this.player.exp -= this.getExpForLevel(this.player.level);
      this.player.level++;

      // maxHp 업데이트
      this.player.maxHp = this.getTotalMaxHp();
      this.player.currentHp = this.player.maxHp; // 레벨업 시 풀 회복

      SoundService.playClick(); // 레벨업 효과음
      console.log(`🎉 레벨업! LV.${this.player.level}`);

      // 보너스 안내
      const bonusMsg = this.getLevelUpBonusMessage();
      if (bonusMsg) {
        alert(`🎉 레벨업! LV.${this.player.level}\n\n${bonusMsg}`);
      } else {
        alert(`🎉 레벨업! LV.${this.player.level}\n\nHP +1`);
      }
    }

    await this.db.put('player', this.player);
  }

  // 레벨업 보너스 메시지
  getLevelUpBonusMessage() {
    const level = this.player.level;
    const bonuses = [`HP +${LEVEL_CONFIG.hpPerLevel}`];

    if (level % LEVEL_CONFIG.damageLevelInterval === 0) {
      bonuses.push(`공격력 +${LEVEL_CONFIG.damagePerLevels}`);
    }
    if (level % LEVEL_CONFIG.timeLevelInterval === 0) {
      bonuses.push(`문제 시간 +${LEVEL_CONFIG.timePerLevels}초`);
    }

    return bonuses.join('\n');
  }

  // ===== 레벨 시스템 끝 =====

  // 화면 전환
  changeScreen(screen) {
    this.currentScreen = screen;
    this.clearClickAreas();

    // 메인 화면으로 돌아올 때 HP 풀 회복 + BGM 시작
    if (screen === SCREENS.MAIN && this.player) {
      this.player.maxHp = this.getTotalMaxHp();
      this.player.currentHp = this.player.maxHp;
      this.db.put('player', this.player);
      SoundService.init();
      SoundService.startLobbyBgm();
    }

    // 전투 화면 진입 시 BGM 정지
    if (screen === SCREENS.BATTLE) {
      SoundService.stopBgm();
    }
  }

  // 클릭 영역 관리
  registerClickArea(id, x, y, width, height, callback) {
    this.clickAreas.push({ id, x, y, width, height, callback });
  }

  clearClickAreas() {
    this.clickAreas = [];
  }

  // 입력 처리
  handleInput(x, y) {
    // 첫 인터랙션 시 BGM 시작 (Web Audio API 정책)
    if (!this._bgmInitiated) {
      this._bgmInitiated = true;
      SoundService.init();
      if (this.currentScreen === SCREENS.MAIN) {
        SoundService.startLobbyBgm();
      }
    }

    for (const area of this.clickAreas) {
      if (x >= area.x && x <= area.x + area.width &&
          y >= area.y && y <= area.y + area.height) {
        // 사운드 토글 버튼은 콜백 먼저 실행 (토글 후 클릭음 방지)
        if (area.id === 'toggleSfx' || area.id === 'toggleBgm') {
          area.callback();
        } else {
          SoundService.playClick();
          area.callback();
        }
        return;
      }
    }
  }

  // 업데이트
  update() {
    // 이펙트 업데이트
    this.updateEffects();

    if (this.currentScreen === SCREENS.BATTLE) {
      this.updateBattle();
    }
  }

  updateBattle() {
    // 타이머 업데이트
    const now = Date.now();
    if (this.lastTime > 0) {
      const delta = (now - this.lastTime) / 1000;
      const prevTimer = this.timer;
      this.timer -= delta;

      // 10초 이하일 때 매초 경고음
      if (this.timer <= 10 && this.timer > 0) {
        const prevSec = Math.ceil(prevTimer);
        const currSec = Math.ceil(this.timer);
        if (prevSec !== currSec) {
          SoundService.playTimerWarning();
        }
      }

      if (this.timer <= 0) {
        this.onTimeOut();
      }
    }
    this.lastTime = now;
  }

  // 렌더링
  render() {
    const ctx = Renderer.ctx;

    // 화면 흔들림 적용
    ctx.save();
    if (this.effects.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.effects.screenShake;
      const shakeY = (Math.random() - 0.5) * this.effects.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    Renderer.clear();
    this.clearClickAreas();

    switch (this.currentScreen) {
      case SCREENS.MAIN:
        this.renderMainScreen();
        break;
      case SCREENS.REGISTER:
        this.renderRegisterScreen();
        break;
      case SCREENS.BATTLE:
        this.renderBattleScreen();
        break;
      case SCREENS.RESULT:
        this.renderResultScreen();
        break;
      case SCREENS.SETTINGS:
        this.renderSettingsScreen();
        break;
      case SCREENS.SHOP:
        this.renderShopScreen();
        break;
    }

    // 이펙트 렌더링 (파티클, 플로팅 텍스트, 플래시)
    this.renderEffects();

    ctx.restore();
  }

  // 메인 화면
  renderMainScreen() {
    // 메인 화면에서는 항상 HP 풀 회복
    if (this.player) {
      this.player.maxHp = this.getTotalMaxHp();
      this.player.currentHp = this.player.maxHp;
    }

    Renderer.drawGrid();

    // ===== 타이틀 =====
    Renderer.drawText('오답헌터', 200, 38, {
      font: 'bold 48px system-ui',
      color: COLORS.ACCENT_LIGHT,
      align: 'center'
    });
    Renderer.drawText('로그라이크 학습 RPG', 200, 90, {
      font: '18px system-ui',
      color: COLORS.TEXT_SECONDARY,
      align: 'center'
    });

    // ===== 플레이어 정보 카드 =====
    Renderer.roundRect(20, 125, 360, 110, 14, COLORS.BG_CARD);

    // 레벨 (좌측)
    Renderer.roundRect(30, 135, 70, 55, 12, 'rgba(99,102,241,0.2)');
    Renderer.drawText(`LV.${this.player.level}`, 65, 162, {
      font: 'bold 20px system-ui',
      color: COLORS.ACCENT_LIGHT,
      align: 'center',
      baseline: 'middle'
    });
    this.registerClickArea('levelDetail', 30, 135, 70, 55, () => this.showLevelProgress());

    // 경험치 바
    const expProgress = this.getLevelProgress();
    const expRequired = this.getExpForLevel(this.player.level);
    Renderer.drawText('EXP', 115, 145, { font: '11px system-ui', color: COLORS.TEXT_SECONDARY });
    Renderer.roundRect(145, 142, 140, 16, 8, COLORS.BG_SECONDARY);
    if (expProgress > 0) {
      Renderer.roundRect(145, 142, Math.max(8, 140 * expProgress), 16, 8, COLORS.ACCENT);
    }
    Renderer.drawText(`${this.player.exp}/${expRequired}`, 295, 145, {
      font: '11px system-ui',
      color: COLORS.TEXT_PRIMARY
    });

    // 골드
    Renderer.drawText(`💰 ${this.player.gold.toLocaleString()}G`, 330, 175, {
      font: 'bold 16px system-ui',
      color: COLORS.WARNING,
      align: 'center'
    });

    // HP 바
    Renderer.drawText('❤️', 40, 208, { font: '14px system-ui' });
    Renderer.drawHPBar(65, 205, 230, 18, this.player.currentHp, this.player.maxHp, COLORS.HP_PLAYER);
    Renderer.drawText(`${Math.round(this.player.currentHp)}/${this.player.maxHp}`, 310, 208, {
      font: 'bold 13px system-ui',
      color: COLORS.TEXT_PRIMARY
    });

    // ===== 스탯 바 =====
    const totalDmg = this.getTotalDamage();
    const inv = this.player.inventory || {};

    Renderer.roundRect(20, 250, 360, 40, 10, COLORS.BG_CARD);

    // 4등분 (x: 65, 155, 245, 335)
    Renderer.drawText(`⚔️ ${totalDmg}`, 65, 266, {
      font: 'bold 14px system-ui',
      color: COLORS.TEXT_PRIMARY,
      align: 'center'
    });
    Renderer.drawText(`👾 ${this.monsters.length}`, 155, 266, {
      font: 'bold 14px system-ui',
      color: COLORS.TEXT_PRIMARY,
      align: 'center'
    });
    Renderer.drawText(`🪶 ${inv.reviveTicket || 0}`, 245, 266, {
      font: 'bold 14px system-ui',
      color: COLORS.WARNING,
      align: 'center'
    });
    Renderer.drawText(`💡 ${inv.hintTicket || 0}`, 335, 266, {
      font: 'bold 14px system-ui',
      color: COLORS.WARNING,
      align: 'center'
    });

    // ===== 버튼들 =====
    // 던전 입장
    Renderer.drawButton(20, 310, 360, 60, '⚔️ 던전 입장', {
      bgColor: COLORS.ACCENT,
      fontSize: 20
    });
    this.registerClickArea('dungeon', 20, 310, 360, 60, () => this.startDungeon());

    // 오답 등록 버튼 (HTML) - y: 385~445
    // main.js에서 위치 설정

    // 상점 & 설정
    Renderer.drawButton(20, 465, 175, 55, '🏪 상점', {
      bgColor: COLORS.BG_CARD,
      borderColor: COLORS.WARNING,
      fontSize: 17
    });
    this.registerClickArea('shop', 20, 465, 175, 55, () => this.changeScreen(SCREENS.SHOP));

    Renderer.drawButton(205, 465, 175, 55, '⚙️ 설정', {
      bgColor: COLORS.BG_CARD,
      borderColor: COLORS.TEXT_SECONDARY,
      fontSize: 17
    });
    this.registerClickArea('settings', 205, 465, 175, 55, () => this.changeScreen(SCREENS.SETTINGS));

    // AI 상태
    const hasSmilePrintKey = problemGeneratorService.hasApiKey();
    if (hasSmilePrintKey) {
      Renderer.drawButton(20, 540, 360, 45, '🤖 AI 수학문제 생성', {
        bgColor: 'rgba(99,102,241,0.2)',
        borderColor: COLORS.ACCENT,
        fontSize: 15
      });
      this.registerClickArea('aiGenerate', 20, 540, 360, 45, () => this.showAIGenerateMenu());
    } else {
      Renderer.roundRect(20, 540, 360, 40, 10, COLORS.BG_CARD);
      const hasGemini = geminiService.hasApiKey();
      const aiStatus = hasGemini ? '🟢 AI 연동됨' : '🔴 AI 미연동 (설정에서 연동)';
      Renderer.drawText(aiStatus, 200, 556, {
        font: '12px system-ui',
        color: hasGemini ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY,
        align: 'center'
      });
    }

    // BGM / 효과음 토글 버튼
    const bgmOn = SoundService.bgmEnabled;
    const sfxOn = SoundService.sfxEnabled;

    Renderer.roundRect(20, 600, 175, 36, 10, bgmOn ? 'rgba(99,102,241,0.2)' : COLORS.BG_CARD);
    Renderer.roundRect(20, 600, 175, 36, 10, null, bgmOn ? COLORS.ACCENT : COLORS.TEXT_SECONDARY);
    Renderer.drawText(bgmOn ? '🎵 BGM ON' : '🔇 BGM OFF', 107, 612, {
      font: 'bold 13px system-ui',
      color: bgmOn ? COLORS.ACCENT_LIGHT : COLORS.TEXT_SECONDARY,
      align: 'center'
    });
    this.registerClickArea('toggleBgm', 20, 600, 175, 36, () => {
      SoundService.toggleBgm();
    });

    Renderer.roundRect(205, 600, 175, 36, 10, sfxOn ? 'rgba(34,197,94,0.15)' : COLORS.BG_CARD);
    Renderer.roundRect(205, 600, 175, 36, 10, null, sfxOn ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY);
    Renderer.drawText(sfxOn ? '🔊 효과음 ON' : '🔈 효과음 OFF', 292, 612, {
      font: 'bold 13px system-ui',
      color: sfxOn ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY,
      align: 'center'
    });
    this.registerClickArea('toggleSfx', 205, 600, 175, 36, () => {
      SoundService.toggleSfx();
    });

    // 하단 슬로건
    Renderer.drawText('내 오답이 몬스터가 된다!', 200, 660, {
      font: '14px system-ui',
      color: COLORS.TEXT_SECONDARY,
      align: 'center'
    });
  }

  // 다시 촬영 (HTML input 사용)
  startRegister() {
    this.pendingImage = null;
    this.previewImg = null;
    this.previewImageLoaded = false;
    this.changeScreen(SCREENS.MAIN);
    // 메인 화면으로 돌아가면 HTML 버튼이 표시됨
  }

  // 오답 등록 화면 (사진 촬영 후 과목 선택)
  renderRegisterScreen() {
    Renderer.drawGrid();

    // 헤더
    Renderer.roundRect(0, 0, 400, 60, 0, COLORS.BG_SECONDARY);
    Renderer.drawText('📸 과목 선택', 200, 20, {
      font: 'bold 18px system-ui',
      align: 'center'
    });

    // 뒤로가기
    Renderer.drawText('← 취소', 30, 22, {
      font: '14px system-ui',
      color: COLORS.ACCENT_LIGHT
    });
    this.registerClickArea('back', 10, 10, 80, 40, () => {
      this.pendingImage = null;
      this.changeScreen(SCREENS.MAIN);
    });

    // 촬영된 이미지 미리보기
    if (this.pendingImage && !this.previewImageLoaded) {
      this.previewImg = new Image();
      this.previewImg.onload = () => {
        this.previewImageLoaded = true;
      };
      this.previewImg.src = this.pendingImage;
    }

    // 이미지 미리보기 영역
    Renderer.roundRect(50, 80, 300, 200, 16, COLORS.BG_CARD);
    if (this.previewImg && this.previewImg.complete) {
      // 이미지 비율 유지하며 표시
      const maxW = 280, maxH = 180;
      const ratio = Math.min(maxW / this.previewImg.width, maxH / this.previewImg.height);
      const w = this.previewImg.width * ratio;
      const h = this.previewImg.height * ratio;
      const x = 50 + (300 - w) / 2;
      const y = 80 + (200 - h) / 2;
      Renderer.drawImage(this.previewImg, x, y, w, h);
    } else {
      Renderer.drawText('📷 촬영된 사진', 200, 170, {
        font: '16px system-ui',
        color: COLORS.TEXT_SECONDARY,
        align: 'center'
      });
    }

    // 안내 텍스트
    Renderer.drawText('이 문제의 과목을 선택하세요', 200, 310, {
      font: '16px system-ui',
      color: COLORS.TEXT_PRIMARY,
      align: 'center'
    });

    // 과목 선택 버튼
    const subjects = Object.values(SUBJECTS);
    const btnWidth = 170;
    const btnHeight = 60;

    subjects.forEach((subj, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 20 + col * (btnWidth + 10);
      const y = 350 + row * (btnHeight + 15);

      Renderer.drawButton(x, y, btnWidth, btnHeight, `${subj.icon} ${subj.name}`, {
        bgColor: COLORS.BG_CARD,
        borderColor: subj.color,
        fontSize: 16
      });
      this.registerClickArea(`subject_${subj.id}`, x, y, btnWidth, btnHeight, () => this.completeRegister(subj.id));
    });

    // 다시 촬영 버튼 (메인으로 돌아가서 다시)
    Renderer.drawButton(100, 560, 200, 45, '← 취소', {
      bgColor: COLORS.BG_SECONDARY,
      borderColor: COLORS.TEXT_SECONDARY,
      fontSize: 14
    });
    this.registerClickArea('retake', 100, 560, 200, 45, () => this.startRegister());
  }

  // 전투 화면
  renderBattleScreen() {
    if (!this.currentMonster) return;

    // 상단 HUD
    Renderer.roundRect(0, 0, 400, 80, 0, COLORS.BG_SECONDARY);

    // 플레이어 HP
    Renderer.drawText('HP', 20, 20, { font: '12px system-ui', color: COLORS.TEXT_SECONDARY });
    Renderer.drawHPBar(50, 18, 150, 18, this.player.currentHp, this.player.maxHp, COLORS.HP_PLAYER);
    Renderer.drawText(`${Math.round(this.player.currentHp)}/${this.player.maxHp}`, 210, 20, {
      font: '13px system-ui'
    });

    // 레벨 & 골드
    Renderer.roundRect(270, 15, 50, 24, 12, COLORS.ACCENT);
    Renderer.drawText(`LV.${this.player.level}`, 295, 20, {
      font: 'bold 11px system-ui',
      align: 'center'
    });

    Renderer.drawText(`💰 ${this.player.gold}`, 340, 20, {
      font: '12px system-ui',
      color: COLORS.WARNING
    });

    // 스테이지 & 정답률
    Renderer.drawText(`스테이지 ${this.stage}/${GAME_CONFIG.STAGES_PER_DUNGEON}`, 20, 52, {
      font: '14px system-ui'
    });

    // 정답률 표시 (5문제 이상일 때만)
    const totalAnswers = this.currentRun?.totalAnswers || 0;
    if (totalAnswers >= 5) {
      const accuracy = Math.round(this.getAccuracyRate() * 100);
      const accuracyColor = accuracy >= 80 ? '#ef4444' : accuracy < 50 ? '#22c55e' : COLORS.TEXT_SECONDARY;
      const diffLabel = accuracy >= 80 ? '↑' : accuracy < 50 ? '↓' : '';
      Renderer.drawText(`정답률 ${accuracy}%${diffLabel}`, 160, 52, {
        font: '12px system-ui',
        color: accuracyColor
      });
    }

    if (this.combo > 0) {
      Renderer.roundRect(280, 45, 100, 24, 12, 'rgba(251,191,36,0.2)');
      Renderer.drawText(`🔥 ${this.combo} COMBO`, 330, 50, {
        font: 'bold 12px system-ui',
        color: COLORS.WARNING,
        align: 'center'
      });
    }

    // 몬스터 영역 (보스 타입별 다른 스타일)
    const bossType = this.currentMonster.bossType;
    let monsterBgColor = COLORS.BG_CARD;
    let monsterCircleColor = 'rgba(239,68,68,0.1)';
    let hpBarColor = COLORS.HP_ENEMY;
    let monsterIcon = this.currentMonster.icon || '👾';
    let iconSize = '50px';

    if (bossType === 'FINAL_BOSS') {
      monsterBgColor = 'rgba(255,0,0,0.2)';
      monsterCircleColor = 'rgba(255,215,0,0.3)';
      hpBarColor = '#ff0000';
      iconSize = '60px';
    } else if (bossType === 'MID_BOSS') {
      monsterBgColor = 'rgba(128,0,128,0.2)';
      monsterCircleColor = 'rgba(128,0,128,0.2)';
      hpBarColor = '#9932cc';
      iconSize = '55px';
    } else if (bossType === 'NORMAL_BOSS') {
      monsterBgColor = 'rgba(255,69,0,0.15)';
      monsterCircleColor = 'rgba(255,69,0,0.2)';
      hpBarColor = '#ff4500';
    }

    Renderer.roundRect(20, 100, 360, 180, 20, monsterBgColor);

    // 보스 테두리 (펄스 효과)
    if (bossType) {
      const pulseAlpha = 0.6 + Math.sin(this.effects.pulseTime / 200) * 0.4;
      const ctx = Renderer.ctx;
      ctx.save();
      ctx.globalAlpha = pulseAlpha;
      Renderer.roundRect(20, 100, 360, 180, 20, null, hpBarColor);
      ctx.restore();
    }

    // 몬스터 아이콘 (호흡 애니메이션)
    const breathScale = 1 + Math.sin(this.effects.pulseTime / 500) * 0.05;
    const circleRadius = 45 * breathScale;
    Renderer.drawCircle(200, 165, circleRadius, monsterCircleColor);

    // 보스 등장 연출 중이면 확대 효과
    let displayIconSize = parseInt(iconSize);
    if (this.effects.bossEntrance > 0) {
      displayIconSize = displayIconSize * (1 + this.effects.bossEntrance * 0.5);
    }

    Renderer.drawText(monsterIcon, 200, 145, {
      font: `${displayIconSize}px system-ui`,
      align: 'center'
    });

    Renderer.drawText(this.currentMonster.name || '오답 몬스터', 200, 220, {
      font: 'bold 16px system-ui',
      color: bossType ? hpBarColor : COLORS.TEXT_PRIMARY,
      align: 'center'
    });

    Renderer.drawHPBar(100, 245, 200, 12, this.currentMonster.hp, this.currentMonster.maxHp, hpBarColor);
    Renderer.drawText(`HP ${Math.round(this.currentMonster.hp)}/${this.currentMonster.maxHp}`, 200, 262, {
      font: '11px system-ui',
      color: COLORS.TEXT_SECONDARY,
      align: 'center'
    });

    // 문제 카드
    Renderer.roundRect(20, 300, 360, 140, 20, COLORS.BG_CARD);
    Renderer.roundRect(20, 300, 360, 140, 20, null, COLORS.ACCENT);

    Renderer.roundRect(160, 288, 80, 24, 12, COLORS.ACCENT);
    Renderer.drawText('QUESTION', 200, 293, {
      font: 'bold 11px system-ui',
      align: 'center'
    });

    // 문제 텍스트 (최대 6줄)
    const questionText = this.currentMonster.question || '문제를 불러오는 중...';
    const maxCharsPerLine = 22;  // 한 줄 최대 글자 수
    const maxLines = 6;
    const lineHeight = 18;
    const fontSize = 13;

    // 텍스트를 줄 단위로 분리
    const lines = [];
    for (let i = 0; i < questionText.length && lines.length < maxLines; i += maxCharsPerLine) {
      let line = questionText.slice(i, i + maxCharsPerLine);
      // 마지막 줄이고 텍스트가 더 있으면 ... 추가
      if (lines.length === maxLines - 1 && i + maxCharsPerLine < questionText.length) {
        line = line.slice(0, -3) + '...';
      }
      lines.push(line);
    }

    // 중앙 정렬을 위한 시작 Y 좌표 계산
    const totalHeight = lines.length * lineHeight;
    const startY = 360 - totalHeight / 2 + lineHeight / 2;

    lines.forEach((line, i) => {
      Renderer.drawText(line, 200, startY + i * lineHeight, {
        font: `bold ${fontSize}px system-ui`,
        align: 'center'
      });
    });

    // 문제 전체보기 버튼 (문제가 길 경우)
    if (questionText.length > maxCharsPerLine * 2) {
      Renderer.drawText('🔍 전체보기', 355, 310, {
        font: '11px system-ui',
        color: COLORS.ACCENT_LIGHT,
        align: 'center'
      });
      this.registerClickArea('viewQuestion', 320, 300, 70, 25, () => this.showFullQuestion());
    }

    // 선택지 (2x2 배치)
    const choices = this.currentMonster.choices || ['①', '②', '③', '④'];
    const choiceWidth = 175;
    const choiceHeight = 50;
    const gapX = 10;
    const gapY = 8;
    const startX = 20;
    const choiceStartY = 455;

    choices.forEach((choice, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = startX + col * (choiceWidth + gapX);
      const y = choiceStartY + row * (choiceHeight + gapY);

      Renderer.roundRect(x, y, choiceWidth, choiceHeight, 12, COLORS.BG_CARD);
      Renderer.roundRect(x, y, choiceWidth, choiceHeight, 12, null, 'rgba(99,102,241,0.3)');

      // 번호 표시
      Renderer.drawText(`${i + 1}.`, x + 15, y + choiceHeight / 2 - 5, {
        font: 'bold 14px system-ui',
        color: COLORS.ACCENT_LIGHT
      });

      // 선택지 텍스트 (길면 잘라서 표시)
      const choiceText = String(choice).length > 12 ? String(choice).substring(0, 12) + '...' : String(choice);
      Renderer.drawText(choiceText, x + 35, y + choiceHeight / 2 - 5, {
        font: 'bold 16px system-ui',
        color: COLORS.TEXT_PRIMARY
      });

      this.registerClickArea(`choice_${i}`, x, y, choiceWidth, choiceHeight, () => this.selectAnswer(i));
    });

    // 타이머 바
    const maxTime = this.getTotalTime();
    Renderer.drawTimerBar(100, 575, 200, 12, this.timer, maxTime, this.effects.pulseTime);

    // 타이머 텍스트
    const timerColor = this.timer < 10 ? COLORS.DANGER : this.timer < maxTime * 0.25 ? COLORS.WARNING : COLORS.TEXT_PRIMARY;
    Renderer.drawText(`⏱️ ${Math.max(0, Math.ceil(this.timer))}초`, 200, 595, {
      font: 'bold 14px system-ui',
      color: timerColor,
      align: 'center'
    });

    // 아이템 드랍 알림
    if (this.droppedItem) {
      const item = this.droppedItem;
      Renderer.roundRect(50, 140, 300, 50, 12, item.rarity.color);
      Renderer.drawText(`${item.icon} ${item.name} 획득!`, 200, 155, {
        font: 'bold 16px system-ui',
        color: '#000',
        align: 'center'
      });
      Renderer.drawText(`[${item.rarity.name}]`, 200, 175, {
        font: '12px system-ui',
        color: '#333',
        align: 'center'
      });
    }

    // 하단 버튼 (4개 배치)
    Renderer.roundRect(0, 610, 400, 90, 0, COLORS.BG_SECONDARY);

    // 힌트 (보유 개수 표시)
    const hintCount = this.player.inventory?.hintTicket || 0;
    const hasHint = hintCount > 0;
    Renderer.drawButton(10, 625, 90, 45, `💡${hintCount}`, {
      bgColor: hasHint ? 'rgba(251,191,36,0.2)' : 'rgba(100,100,100,0.15)',
      borderColor: hasHint ? 'rgba(251,191,36,0.6)' : 'rgba(100,100,100,0.3)',
      textColor: hasHint ? COLORS.WARNING : COLORS.TEXT_SECONDARY,
      fontSize: 13
    });
    this.registerClickArea('hint', 10, 625, 90, 45, () => this.useHint());

    // 시간연장
    const hasTimeBoost = (this.player.inventory?.timeBoost || 0) > 0;
    Renderer.drawButton(105, 625, 90, 45, `⏰${this.player.inventory?.timeBoost || 0}`, {
      bgColor: hasTimeBoost ? 'rgba(34,197,94,0.2)' : 'rgba(100,100,100,0.15)',
      borderColor: hasTimeBoost ? 'rgba(34,197,94,0.6)' : 'rgba(100,100,100,0.3)',
      textColor: hasTimeBoost ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY,
      fontSize: 13
    });
    this.registerClickArea('timeBoost', 105, 625, 90, 45, () => this.useTimeBoost());

    // 스킵
    Renderer.drawButton(200, 625, 90, 45, '⏭️스킵', {
      bgColor: 'rgba(239,68,68,0.15)',
      borderColor: 'rgba(239,68,68,0.5)',
      textColor: COLORS.DANGER,
      fontSize: 13
    });
    this.registerClickArea('skip', 200, 625, 90, 45, () => this.skipQuestion());

    // 포기
    Renderer.drawButton(295, 625, 95, 45, '🚪포기', {
      bgColor: 'rgba(99,102,241,0.15)',
      borderColor: 'rgba(99,102,241,0.5)',
      textColor: COLORS.ACCENT_LIGHT,
      fontSize: 13
    });
    this.registerClickArea('quit', 295, 625, 95, 45, () => this.endRun(false));
  }

  // 결과 화면
  renderResultScreen() {
    Renderer.drawGrid();

    const isWin = this.currentRun?.result === 'clear';
    const title = isWin ? '🎉 클리어!' : '💀 실패...';
    const titleColor = isWin ? COLORS.SUCCESS : COLORS.DANGER;

    Renderer.drawText(title, 200, 100, {
      font: 'bold 32px system-ui',
      color: titleColor,
      align: 'center'
    });

    // 결과 카드
    Renderer.roundRect(50, 160, 300, 230, 20, COLORS.BG_CARD);

    Renderer.drawText(`스테이지: ${this.stage}/10`, 200, 190, {
      font: '16px system-ui',
      align: 'center'
    });

    Renderer.drawText(`처치한 몬스터: ${this.currentRun?.defeatedMonsters?.length || 0}`, 200, 230, {
      font: '16px system-ui',
      align: 'center'
    });

    Renderer.drawText(`최고 콤보: ${this.currentRun?.bestCombo || 0}`, 200, 270, {
      font: '16px system-ui',
      align: 'center'
    });

    // 정답률 표시
    const correct = this.currentRun?.correctAnswers || 0;
    const total = this.currentRun?.totalAnswers || 0;
    const accuracyPercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    Renderer.drawText(`정답률: ${accuracyPercent}% (${correct}/${total})`, 200, 310, {
      font: '16px system-ui',
      align: 'center'
    });

    Renderer.drawText(`획득 골드: +${this.currentRun?.earnedGold || 0}G`, 200, 350, {
      font: 'bold 18px system-ui',
      color: COLORS.WARNING,
      align: 'center'
    });

    // 메인으로 버튼
    Renderer.drawButton(100, 420, 200, 60, '메인으로', {
      bgColor: COLORS.ACCENT
    });
    this.registerClickArea('toMain', 100, 420, 200, 60, () => {
      this.changeScreen(SCREENS.MAIN);
    });
  }

  // 설정 화면
  renderSettingsScreen() {
    Renderer.drawGrid();

    // 헤더
    Renderer.roundRect(0, 0, 400, 60, 0, COLORS.BG_SECONDARY);
    Renderer.drawText('⚙️ 설정', 200, 20, {
      font: 'bold 18px system-ui',
      align: 'center'
    });

    // 뒤로가기
    Renderer.drawText('← 뒤로', 30, 22, {
      font: '14px system-ui',
      color: COLORS.ACCENT_LIGHT
    });
    this.registerClickArea('back', 10, 10, 80, 40, () => this.changeScreen(SCREENS.MAIN));

    // ===== SmilePrint API 섹션 (권장) =====
    Renderer.roundRect(20, 75, 360, 120, 16, COLORS.BG_CARD);

    Renderer.drawText('🖼️ SmilePrint API (권장)', 200, 100, {
      font: 'bold 14px system-ui',
      align: 'center'
    });

    const hasSmilePrintKey = imageAnalysisService.hasApiKey();
    const spStatus = hasSmilePrintKey ? '✅ 설정됨' : '❌ 미설정';
    const spColor = hasSmilePrintKey ? COLORS.SUCCESS : COLORS.DANGER;

    Renderer.drawText(spStatus, 200, 125, {
      font: '12px system-ui',
      color: spColor,
      align: 'center'
    });

    Renderer.drawButton(50, 145, 300, 40, '🔑 SmilePrint API 키 입력', {
      bgColor: COLORS.ACCENT,
      fontSize: 14
    });
    this.registerClickArea('setSmilePrintKey', 50, 145, 300, 40, () => this.promptSmilePrintApiKey());

    // ===== Gemini API 섹션 (백업) =====
    Renderer.roundRect(20, 205, 360, 120, 16, COLORS.BG_CARD);

    Renderer.drawText('🤖 Gemini API (백업)', 200, 230, {
      font: 'bold 14px system-ui',
      align: 'center'
    });

    const hasGeminiKey = geminiService.hasApiKey();
    const geminiStatus = hasGeminiKey ? '✅ 설정됨' : '❌ 미설정';
    const geminiColor = hasGeminiKey ? COLORS.SUCCESS : COLORS.DANGER;

    Renderer.drawText(geminiStatus, 200, 255, {
      font: '12px system-ui',
      color: geminiColor,
      align: 'center'
    });

    Renderer.drawButton(50, 275, 145, 40, '🔑 Gemini 키', {
      bgColor: COLORS.BG_SECONDARY,
      borderColor: COLORS.ACCENT,
      fontSize: 12
    });
    this.registerClickArea('setApiKey', 50, 275, 145, 40, () => this.promptApiKey());

    // 테스트 버튼
    Renderer.drawButton(205, 275, 145, 40, '테스트 생성', {
      bgColor: COLORS.BG_SECONDARY,
      borderColor: COLORS.WARNING,
      fontSize: 12
    });
    this.registerClickArea('testAI', 205, 275, 145, 40, () => this.testAIGeneration());

    // ===== 사운드 설정 =====
    Renderer.roundRect(20, 335, 360, 50, 16, COLORS.BG_CARD);

    Renderer.drawText('🔊 효과음', 100, 355, {
      font: '14px system-ui',
      align: 'center'
    });

    const soundOn = SoundService.enabled;
    Renderer.drawButton(250, 342, 80, 35, soundOn ? 'ON' : 'OFF', {
      bgColor: soundOn ? COLORS.SUCCESS : COLORS.DANGER,
      fontSize: 14
    });
    this.registerClickArea('toggleSound', 250, 342, 80, 35, () => {
      SoundService.toggle();
      SoundService.playClick();
    });

    // ===== API 키 발급 안내 =====
    Renderer.roundRect(20, 395, 360, 155, 16, COLORS.BG_CARD);

    Renderer.drawText('📋 API 키 발급 방법', 200, 420, {
      font: 'bold 14px system-ui',
      align: 'center'
    });

    const instructions = [
      '[ SmilePrint API ]',
      '관리자에게 API 키 요청',
      '',
      '[ Gemini API ]',
      'aistudio.google.com 접속',
      'Get API Key → Create API Key'
    ];

    instructions.forEach((text, i) => {
      const isBold = text.startsWith('[');
      Renderer.drawText(text, 200, 445 + i * 18, {
        font: isBold ? 'bold 11px system-ui' : '11px system-ui',
        color: isBold ? COLORS.TEXT_PRIMARY : COLORS.TEXT_SECONDARY,
        align: 'center'
      });
    });

    // ===== AI 기능 설명 =====
    Renderer.roundRect(20, 560, 360, 90, 16, COLORS.BG_CARD);

    Renderer.drawText('AI 연동 시 가능한 기능:', 200, 582, {
      font: 'bold 12px system-ui',
      align: 'center'
    });

    const features = [
      '• 문제 사진 자동 분석 (SmilePrint)',
      '• 유사 문제 자동 생성 (Gemini)',
      '• 문제 풀이 힌트 제공'
    ];

    features.forEach((text, i) => {
      Renderer.drawText(text, 200, 603 + i * 16, {
        font: '11px system-ui',
        color: COLORS.TEXT_SECONDARY,
        align: 'center'
      });
    });

    // ===== 데이터 관리 =====
    Renderer.roundRect(20, 660, 360, 130, 16, COLORS.BG_CARD);

    Renderer.drawText(`🗂️ 데이터 관리 (문제 ${this.monsters.length}개)`, 200, 685, {
      font: 'bold 14px system-ui',
      align: 'center'
    });

    // 내보내기 / 불러오기 버튼
    Renderer.drawButton(35, 705, 155, 35, '📤 내보내기', {
      bgColor: COLORS.SUCCESS,
      fontSize: 13
    });
    this.registerClickArea('exportProblems', 35, 705, 155, 35, () => this.exportProblems());

    Renderer.drawButton(210, 705, 155, 35, '📥 불러오기', {
      bgColor: COLORS.ACCENT,
      fontSize: 13
    });
    this.registerClickArea('importProblems', 210, 705, 155, 35, () => this.importProblems());

    // 초기화 버튼
    Renderer.drawButton(35, 750, 330, 35, '🗑️ 전체 초기화', {
      bgColor: COLORS.DANGER,
      fontSize: 13
    });
    this.registerClickArea('resetProblems', 35, 750, 330, 35, () => this.resetAllProblems());
  }

  // 문제 초기화
  async resetAllProblems() {
    const count = this.monsters.length;

    if (count === 0) {
      alert('초기화할 문제가 없습니다.');
      return;
    }

    const confirmed = confirm(`정말로 모든 문제(${count}개)를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`);

    if (!confirmed) return;

    // 2차 확인
    const doubleConfirm = confirm(`⚠️ 최종 확인\n\n${count}개의 문제가 영구 삭제됩니다.\n정말 삭제하시겠습니까?`);

    if (!doubleConfirm) return;

    try {
      // IndexedDB에서 모든 몬스터 삭제
      for (const monster of this.monsters) {
        await this.db.delete('monsters', monster.id);
      }

      // 메모리에서도 초기화
      this.monsters = [];

      alert(`✅ ${count}개의 문제가 삭제되었습니다.`);

      // 화면 새로고침
      this.render();
    } catch (error) {
      console.error('문제 초기화 오류:', error);
      alert('문제 초기화 중 오류가 발생했습니다.');
    }
  }

  // 문제 내보내기 (JSON 파일 다운로드)
  exportProblems() {
    if (this.monsters.length === 0) {
      alert('내보낼 문제가 없습니다.');
      return;
    }

    try {
      // 내보낼 데이터 준비 (이미지 데이터 제외하여 파일 크기 줄임)
      const exportData = this.monsters.map(m => ({
        question: m.question,
        answer: m.answer,
        answers: m.answers,
        choices: m.choices,
        correctIndex: m.correctIndex,
        explanation: m.explanation,
        topic: m.topic,
        difficulty: m.difficulty,
        keywords: m.keywords,
        subject: m.subject,
        questionType: m.questionType,
        formula: m.formula
      }));

      const dataStr = JSON.stringify({
        version: '1.0',
        exportDate: new Date().toISOString(),
        count: exportData.length,
        problems: exportData
      }, null, 2);

      // 파일 다운로드
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `오답문제_${new Date().toISOString().slice(0, 10)}_${exportData.length}개.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`✅ ${exportData.length}개의 문제를 내보냈습니다!`);
    } catch (error) {
      console.error('내보내기 오류:', error);
      alert('문제 내보내기 중 오류가 발생했습니다.');
    }
  }

  // 문제 불러오기 (JSON 파일 업로드)
  importProblems() {
    // 파일 input 생성
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // 데이터 검증
        if (!data.problems || !Array.isArray(data.problems)) {
          alert('올바른 문제 파일이 아닙니다.');
          return;
        }

        const problems = data.problems;
        if (problems.length === 0) {
          alert('불러올 문제가 없습니다.');
          return;
        }

        // 확인
        const confirmed = confirm(`${problems.length}개의 문제를 불러오시겠습니까?\n\n(기존 문제는 유지됩니다)`);
        if (!confirmed) return;

        // 문제 추가
        let addedCount = 0;
        for (const problem of problems) {
          // 필수 필드 검증
          if (!problem.question) continue;

          const monster = {
            id: Date.now() + Math.random(),
            subject: problem.subject || 'math',
            createdAt: Date.now(),
            status: 'alive',
            question: problem.question,
            answer: problem.answer || '',
            answers: problem.answers || [problem.answer],
            choices: problem.choices || [],
            correctIndex: problem.correctIndex || 0,
            explanation: problem.explanation || '',
            topic: problem.topic || '',
            difficulty: problem.difficulty || 2,
            keywords: problem.keywords || [],
            questionType: problem.questionType || '객관식',
            formula: problem.formula || '',
            hp: 100,
            maxHp: 100
          };

          await this.db.add('monsters', monster);
          this.monsters.push(monster);
          addedCount++;
        }

        alert(`✅ ${addedCount}개의 문제를 불러왔습니다!`);
        this.render();
      } catch (error) {
        console.error('불러오기 오류:', error);
        alert('문제 불러오기 중 오류가 발생했습니다.\n파일 형식을 확인해주세요.');
      }
    };

    input.click();
  }

  // 상점 화면
  renderShopScreen() {
    Renderer.drawGrid();

    // 헤더
    Renderer.roundRect(0, 0, 400, 50, 0, COLORS.BG_SECONDARY);
    Renderer.drawText('🏪 상점', 200, 16, {
      font: 'bold 18px system-ui',
      align: 'center'
    });

    // 뒤로가기
    Renderer.drawText('← 뒤로', 30, 18, {
      font: '14px system-ui',
      color: COLORS.ACCENT_LIGHT
    });
    this.registerClickArea('back', 10, 5, 80, 40, () => this.changeScreen(SCREENS.MAIN));

    // 골드 표시
    Renderer.roundRect(290, 8, 100, 30, 8, 'rgba(251,191,36,0.15)');
    Renderer.drawText(`💰 ${this.player.gold.toLocaleString()}G`, 340, 16, {
      font: 'bold 14px system-ui',
      color: COLORS.WARNING,
      align: 'center'
    });

    // ===== 영구 강화 섹션 =====
    Renderer.drawText('⚡ 영구 강화', 200, 68, {
      font: 'bold 14px system-ui',
      color: COLORS.ACCENT_LIGHT,
      align: 'center'
    });

    const upgrades = Object.entries(UPGRADES);
    let yPos = 85;

    upgrades.forEach(([key, upgrade]) => {
      const currentLevel = this.player.permanentUpgrades?.[key] || 0;
      const isMaxed = currentLevel >= upgrade.maxLevel;
      let price;
      if (currentLevel >= 5) {
        const baseTo5 = upgrade.basePrice * Math.pow(1.1, 5);
        price = Math.ceil(baseTo5 * Math.pow(1.15, currentLevel - 5) / 10) * 10;
      } else {
        price = Math.ceil(upgrade.basePrice * Math.pow(1.1, currentLevel) / 10) * 10;
      }
      const canBuy = this.player.gold >= price && !isMaxed;

      // 카드 배경
      Renderer.roundRect(15, yPos, 370, 55, 10, COLORS.BG_CARD);

      // 아이콘과 이름
      Renderer.drawText(`${upgrade.icon} ${upgrade.name}`, 30, yPos + 14, {
        font: 'bold 13px system-ui',
        color: COLORS.TEXT_PRIMARY
      });

      // 레벨 바
      const barX = 150;
      const barW = 80;
      const barH = 6;
      const barY = yPos + 18;
      const fillRatio = currentLevel / upgrade.maxLevel;
      Renderer.roundRect(barX, barY, barW, barH, 3, COLORS.BG_SECONDARY);
      if (fillRatio > 0) {
        Renderer.roundRect(barX, barY, Math.round(barW * fillRatio), barH, 3, isMaxed ? COLORS.SUCCESS : COLORS.ACCENT);
      }
      Renderer.drawText(`${currentLevel}/${upgrade.maxLevel}`, barX + barW + 8, yPos + 14, {
        font: '11px system-ui',
        color: isMaxed ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY
      });

      // 설명
      Renderer.drawText(upgrade.description, 30, yPos + 38, {
        font: '11px system-ui',
        color: COLORS.TEXT_SECONDARY
      });

      // 구매 버튼
      if (isMaxed) {
        Renderer.roundRect(295, yPos + 25, 80, 24, 6, COLORS.SUCCESS);
        Renderer.drawText('MAX', 335, yPos + 30, {
          font: 'bold 11px system-ui',
          color: '#000',
          align: 'center'
        });
      } else {
        const btnColor = canBuy ? COLORS.WARNING : COLORS.BG_SECONDARY;
        Renderer.roundRect(295, yPos + 25, 80, 24, 6, btnColor);
        Renderer.drawText(`${price}G`, 335, yPos + 30, {
          font: 'bold 11px system-ui',
          color: canBuy ? '#000' : COLORS.TEXT_SECONDARY,
          align: 'center'
        });
        if (canBuy) {
          this.registerClickArea(`upgrade_${key}`, 295, yPos + 25, 80, 24, () => this.buyUpgrade(key));
        }
      }

      yPos += 62;
    });

    // ===== 구분선 =====
    yPos += 5;
    Renderer.roundRect(40, yPos, 320, 1, 0, 'rgba(99,102,241,0.3)');
    yPos += 12;

    // ===== 소비 아이템 섹션 =====
    Renderer.drawText('🎒 소비 아이템', 200, yPos, {
      font: 'bold 14px system-ui',
      color: COLORS.ACCENT_LIGHT,
      align: 'center'
    });

    yPos += 20;

    const items = Object.entries(SHOP_ITEMS);
    items.forEach(([key, item]) => {
      const owned = this.player.inventory?.[key] || 0;
      const canBuy = this.player.gold >= item.price;

      // 카드 배경
      Renderer.roundRect(15, yPos, 370, 50, 10, COLORS.BG_CARD);

      // 아이콘과 이름
      Renderer.drawText(`${item.icon} ${item.name}`, 30, yPos + 13, {
        font: 'bold 13px system-ui',
        color: COLORS.TEXT_PRIMARY
      });

      // 보유량 뱃지
      if (owned > 0) {
        Renderer.roundRect(155, yPos + 5, 40, 20, 10, 'rgba(99,102,241,0.25)');
        Renderer.drawText(`×${owned}`, 175, yPos + 8, {
          font: 'bold 11px system-ui',
          color: COLORS.ACCENT_LIGHT,
          align: 'center'
        });
      } else {
        Renderer.drawText('×0', 175, yPos + 13, {
          font: '11px system-ui',
          color: COLORS.TEXT_SECONDARY,
          align: 'center'
        });
      }

      // 설명
      Renderer.drawText(item.description, 30, yPos + 35, {
        font: '10px system-ui',
        color: COLORS.TEXT_SECONDARY
      });

      // 구매 버튼
      const btnColor = canBuy ? COLORS.ACCENT : COLORS.BG_SECONDARY;
      Renderer.roundRect(295, yPos + 12, 80, 26, 6, btnColor);
      Renderer.drawText(`${item.price}G`, 335, yPos + 18, {
        font: 'bold 11px system-ui',
        color: canBuy ? '#fff' : COLORS.TEXT_SECONDARY,
        align: 'center'
      });
      if (canBuy) {
        this.registerClickArea(`buy_${key}`, 295, yPos + 12, 80, 26, () => this.buyItem(key));
      }

      yPos += 57;
    });
  }

  // 영구 강화 구매
  async buyUpgrade(upgradeKey) {
    const upgrade = UPGRADES[upgradeKey];
    if (!upgrade) return;

    // 인벤토리 초기화
    if (!this.player.permanentUpgrades) {
      this.player.permanentUpgrades = { hp: 0, time: 0, goldBonus: 0, damage: 0 };
    }

    const currentLevel = this.player.permanentUpgrades[upgradeKey] || 0;
    if (currentLevel >= upgrade.maxLevel) {
      alert('이미 최대 레벨입니다!');
      return;
    }

    // 구매할 때마다 해당 품목만 10% 가격 인상 (1의 자리 올림)
    const price = Math.ceil(upgrade.basePrice * Math.pow(1.1, currentLevel) / 10) * 10;
    if (this.player.gold < price) {
      alert('골드가 부족합니다!');
      return;
    }

    // 구매 처리
    this.player.gold -= price;
    this.player.permanentUpgrades[upgradeKey] = currentLevel + 1;

    // HP 강화인 경우 maxHp 증가
    if (upgradeKey === 'hp') {
      this.player.maxHp += upgrade.value;
      this.player.currentHp = this.player.maxHp;
    }

    SoundService.playClick();
    await this.db.put('player', this.player);

    alert(`${upgrade.icon} ${upgrade.name} Lv.${currentLevel + 1} 구매 완료!`);
  }

  // 소비 아이템 구매
  async buyItem(itemKey) {
    const item = SHOP_ITEMS[itemKey];
    if (!item) return;

    if (this.player.gold < item.price) {
      alert('골드가 부족합니다!');
      return;
    }

    // 인벤토리 초기화
    if (!this.player.inventory) {
      this.player.inventory = { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 };
    }

    // 구매 처리
    this.player.gold -= item.price;
    this.player.inventory[itemKey] = (this.player.inventory[itemKey] || 0) + 1;

    SoundService.playClick();
    await this.db.put('player', this.player);

    alert(`${item.icon} ${item.name} 구매 완료! (보유: ${this.player.inventory[itemKey]}개)`);
  }

  // API 키 입력
  promptApiKey() {
    const key = prompt('Gemini API 키를 입력하세요:');
    if (key && key.trim()) {
      geminiService.setApiKey(key.trim());
      alert('Gemini API 키가 저장되었습니다!');
    }
  }

  // SmilePrint API 키 입력
  promptSmilePrintApiKey() {
    const key = prompt('SmilePrint API 키를 입력하세요:');
    if (key && key.trim()) {
      imageAnalysisService.setApiKey(key.trim());
      alert('SmilePrint API 키가 저장되었습니다!\n\n이미지 분석 기능을 사용할 수 있습니다.');
    }
  }

  // AI 테스트 (생성된 문제를 던전에 추가)
  async testAIGeneration() {
    try {
      alert('테스트 문제 생성 중... 잠시 기다려주세요.');

      const result = await geminiService.generateNewProblems('수학', '일차방정식', 3);

      if (result && result.problems && result.problems.length > 0) {
        // 생성된 문제를 던전(몬스터)에 추가
        let addedCount = 0;
        for (const p of result.problems) {
          const monster = {
            subject: 'math',
            question: p.question,
            answer: p.answer,
            choices: p.choices || [],
            correctIndex: p.correctIndex || 0,
            explanation: p.explanation || '',
            hp: 80 + (p.difficulty || 1) * 20,
            maxHp: 80 + (p.difficulty || 1) * 20,
            difficulty: p.difficulty || 1,
            isGenerated: true,
            createdAt: Date.now(),
            status: 'alive'
          };

          await this.db.add('monsters', monster);
          addedCount++;
        }

        // 몬스터 목록 새로고침
        await this.loadMonsters();

        const p = result.problems[0];
        alert(`✅ ${addedCount}개 문제 생성 및 던전 추가 완료!\n\n예시:\n문제: ${p.question}\n정답: ${p.answer}`);
      } else {
        alert('문제 생성에 실패했습니다.');
      }
    } catch (err) {
      alert('오류: ' + err.message);
    }
  }

  // AI 문제 생성 메뉴 (ProblemGeneratorService 사용)
  async showAIGenerateMenu() {
    const topics = problemGeneratorService.getTopics();
    const topicList = Object.entries(topics)
      .map(([key, info], i) => `${i + 1}. ${info.name}`)
      .join('\n');

    const topicChoice = prompt(
      `🤖 AI 수학문제 생성\n\n주제를 선택하세요:\n${topicList}\n\n번호 입력 (1-${Object.keys(topics).length}):`
    );

    if (!topicChoice) return;

    const topicIndex = parseInt(topicChoice) - 1;
    const topicKeys = Object.keys(topics);
    if (topicIndex < 0 || topicIndex >= topicKeys.length) {
      alert('올바른 번호를 입력하세요.');
      return;
    }

    const selectedTopic = topicKeys[topicIndex];
    const difficultyChoice = prompt('난이도를 선택하세요:\n1. 쉬움\n2. 보통\n3. 어려움\n\n번호 입력:', '2');

    if (!difficultyChoice) return;

    const difficulty = parseInt(difficultyChoice) || 2;
    const countChoice = prompt('생성할 문제 개수 (1-10):', '5');

    if (!countChoice) return;

    const count = Math.min(10, Math.max(1, parseInt(countChoice) || 5));

    try {
      this.showGeneratingScreen(count);
      console.log(`🤖 ${topics[selectedTopic].name} 문제 ${count}개 생성 중...`);

      const problems = await problemGeneratorService.generateProblems(selectedTopic, difficulty, count);

      if (problems && problems.length > 0) {
        let addedCount = 0;
        for (const p of problems) {
          const monster = {
            subject: 'math',
            question: p.question,
            answer: p.answer,
            answers: p.answers || [p.answer],
            choices: p.choices || [],
            correctIndex: p.correctIndex || 0,
            explanation: p.explanation || '',
            topic: p.topic || topics[selectedTopic].name,
            hp: 80 + (p.difficulty || difficulty) * 20,
            maxHp: 80 + (p.difficulty || difficulty) * 20,
            difficulty: p.difficulty || difficulty,
            isGenerated: true,
            createdAt: Date.now(),
            status: 'alive'
          };

          await this.db.add('monsters', monster);
          addedCount++;
        }

        await this.loadMonsters();

        const example = problems[0];
        alert(
          `✅ ${addedCount}개 문제 생성 완료!\n\n` +
          `주제: ${topics[selectedTopic].name}\n` +
          `난이도: ${['쉬움', '보통', '어려움'][difficulty - 1]}\n\n` +
          `예시:\n문제: ${example.question}\n정답: ${example.answer}`
        );
      } else {
        alert('문제 생성에 실패했습니다.');
      }
    } catch (err) {
      console.error('AI 문제 생성 오류:', err);
      alert('오류: ' + err.message);
    }
  }

  // 던전 시작
  async startDungeon() {
    await this.loadMonsters();

    // 문제가 부족하면 AI가 자동 생성 (최소 10개)
    const MIN_MONSTERS = 10;
    if (this.monsters.length < MIN_MONSTERS && problemGeneratorService.hasApiKey()) {
      const needCount = MIN_MONSTERS - this.monsters.length;
      console.log(`🤖 문제 부족 (${this.monsters.length}/${MIN_MONSTERS}), AI 자동 생성 중...`);

      try {
        this.showGeneratingScreen(needCount);
        const problems = await problemGeneratorService.generateRandom(needCount);

        if (problems && problems.length > 0) {
          for (const p of problems) {
            const monster = {
              subject: 'math',
              question: p.question,
              answer: p.answer,
              answers: p.answers || [p.answer],
              choices: p.choices || [],
              correctIndex: p.correctIndex || 0,
              explanation: p.explanation || '',
              topic: p.topic || '수학',
              hp: 80 + (p.difficulty || 2) * 20,
              maxHp: 80 + (p.difficulty || 2) * 20,
              difficulty: p.difficulty || 2,
              isGenerated: true,
              createdAt: Date.now(),
              status: 'alive'
            };
            await this.db.add('monsters', monster);
          }
          await this.loadMonsters();
          console.log(`✅ ${problems.length}개 문제 자동 생성 완료!`);
        }
      } catch (err) {
        console.error('AI 문제 자동 생성 실패:', err);
      }
    }

    if (this.monsters.length === 0) {
      alert('등록된 오답이 없습니다! 먼저 오답을 등록해주세요.');
      return;
    }

    SoundService.playDungeonStart();

    // 골드 2배 아이템 사용 체크
    let runGoldMultiplier = 1;
    if (this.player.inventory?.doubleGold > 0) {
      this.player.inventory.doubleGold--;
      runGoldMultiplier = 2;
      this.db.put('player', this.player);
      alert('✨ 골드 2배 아이템 적용! 이번 런에서 획득 골드가 2배가 됩니다!');
    }

    // 런 초기화
    this.currentRun = {
      startTime: Date.now(),
      defeatedMonsters: [],
      earnedGold: 0,
      earnedExp: 0,
      bestCombo: 0,
      goldMultiplier: runGoldMultiplier,
      result: 'ongoing',
      // 적응형 난이도용 정답률 추적
      correctAnswers: 0,
      totalAnswers: 0
    };

    this.stage = 1;
    this.combo = 0;

    // maxHp 업데이트 (레벨 보너스 + 영구 강화 적용)
    this.player.maxHp = this.getTotalMaxHp();
    this.player.currentHp = this.player.maxHp;

    this.nextMonster();
    this.changeScreen(SCREENS.BATTLE);
  }

  // 정답률 계산
  getAccuracyRate() {
    if (!this.currentRun || this.currentRun.totalAnswers === 0) return 0.5;
    return this.currentRun.correctAnswers / this.currentRun.totalAnswers;
  }

  // 적응형 난이도로 몬스터 선택
  selectMonsterByDifficulty() {
    const accuracy = this.getAccuracyRate();
    const totalAnswers = this.currentRun?.totalAnswers || 0;

    // 최소 5문제 이상 풀어야 적응형 난이도 적용
    if (totalAnswers < 5) {
      return this.monsters[Math.floor(Math.random() * this.monsters.length)];
    }

    // 난이도별 몬스터 분류
    const easy = this.monsters.filter(m => (m.difficulty || 2) <= 1);
    const medium = this.monsters.filter(m => (m.difficulty || 2) === 2);
    const hard = this.monsters.filter(m => (m.difficulty || 2) >= 3);

    let targetPool;
    let fallbackPool = this.monsters;

    if (accuracy >= 0.8) {
      // 정답률 80% 이상: 어려운 문제 우선 (70% 확률)
      targetPool = hard.length > 0 ? hard : medium;
      if (Math.random() < 0.7 && targetPool.length > 0) {
        return targetPool[Math.floor(Math.random() * targetPool.length)];
      }
    } else if (accuracy < 0.5) {
      // 정답률 50% 미만: 쉬운 문제 우선 (70% 확률)
      targetPool = easy.length > 0 ? easy : medium;
      if (Math.random() < 0.7 && targetPool.length > 0) {
        return targetPool[Math.floor(Math.random() * targetPool.length)];
      }
    }

    // 그 외: 랜덤 선택
    return fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
  }

  // 다음 몬스터
  nextMonster() {
    if (this.monsters.length === 0) {
      this.endRun(true);
      return;
    }

    // 적응형 난이도 몬스터 선택
    const selectedMonster = this.selectMonsterByDifficulty();
    this.currentMonster = { ...selectedMonster };
    // questions 배열 깊은 복사 (원본 몬스터의 AI 생성 문제도 반영)
    if (selectedMonster.questions && selectedMonster.questions.length > 0) {
      this.currentMonster.questions = [...selectedMonster.questions];
    }
    this.currentMonster.currentQuestionIndex = -1;

    // 몬스터가 여러 문제를 가지고 있으면 랜덤 선택
    if (this.currentMonster.questions && this.currentMonster.questions.length > 0) {
      const qIdx = Math.floor(Math.random() * this.currentMonster.questions.length);
      const selectedQ = this.currentMonster.questions[qIdx];
      this.currentMonster.question = selectedQ.question;
      this.currentMonster.answer = selectedQ.answer;
      this.currentMonster.choices = selectedQ.choices || [];
      this.currentMonster.correctIndex = selectedQ.correctIndex || 0;
      this.currentMonster.explanation = selectedQ.explanation || '';
    }

    // 보스 체크
    const bossType = this.getBossType(this.stage);
    this.currentMonster.bossType = bossType;

    if (bossType) {
      const bossConfig = BOSS_CONFIG[bossType];
      this.currentMonster.name = `${bossConfig.icon} ${bossConfig.name}`;
      this.currentMonster.hp = Math.round(this.currentMonster.maxHp * bossConfig.hpMultiplier);
      this.currentMonster.maxHp = this.currentMonster.hp;
      this.currentMonster.goldMultiplier = bossConfig.goldMultiplier;
      this.currentMonster.damageMultiplier = bossConfig.damageMultiplier;
      this.currentMonster.icon = bossConfig.icon;

      // 보스는 난이도 중(2) 이상 문제만 출제
      this._ensureBossDifficulty();

      // 보스 등장 사운드 및 연출
      SoundService.playBossAppear();
      this.startBossEntrance();
    } else {
      // 아이콘-이름 연동 몬스터 테이블 (아이콘 ↔ 이름이 어울리도록)
      const monsterTypes = [
        { icon: '👾', names: { math: '슬라임', english: '블롭', korean: '물령', science: '젤리' } },
        { icon: '💀', names: { math: '해골병사', english: '스켈레톤', korean: '백골', science: '본가드' } },
        { icon: '🦇', names: { math: '박쥐', english: '배트', korean: '야차', science: '플라잉' } },
        { icon: '🧟', names: { math: '좀비', english: '언데드', korean: '강시', science: '뮤턴트' } },
        { icon: '👻', names: { math: '유령', english: '고스트', korean: '원귀', science: '스펙터' } },
        { icon: '🕷️', names: { math: '거미', english: '스파이더', korean: '독충', science: '아라크네' } }
      ];
      const typeIdx = this.stage % monsterTypes.length;
      const monsterType = monsterTypes[typeIdx];
      const subjectKey = this.currentMonster.subject || 'math';
      const baseName = monsterType.names[subjectKey] || monsterType.names.math;

      // topic이나 question에서 키워드 추출
      const topic = this.currentMonster.topic || '';
      const question = this.currentMonster.question || '';
      let keyword = '';
      if (topic) {
        keyword = topic;
      } else if (question) {
        const mathKeywords = ['방정식', '함수', '미분', '적분', '확률', '수열', '부등식', '인수분해', '도형', '삼각', '벡터', '행렬', '극한', '집합', '경우의 수', '비율', '분수', '소수', '약수', '배수'];
        const engKeywords = ['문법', '어휘', '독해', '빈칸', '순서', '요약', '시제', '관계사', '가정법', '분사'];
        const allKeywords = [...mathKeywords, ...engKeywords];
        for (const kw of allKeywords) {
          if (question.includes(kw)) { keyword = kw; break; }
        }
      }

      this.currentMonster.name = keyword ? `${keyword} ${baseName}` : baseName;
      this.currentMonster.goldMultiplier = 1;
      this.currentMonster.damageMultiplier = 1;
      this.currentMonster.icon = monsterType.icon;
    }

    // 선택지 생성 및 섞기
    let answer = this.currentMonster.answer;

    // 정답이 없고 선택지와 correctIndex가 있으면 선택지에서 정답 추출
    if (!answer && this.currentMonster.choices && this.currentMonster.choices.length > 0) {
      const idx = this.currentMonster.correctIndex || 0;
      answer = this.currentMonster.choices[idx];
    }

    // 그래도 정답이 없으면 '?' 표시
    if (!answer) {
      answer = '?';
    }

    // 정답을 몬스터에 저장
    this.currentMonster.answer = answer;

    if (!this.currentMonster.choices || this.currentMonster.choices.length === 0) {
      // 선택지가 없으면 오답 자동 생성
      const wrongAnswers = this.generateWrongAnswers(answer);
      this.currentMonster.choices = [answer, ...wrongAnswers];
    } else if (!this.currentMonster.choices.includes(answer)) {
      // 정답이 선택지에 없으면 첫 번째 선택지를 정답으로 교체
      this.currentMonster.choices[0] = answer;
    }

    // 선택지 랜덤 섞기 (매번 위치 변경)
    this.currentMonster.choices = this.shuffleArray([...this.currentMonster.choices]);
    this.currentMonster.correctIndex = this.currentMonster.choices.indexOf(answer);

    // 시간 설정 (레벨 보너스 + 영구 강화 적용)
    this.timer = this.getTotalTime();
    this.lastTime = Date.now();
  }

  // 배열 섞기 (Fisher-Yates)
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // 오답 자동 생성
  generateWrongAnswers(answer) {
    const wrongAnswers = [];

    // 숫자인 경우
    const num = parseFloat(answer);
    if (!isNaN(num)) {
      // 비슷한 숫자로 오답 생성
      const variations = [
        num + Math.floor(Math.random() * 5) + 1,
        num - Math.floor(Math.random() * 5) - 1,
        num * 2,
        num + 10,
        num - 10,
        Math.abs(num) * -1,
        num + 0.5,
        num - 0.5
      ];

      // 중복 제거하고 3개 선택
      const unique = [...new Set(variations.filter(v => v !== num))];
      this.shuffleArray(unique);

      for (let i = 0; i < 3 && i < unique.length; i++) {
        wrongAnswers.push(String(unique[i]));
      }
    }

    // 오답이 부족하면 랜덤 숫자 추가
    while (wrongAnswers.length < 3) {
      const randomNum = Math.floor(Math.random() * 100) + 1;
      const randomStr = String(randomNum);
      if (!wrongAnswers.includes(randomStr) && randomStr !== answer) {
        wrongAnswers.push(randomStr);
      }
    }

    return wrongAnswers.slice(0, 3);
  }

  // 보스 타입 확인
  getBossType(stage) {
    if (BOSS_CONFIG.FINAL_BOSS.stages.includes(stage)) {
      return 'FINAL_BOSS';
    }
    if (BOSS_CONFIG.MID_BOSS.stages.includes(stage)) {
      return 'MID_BOSS';
    }
    if (BOSS_CONFIG.NORMAL_BOSS.stages.includes(stage)) {
      return 'NORMAL_BOSS';
    }
    return null;
  }

  // 정답 선택
  selectAnswer(index) {
    const isCorrect = index === (this.currentMonster.correctIndex || 0);

    if (isCorrect) {
      this.onCorrectAnswer();
    } else {
      this.onWrongAnswer();
    }
  }

  // 정답
  async onCorrectAnswer() {
    // 정답률 추적
    this.currentRun.correctAnswers++;
    this.currentRun.totalAnswers++;

    this.combo++;
    if (this.combo > this.currentRun.bestCombo) {
      this.currentRun.bestCombo = this.combo;
    }

    // 효과음
    if (this.combo >= 3) {
      SoundService.playCombo(this.combo);
      // 콤보 이펙트
      this.addComboText(this.combo);
      if (this.combo >= 5) {
        this.addParticleExplosion(200, 350, '#fbbf24', this.combo * 2);
      }
    } else {
      SoundService.playCorrectWithVibrate();
    }

    // 정답 플래시
    this.flashScreen('#22c55e', 0.15);

    // 데미지 계산 (레벨 보너스 + 영구 강화 적용)
    const baseDamage = this.getTotalDamage();
    const damage = baseDamage + this.combo * 2;
    this.currentMonster.hp -= damage;

    // 데미지 텍스트 표시
    this.addDamageText(200 + (Math.random() - 0.5) * 40, 280, damage, false);

    // 경험치 획득
    await this.gainExp(LEVEL_CONFIG.expPerCorrect);

    // 보상 계산 (콤보 보너스는 별도 적용, 배율과 중첩 안됨)
    const baseGold = Math.floor(Math.random() * 16) + 5;  // 5~20 기본 골드
    const goldBonusUpgrade = this.player.permanentUpgrades?.goldBonus || 0;
    const goldBonusMultiplier = 1 + (goldBonusUpgrade * UPGRADES.goldBonus.value / 100);
    const monsterGoldMultiplier = this.currentMonster.goldMultiplier || 1;
    const runGoldMultiplier = this.currentRun?.goldMultiplier || 1;
    // 기본 골드에만 배율 적용
    const multipliedGold = Math.round(baseGold * goldBonusMultiplier * monsterGoldMultiplier * runGoldMultiplier);
    // 콤보 보너스는 상한선 10, 배율 미적용으로 별도 추가
    const comboBonus = Math.min(this.combo, 10) * 2;
    const gold = multipliedGold + comboBonus;
    this.player.gold += gold;
    this.currentRun.earnedGold += gold;
    SoundService.playGold();

    // 골드 획득 텍스트
    this.addGoldText(350, 30, gold);

    if (this.currentMonster.hp <= 0) {
      this.finalBossWrongLastTurn = false;  // 플래그 리셋
      this.onMonsterDefeated();
    } else {
      // 최종보스: 이전 턴에 오답이었으면 특수효과 발동
      if (this.currentMonster.bossType === 'FINAL_BOSS' && this.finalBossWrongLastTurn) {
        this.player.currentHp -= 10;
        this.currentMonster.hp = Math.min(this.currentMonster.hp + 25, this.currentMonster.maxHp);
        this.finalBossWrongLastTurn = false;  // 플래그 리셋
      }

      // 다음 문제로 변경 (같은 몬스터, 다른 문제)
      this.selectNextQuestion();

      // 시간 설정 (레벨 보너스 + 영구 강화 적용)
      this.timer = this.getTotalTime();
      this.lastTime = Date.now();

      // 턴 효과로 HP가 0 이하가 되면 게임 오버
      if (this.player.currentHp <= 0) {
        this.endRun(false);
      }
    }
  }

  // 같은 몬스터에서 다음 문제 선택
  selectNextQuestion() {
    if (!this.currentMonster) return;

    // questions 배열 초기화 (현재 몬스터 문제 + 다른 몬스터 문제로 풀 채우기)
    if (!this.currentMonster.questions) {
      this.currentMonster.questions = [{
        question: this.currentMonster.question,
        answer: this.currentMonster.answer,
        choices: this.currentMonster.choices || [],
        correctIndex: this.currentMonster.correctIndex || 0,
        explanation: this.currentMonster.explanation || ''
      }];
      this.currentMonster.currentQuestionIndex = 0;

      // 다른 몬스터들의 문제를 가져와서 풀 확보
      this._fillQuestionsFromOtherMonsters();
    }

    // 문제가 부족하면 AI로 자동 생성 (백그라운드)
    const MIN_QUESTIONS = 3;
    if (this.currentMonster.questions.length < MIN_QUESTIONS && !this.currentMonster.isGenerating) {
      this.currentMonster.isGenerating = true;
      this.autoGenerateQuestions(this.currentMonster);
    }

    // 다음 문제로 이동 (현재와 다른 문제 선택)
    const currentIdx = this.currentMonster.currentQuestionIndex ?? -1;
    let nextIdx;
    if (this.currentMonster.questions.length <= 1) {
      nextIdx = 0;
    } else {
      do {
        nextIdx = Math.floor(Math.random() * this.currentMonster.questions.length);
      } while (nextIdx === currentIdx);
    }
    this.currentMonster.currentQuestionIndex = nextIdx;

    const nextQ = this.currentMonster.questions[nextIdx];
    this.currentMonster.question = nextQ.question;
    this.currentMonster.answer = nextQ.answer;
    this.currentMonster.choices = nextQ.choices || [];
    this.currentMonster.correctIndex = nextQ.correctIndex || 0;
    this.currentMonster.explanation = nextQ.explanation || '';

    // 선택지가 없으면 자동 생성
    if (!this.currentMonster.choices || this.currentMonster.choices.length === 0) {
      const wrongAnswers = this.generateWrongAnswers(this.currentMonster.answer);
      this.currentMonster.choices = [this.currentMonster.answer, ...wrongAnswers];
    }

    // 선택지 위치 섞기
    this.reshuffleChoices();
  }

  // 다른 몬스터들의 문제를 가져와 questions 배열 확보
  _fillQuestionsFromOtherMonsters() {
    if (!this.currentMonster || !this.monsters || this.monsters.length <= 1) return;

    const currentId = this.currentMonster.id;
    const otherMonsters = this.monsters.filter(m => m.id !== currentId);

    // 셔플해서 랜덤 순서로
    this.shuffleArray(otherMonsters);

    for (const m of otherMonsters) {
      // 이미 충분하면 중단
      if (this.currentMonster.questions.length >= 5) break;

      // 해당 몬스터가 questions 배열을 가지고 있으면 거기서 가져옴
      if (m.questions && m.questions.length > 0) {
        for (const q of m.questions) {
          if (this.currentMonster.questions.length >= 5) break;
          // 중복 방지
          if (!this.currentMonster.questions.some(existing => existing.question === q.question)) {
            this.currentMonster.questions.push({ ...q });
          }
        }
      } else if (m.question) {
        // question 단일 필드만 있는 경우
        if (!this.currentMonster.questions.some(existing => existing.question === m.question)) {
          this.currentMonster.questions.push({
            question: m.question,
            answer: m.answer,
            choices: m.choices || [],
            correctIndex: m.correctIndex || 0,
            explanation: m.explanation || ''
          });
        }
      }
    }
  }

  // 보스 몬스터 난이도 보장 (중(2) 이상)
  _ensureBossDifficulty() {
    const m = this.currentMonster;
    if (!m) return;

    // 현재 문제 난이도가 2 이상이면 OK
    if ((m.difficulty || 1) >= 2) return;

    // questions 배열에서 난이도 2 이상 문제 찾기
    if (m.questions && m.questions.length > 0) {
      const hardQ = m.questions.filter(q => (q.difficulty || 1) >= 2);
      if (hardQ.length > 0) {
        const picked = hardQ[Math.floor(Math.random() * hardQ.length)];
        m.question = picked.question;
        m.answer = picked.answer;
        m.choices = picked.choices || [];
        m.correctIndex = picked.correctIndex || 0;
        m.explanation = picked.explanation || '';
        m.difficulty = picked.difficulty;
        return;
      }
    }

    // 전체 몬스터 풀에서 난이도 2 이상 문제 찾기
    const hardMonsters = this.monsters.filter(mon => (mon.difficulty || 1) >= 2 && mon.id !== m.id);
    if (hardMonsters.length > 0) {
      const picked = hardMonsters[Math.floor(Math.random() * hardMonsters.length)];
      m.question = picked.question;
      m.answer = picked.answer;
      m.choices = picked.choices || [];
      m.correctIndex = picked.correctIndex || 0;
      m.explanation = picked.explanation || '';
      m.difficulty = picked.difficulty;
      return;
    }

    // 난이도 2 이상 문제가 전혀 없으면 AI로 생성 (백그라운드)
    if (!m.isGeneratingBoss) {
      m.isGeneratingBoss = true;
      this._generateBossQuestion(m);
    }
  }

  // 보스용 난이도 중 이상 문제 AI 생성
  async _generateBossQuestion(monster) {
    try {
      console.log('🤖 보스용 난이도 중 이상 문제 생성 중...');
      let problems = null;

      if (problemGeneratorService.hasApiKey()) {
        // 난이도 3(어려움)으로 생성
        const topic = monster.topic || 'linear';
        problems = await problemGeneratorService.generateProblems(topic, 3, 3);
      } else if (geminiService.hasApiKey()) {
        const result = await geminiService.generateSimilarProblems(
          monster.question || '문제', monster.answer || '', '수학', 3
        );
        problems = result?.problems;
      }

      if (problems && problems.length > 0) {
        // questions 배열 초기화
        if (!monster.questions) {
          monster.questions = [{
            question: monster.question,
            answer: monster.answer,
            choices: monster.choices || [],
            correctIndex: monster.correctIndex || 0,
            explanation: monster.explanation || '',
            difficulty: monster.difficulty || 1
          }];
        }

        for (const p of problems) {
          if (monster.questions.length < 10) {
            monster.questions.push({
              question: p.question,
              answer: p.answer,
              choices: p.choices || [],
              correctIndex: p.correctIndex || 0,
              explanation: p.explanation || '',
              difficulty: p.difficulty || 3
            });
          }
        }

        // 첫 번째 생성된 문제를 현재 문제로 설정
        const first = problems[0];
        monster.question = first.question;
        monster.answer = first.answer;
        monster.choices = first.choices || [];
        monster.correctIndex = first.correctIndex || 0;
        monster.explanation = first.explanation || '';
        monster.difficulty = first.difficulty || 3;

        // 현재 전투 중이면 반영
        if (this.currentMonster && this.currentMonster.id === monster.id) {
          this.currentMonster.question = monster.question;
          this.currentMonster.answer = monster.answer;
          this.currentMonster.choices = monster.choices;
          this.currentMonster.correctIndex = monster.correctIndex;
          this.currentMonster.explanation = monster.explanation;
          this.currentMonster.questions = [...monster.questions];
          this.reshuffleChoices();
        }

        console.log(`✅ 보스 문제 ${problems.length}개 생성 완료!`);
      }
    } catch (err) {
      console.error('보스 문제 생성 오류:', err);
    } finally {
      monster.isGeneratingBoss = false;
    }
  }

  // AI로 문제 자동 생성 (백그라운드)
  async autoGenerateQuestions(monster) {
    try {
      console.log('🤖 문제 부족! AI 자동 생성 중...');

      let problems = null;

      // ProblemGeneratorService 우선 시도
      if (problemGeneratorService.hasApiKey()) {
        const originalProblem = {
          question: monster.question || '',
          answer: monster.answer || '',
          topic: monster.topic || '수학',
          difficulty: monster.difficulty || 2
        };
        problems = await problemGeneratorService.generateSimilar(originalProblem);
      }
      // Gemini 폴백
      else if (geminiService.hasApiKey()) {
        const result = await geminiService.generateSimilarProblems(
          monster.question || '문제',
          monster.answer || '',
          '수학',
          3
        );
        problems = result?.problems;
      }

      if (problems && problems.length > 0) {
        // 현재 몬스터의 questions 배열에 추가
        for (const p of problems) {
          if (monster.questions.length < 10) {
            monster.questions.push({
              question: p.question,
              answer: p.answer,
              choices: p.choices || [],
              correctIndex: p.correctIndex || 0,
              explanation: p.explanation || ''
            });
          }
        }

        // DB 업데이트
        const existingMonster = this.monsters.find(m => m.id === monster.id);
        if (existingMonster) {
          existingMonster.questions = monster.questions;
          await this.db.put('monsters', existingMonster);
        }

        console.log(`✅ AI 자동 생성 완료! (총 ${monster.questions.length}개 문제)`);
      }
    } catch (err) {
      console.error('AI 자동 생성 오류:', err);
    } finally {
      monster.isGenerating = false;
    }
  }

  // 선택지 위치 섞기
  reshuffleChoices() {
    if (!this.currentMonster || !this.currentMonster.choices) return;

    const answer = this.currentMonster.answer;
    this.currentMonster.choices = this.shuffleArray([...this.currentMonster.choices]);
    this.currentMonster.correctIndex = this.currentMonster.choices.indexOf(answer);
  }

  // 오답
  async onWrongAnswer() {
    // 정답률 추적
    this.currentRun.totalAnswers++;

    this.combo = 0;

    // 같은 문제 오답 횟수 추적
    if (!this.currentMonster._wrongCounts) {
      this.currentMonster._wrongCounts = {};
    }
    const qKey = this.currentMonster.question || '_default';
    this.currentMonster._wrongCounts[qKey] = (this.currentMonster._wrongCounts[qKey] || 0) + 1;

    // 같은 문제를 2번 이상 틀리면 몬스터 체력 풀 회복
    if (this.currentMonster._wrongCounts[qKey] >= 2) {
      this.currentMonster.hp = this.currentMonster.maxHp;
      this.effects.floatingTexts.push({
        x: 200, y: 250,
        text: '몬스터 체력 회복!',
        color: '#ef4444',
        fontSize: 18,
        life: 1.2,
        vy: -1.5
      });
    }

    // 보스 타입별 고정 데미지 및 특수 효과
    let damage = 25;  // 일반 몬스터
    const bossType = this.currentMonster?.bossType;
    if (bossType === 'NORMAL_BOSS') {
      damage = 30;   // 10층 보스
    } else if (bossType === 'MID_BOSS') {
      damage = 40;   // 50층 보스
      // 중간보스: 오답 시 보스 체력 회복
      this.currentMonster.hp = Math.min(this.currentMonster.hp + 30, this.currentMonster.maxHp);
    } else if (bossType === 'FINAL_BOSS') {
      damage = 80;   // 100층 최종보스
      // 이전 턴에 오답이었으면 특수효과 발동
      if (this.finalBossWrongLastTurn) {
        this.player.currentHp -= 10;
        this.currentMonster.hp = Math.min(this.currentMonster.hp + 25, this.currentMonster.maxHp);
      }
      // 다음 턴에 특수효과 발동하도록 플래그 설정
      this.finalBossWrongLastTurn = true;
    }
    this.player.currentHp -= damage;

    // 효과음 및 시각 효과
    SoundService.playWrongWithVibrate();
    this.flashScreen('#ef4444', 0.25);
    this.shakeScreen(12);
    this.addDamageText(100 + (Math.random() - 0.5) * 30, 35, damage, true);

    // HP가 0 이하이고 부활권이 있으면 부활
    if (this.player.currentHp <= 0 && this.player.inventory?.reviveTicket > 0) {
      this.player.inventory.reviveTicket--;
      this.player.currentHp = Math.round(this.player.maxHp * 0.5);
      this.db.put('player', this.player);
      alert(`🪶 부활권 사용! HP 50% 회복!\n(남은 부활권: ${this.player.inventory.reviveTicket})`);
    }

    // 오답이어도 다음 문제로 변경
    this.selectNextQuestion();

    // 오답 시 시간 +50초 (최대시간 초과 불가)
    const maxTime = this.getTotalTime();
    this.timer = Math.min(this.timer + 50, maxTime);
    this.lastTime = Date.now();

    // AI로 유사 문제 생성 (백그라운드) - ProblemGeneratorService 우선
    if (this.currentMonster) {
      if (problemGeneratorService.hasApiKey()) {
        this.generateSimilarWithProblemGenerator(this.currentMonster);
      } else if (geminiService.hasApiKey()) {
        this.generateSimilarMonsters(this.currentMonster);
      }
    }

    if (this.player.currentHp <= 0) {
      this.endRun(false);
    }
  }

  // ProblemGeneratorService로 유사 문제 생성 (기존 몬스터에 문제 추가)
  async generateSimilarWithProblemGenerator(monster) {
    try {
      console.log('🤖 ProblemGeneratorService 유사 문제 생성 중...');

      const originalProblem = {
        question: monster.question || '',
        answer: monster.answer || '',
        topic: monster.topic || '수학',
        difficulty: monster.difficulty || 2
      };

      const problems = await problemGeneratorService.generateSimilar(originalProblem);

      if (problems && problems.length > 0) {
        // 기존 몬스터 찾기
        const existingMonster = this.monsters.find(m => m.id === monster.id);
        if (existingMonster) {
          // questions 배열 초기화 (없으면 현재 문제로 시작)
          if (!existingMonster.questions) {
            existingMonster.questions = [{
              question: existingMonster.question,
              answer: existingMonster.answer,
              choices: existingMonster.choices || [],
              correctIndex: existingMonster.correctIndex || 0,
              explanation: existingMonster.explanation || ''
            }];
          }

          // 새 문제들 추가 (최대 10개까지)
          for (const p of problems) {
            if (existingMonster.questions.length < 10) {
              existingMonster.questions.push({
                question: p.question,
                answer: p.answer,
                choices: p.choices || [],
                correctIndex: p.correctIndex || 0,
                explanation: p.explanation || ''
              });
            }
          }

          // DB 업데이트
          await this.db.put('monsters', existingMonster);

          // 현재 전투 중인 몬스터에도 반영
          if (this.currentMonster && this.currentMonster.id === existingMonster.id) {
            this.currentMonster.questions = [...existingMonster.questions];
          }

          console.log(`✅ ${problems.length}개 유사 문제 추가! (총 ${existingMonster.questions.length}개)`);
        }
      }
    } catch (err) {
      console.error('ProblemGeneratorService 문제 생성 오류:', err);
      // 실패 시 Gemini로 폴백
      if (geminiService.hasApiKey()) {
        console.log('🔄 Gemini로 폴백...');
        this.generateSimilarMonsters(monster);
      }
    }
  }

  // AI로 유사 문제 생성 (Gemini - 기존 몬스터에 문제 추가)
  async generateSimilarMonsters(monster) {
    try {
      console.log('🤖 Gemini 유사 문제 생성 중...');

      const subjectName = SUBJECTS[monster.subject?.toUpperCase()]?.name || '수학';
      const result = await geminiService.generateSimilarProblems(
        monster.question || '문제',
        monster.answer || '',
        subjectName,
        2  // 2개 생성
      );

      if (result && result.problems) {
        // 기존 몬스터 찾기
        const existingMonster = this.monsters.find(m => m.id === monster.id);
        if (existingMonster) {
          // questions 배열 초기화 (없으면 현재 문제로 시작)
          if (!existingMonster.questions) {
            existingMonster.questions = [{
              question: existingMonster.question,
              answer: existingMonster.answer,
              choices: existingMonster.choices || [],
              correctIndex: existingMonster.correctIndex || 0,
              explanation: existingMonster.explanation || ''
            }];
          }

          // 새 문제들 추가 (최대 10개까지)
          for (const problem of result.problems) {
            if (existingMonster.questions.length < 10) {
              existingMonster.questions.push({
                question: problem.question,
                answer: problem.answer,
                choices: problem.choices || [],
                correctIndex: problem.correctIndex || 0,
                explanation: problem.explanation || ''
              });
            }
          }

          // DB 업데이트
          await this.db.put('monsters', existingMonster);

          // 현재 전투 중인 몬스터에도 반영
          if (this.currentMonster && this.currentMonster.id === existingMonster.id) {
            this.currentMonster.questions = [...existingMonster.questions];
          }

          console.log(`✅ ${result.problems.length}개 유사 문제 추가! (Gemini, 총 ${existingMonster.questions.length}개)`);
        }
      }
    } catch (err) {
      console.error('Gemini 문제 생성 오류:', err);
    }
  }

  // 시간 초과
  onTimeOut() {
    this.combo = 0;
    // 시간 초과 시 HP 45 감소
    this.player.currentHp -= 45;

    // HP가 0 이하이고 부활권이 있으면 부활
    if (this.player.currentHp <= 0 && this.player.inventory?.reviveTicket > 0) {
      this.player.inventory.reviveTicket--;
      this.player.currentHp = Math.round(this.player.maxHp * 0.5);
      this.db.put('player', this.player);
      alert(`🪶 부활권 사용! HP 50% 회복!\n(남은 부활권: ${this.player.inventory.reviveTicket})`);
    }

    // 시간 설정 (레벨 보너스 + 영구 강화 적용)
    this.timer = this.getTotalTime();
    this.lastTime = Date.now();

    if (this.player.currentHp <= 0) {
      this.endRun(false);
    }
  }

  // 몬스터 처치
  async onMonsterDefeated() {
    this.currentRun.defeatedMonsters.push(this.currentMonster.id);

    // 효과음 및 시각 효과
    SoundService.playMonsterDefeat();
    const bossType = this.currentMonster.bossType;
    if (bossType === 'FINAL_BOSS') {
      this.addParticleExplosion(200, 300, '#ff0000', 30);
      this.addParticleExplosion(200, 300, '#ffd700', 20);
      this.shakeScreen(20);
    } else if (bossType === 'MID_BOSS') {
      this.addParticleExplosion(200, 300, '#9932cc', 25);
      this.shakeScreen(15);
    } else if (bossType === 'NORMAL_BOSS') {
      this.addParticleExplosion(200, 300, '#ff6b35', 20);
      this.shakeScreen(10);
    } else {
      this.addParticleExplosion(200, 300, '#6366f1', 12);
    }
    this.flashScreen('#ffffff', 0.3);

    // 경험치 획득 (보스별 차등: 최종 150, 중간 100, 일반 50, 몬스터 20)
    let expGain = LEVEL_CONFIG.expPerMonsterKill;  // 기본 20
    if (bossType === 'FINAL_BOSS') {
      expGain = LEVEL_CONFIG.expPerFinalBoss;      // 150
    } else if (bossType === 'MID_BOSS') {
      expGain = LEVEL_CONFIG.expPerMidBoss;        // 100
    } else if (bossType === 'NORMAL_BOSS') {
      expGain = LEVEL_CONFIG.expPerNormalBoss;     // 50
    }
    await this.gainExp(expGain);

    // 몬스터 상태 업데이트
    const monster = this.monsters.find(m => m.id === this.currentMonster.id);
    if (monster) {
      monster.status = 'defeated';
      await this.db.put('monsters', monster);
      this.monsters = this.monsters.filter(m => m.id !== monster.id);
    }

    // 아이템 드랍 체크 (보스 타입별 다른 확률)
    let dropChance = DROP_RATES.MONSTER;  // 기본 5%

    if (bossType === 'FINAL_BOSS') {
      dropChance = 1.0;  // 최종보스 100%
    } else if (bossType === 'MID_BOSS') {
      dropChance = 0.7;  // 중간보스 70%
    } else if (bossType === 'NORMAL_BOSS') {
      dropChance = DROP_RATES.BOSS;  // 일반보스 35%
    }

    if (Math.random() < dropChance) {
      const item = this.rollItemDrop(bossType);
      this.onItemDrop(item);

      // 보스는 추가 드랍 가능
      if (bossType === 'FINAL_BOSS' && Math.random() < 0.5) {
        const bonusItem = this.rollItemDrop(bossType);
        setTimeout(() => this.onItemDrop(bonusItem), 500);
      }
    }

    this.stage++;

    if (this.stage > GAME_CONFIG.STAGES_PER_DUNGEON || this.monsters.length === 0) {
      this.endRun(true);
    } else {
      this.nextMonster();
    }
  }

  // 아이템 등급 결정
  rollItemDrop(isBoss) {
    const roll = Math.random();
    let rarity;

    if (roll < RARITY.LEGENDARY.dropRate) {
      rarity = RARITY.LEGENDARY;
    } else if (roll < RARITY.LEGENDARY.dropRate + RARITY.EPIC.dropRate) {
      rarity = RARITY.EPIC;
    } else if (roll < RARITY.LEGENDARY.dropRate + RARITY.EPIC.dropRate + RARITY.RARE.dropRate) {
      rarity = RARITY.RARE;
    } else {
      rarity = RARITY.NORMAL;
    }

    // 아이템 효과 결정
    const items = this.getItemsByRarity(rarity);
    const item = items[Math.floor(Math.random() * items.length)];

    return { ...item, rarity };
  }

  // 등급별 아이템 목록
  getItemsByRarity(rarity) {
    const itemPool = {
      normal: [
        { name: 'HP 포션', effect: 'hp', value: 10, icon: '❤️' },
        { name: '시간의 모래', effect: 'time', value: 5, icon: '⏳' },
        { name: '작은 금화 주머니', effect: 'gold', value: 20, icon: '💰' }
      ],
      rare: [
        { name: '고급 HP 포션', effect: 'hp', value: 25, icon: '💖' },
        { name: '시간의 수정', effect: 'time', value: 10, icon: '⌛' },
        { name: '금화 주머니', effect: 'gold', value: 50, icon: '💎' },
        { name: '콤보 부스터', effect: 'combo', value: 3, icon: '🔥' }
      ],
      epic: [
        { name: '생명의 성배', effect: 'hp', value: 50, icon: '🏆' },
        { name: '무료 힌트권', effect: 'freeHint', value: 1, icon: '💡' },
        { name: '부활의 깃털', effect: 'revive', value: 1, icon: '🪶' },
        { name: '골드 2배 부적', effect: 'goldMulti', value: 2, icon: '✨' }
      ],
      legendary: [
        { name: '불사의 반지', effect: 'revive', value: 2, icon: '💍' },
        { name: '시간 정지', effect: 'timeStop', value: 1, icon: '⏱️' },
        { name: '전설의 금괴', effect: 'gold', value: 200, icon: '🥇' },
        { name: '지혜의 왕관', effect: 'allTime', value: 10, icon: '👑' }
      ]
    };

    return itemPool[rarity.id] || itemPool.normal;
  }

  // 아이템 획득 처리
  onItemDrop(item) {
    console.log(`🎁 아이템 드랍: ${item.name} (${item.rarity.name})`);

    // 효과음
    SoundService.playItemDrop(item.rarity.id);

    // 효과 적용
    switch (item.effect) {
      case 'hp':
        this.player.currentHp = Math.min(this.player.maxHp, this.player.currentHp + item.value);
        break;
      case 'time':
        this.timer += item.value;
        break;
      case 'gold':
        this.player.gold += item.value;
        this.currentRun.earnedGold += item.value;
        break;
      case 'combo':
        this.combo += item.value;
        break;
      case 'freeHint':
        this.currentRun.freeHints = (this.currentRun.freeHints || 0) + item.value;
        break;
      case 'revive':
        this.currentRun.revives = (this.currentRun.revives || 0) + item.value;
        break;
      case 'goldMulti':
        this.currentRun.goldMultiplier = (this.currentRun.goldMultiplier || 1) * item.value;
        break;
      case 'timeStop':
        this.currentRun.timeStops = (this.currentRun.timeStops || 0) + item.value;
        break;
      case 'allTime':
        this.timer += item.value;
        break;
    }

    // 드랍 알림 표시
    this.showItemDropNotification(item);
  }

  // 아이템 드랍 알림
  showItemDropNotification(item) {
    // 간단한 알림 (나중에 애니메이션으로 개선 가능)
    this.droppedItem = item;
    setTimeout(() => {
      this.droppedItem = null;
    }, 2000);
  }

  // 런 종료
  async endRun(isWin) {
    this.currentRun.result = isWin ? 'clear' : 'failed';
    this.currentRun.endTime = Date.now();

    // 효과음
    if (isWin) {
      SoundService.playClear();
    } else {
      SoundService.playGameOver();
    }

    // HP 최대치로 회복 (런 종료 시 항상 풀 회복)
    this.player.maxHp = this.getTotalMaxHp();
    this.player.currentHp = this.player.maxHp;

    // 플레이어 저장
    await this.db.put('player', this.player);

    // 런 기록 저장
    await this.db.add('runs', this.currentRun);

    this.changeScreen(SCREENS.RESULT);
  }

  // 힌트 사용 (정답 대신 도움이 되는 정보 제공)
  useHint() {
    if (!this.currentMonster) return;

    // 힌트권 보유 시 사용
    if (this.player.inventory?.hintTicket > 0) {
      this.player.inventory.hintTicket--;
      this.db.put('player', this.player);
      this.showHintInfo();
      return;
    }

    // 힌트권 없음 - 골드 사용 확인
    if (this.player.gold < 50) {
      alert('힌트권이 없고 골드도 부족합니다!\n(50G 필요)\n\n상점에서 힌트권을 구매하세요!');
      return;
    }

    // 골드 사용 확인
    const useGold = confirm(`힌트권이 없습니다.\n50G를 사용하시겠습니까?\n\n현재 골드: ${this.player.gold}G`);
    if (!useGold) return;

    this.player.gold -= 50;
    this.db.put('player', this.player);
    this.showHintInfo();
  }

  // 힌트 정보 표시
  showHintInfo() {
    if (!this.currentMonster) return;

    // 힌트 정보 수집
    const monster = this.currentMonster;
    const hints = [];

    // 1. 주제/단원 힌트
    if (monster.topic) {
      hints.push(`📚 주제: ${monster.topic}`);
    }

    // 2. 풀이 힌트 (explanation에서 첫 문장만 추출)
    if (monster.explanation) {
      const firstHint = monster.explanation.split(/[.!?。]/)[0];
      if (firstHint && firstHint.length > 5) {
        hints.push(`💭 풀이 힌트: ${firstHint.substring(0, 50)}...`);
      }
    }

    // 3. 오답 하나 제거 (정답이 아닌 선택지 중 하나를 알려줌)
    const choices = monster.choices || [];
    const correctIdx = monster.correctIndex || 0;
    const wrongIndices = choices.map((_, i) => i).filter(i => i !== correctIdx);
    if (wrongIndices.length > 0) {
      const randomWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
      hints.push(`❌ ${randomWrong + 1}번은 오답입니다!`);
    }

    // 4. 키워드 힌트
    if (monster.keywords && monster.keywords.length > 0) {
      hints.push(`🔑 키워드: ${monster.keywords.slice(0, 2).join(', ')}`);
    }

    // 힌트가 없으면 기본 힌트
    if (hints.length === 0) {
      hints.push('💡 문제를 차근차근 읽어보세요!');
      hints.push('📝 선택지를 하나씩 대입해보세요.');
    }

    // 힌트 표시
    alert(`💡 힌트\n\n${hints.join('\n\n')}`);
  }

  // 시간 연장 사용
  useTimeBoost() {
    if (this.player.inventory?.timeBoost > 0) {
      this.player.inventory.timeBoost--;
      this.timer += 60;  // 현재 문제에 +60초
      this.db.put('player', this.player);
      SoundService.playClick();
      alert(`⏰ 시간 +60초! (남은 시간연장: ${this.player.inventory.timeBoost})`);
    } else {
      alert('시간 연장 아이템이 없습니다!\n상점에서 구매하세요.');
    }
  }

  // 스킵
  skipQuestion() {
    this.combo = 0;

    // 스킵 페널티: HP -10
    this.player.currentHp -= 10;

    // HP가 0 이하면 게임 오버
    if (this.player.currentHp <= 0) {
      // 부활권 체크
      if (this.player.inventory?.reviveTicket > 0) {
        this.player.inventory.reviveTicket--;
        this.player.currentHp = Math.round(this.player.maxHp * 0.5);
        this.db.put('player', this.player);
        alert(`🪶 부활권 사용! HP 50% 회복!\n(남은 부활권: ${this.player.inventory.reviveTicket})`);
      } else {
        this.endRun(false);
        return;
      }
    }

    // 시간 설정 (레벨 보너스 + 영구 강화 적용)
    this.timer = this.getTotalTime();
    this.lastTime = Date.now();
    // 같은 몬스터 유지, 타이머만 리셋
  }

  // 문제 전체보기
  showFullQuestion() {
    if (!this.currentMonster) return;

    const question = this.currentMonster.question || '문제 없음';
    const explanation = this.currentMonster.explanation || '';
    const topic = this.currentMonster.topic || '';

    let message = `📝 문제\n\n${question}`;
    if (topic) {
      message += `\n\n📚 주제: ${topic}`;
    }

    alert(message);
  }

  // 레벨 진척도 상세 보기 (HTML 모달)
  showLevelProgress() {
    const level = this.player.level;
    const currentExp = this.player.exp;
    const expForCurrentLevel = this.getExpForLevel(level);
    const progress = this.getLevelProgress();
    const progressPercent = Math.round(progress * 100);

    // 현재 보너스
    const hpBonus = this.getLevelBonusHp();
    const damageBonus = this.getLevelBonusDamage();
    const timeBonus = this.getLevelBonusTime();

    // 총 스탯
    const totalHp = this.getTotalMaxHp();
    const totalDamage = this.getTotalDamage();
    const totalTime = this.getTotalTime();

    // 다음 마일스톤 계산
    const nextDamageLevel = Math.ceil(level / LEVEL_CONFIG.damageLevelInterval) * LEVEL_CONFIG.damageLevelInterval + 1;
    const nextTimeLevel = Math.ceil(level / LEVEL_CONFIG.timeLevelInterval) * LEVEL_CONFIG.timeLevelInterval + 1;

    // 기존 모달 제거
    const existingModal = document.getElementById('level-modal');
    if (existingModal) existingModal.remove();

    // 스탯 분해 텍스트
    let hpDetail = `기본 ${GAME_CONFIG.DEFAULT_HP}`;
    if (hpBonus > 0) hpDetail += ` + 레벨 ${hpBonus}`;
    if (this.player.upgrades?.hp > 0) hpDetail += ` + 강화 ${this.player.upgrades.hp * UPGRADES.hp.value}`;

    let dmgDetail = `기본 ${GAME_CONFIG.DEFAULT_DAMAGE}`;
    if (damageBonus > 0) dmgDetail += ` + 레벨 ${damageBonus}`;
    if (this.player.upgrades?.damage > 0) dmgDetail += ` + 강화 ${this.player.upgrades.damage * UPGRADES.damage.value}`;

    let timeDetail = `기본 ${GAME_CONFIG.DEFAULT_TIME}`;
    if (timeBonus > 0) timeDetail += ` + 레벨 ${timeBonus}`;
    if (this.player.upgrades?.time > 0) timeDetail += ` + 강화 ${this.player.upgrades.time * UPGRADES.time.value}`;

    // HTML 모달 생성
    const modal = document.createElement('div');
    modal.id = 'level-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.85); z-index: 10000;
      display: flex; justify-content: center; align-items: center;
      font-family: system-ui, -apple-system, sans-serif;
    `;

    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 16px; padding: 20px; width: 340px; max-height: 80vh;
        overflow-y: auto; color: #e2e8f0; border: 1px solid #6366f1;
      ">
        <h2 style="margin: 0 0 15px; text-align: center; color: #818cf8;">
          📊 레벨 진척도
        </h2>

        <div style="background: rgba(99,102,241,0.15); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 24px; font-weight: bold; color: #818cf8;">LV.${level}</span>
            <span style="color: #94a3b8;">/ ${LEVEL_CONFIG.maxLevel}</span>
          </div>
          <div style="background: #0a0a0f; border-radius: 8px; height: 20px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #6366f1, #818cf8); height: 100%; width: ${progressPercent}%;"></div>
          </div>
          <div style="text-align: center; margin-top: 5px; font-size: 13px; color: #94a3b8;">
            ${currentExp} / ${expForCurrentLevel} EXP (${progressPercent}%)
          </div>
        </div>

        <div style="background: rgba(34,197,94,0.1); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #22c55e;">📋 현재 스탯</div>
          <div style="font-size: 13px; line-height: 1.8;">
            <div>❤️ HP: <b>${totalHp}</b> <span style="color:#94a3b8; font-size:11px;">(${hpDetail})</span></div>
            <div>⚔️ 공격력: <b>${totalDamage}</b> <span style="color:#94a3b8; font-size:11px;">(${dmgDetail})</span></div>
            <div>⏱️ 시간: <b>${totalTime}초</b> <span style="color:#94a3b8; font-size:11px;">(${timeDetail})</span></div>
          </div>
        </div>

        <div style="background: rgba(251,191,36,0.1); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #fbbf24;">🎯 다음 보너스</div>
          <div style="font-size: 13px; line-height: 1.8;">
            <div>레벨 ${level + 1}: ❤️ HP +1</div>
            ${nextDamageLevel <= LEVEL_CONFIG.maxLevel ? `<div>레벨 ${nextDamageLevel}: ⚔️ 공격력 +${LEVEL_CONFIG.damagePerLevels}</div>` : ''}
            ${nextTimeLevel <= LEVEL_CONFIG.maxLevel ? `<div>레벨 ${nextTimeLevel}: ⏱️ 시간 +${LEVEL_CONFIG.timePerLevels}초</div>` : ''}
          </div>
        </div>

        <div style="background: rgba(99,102,241,0.1); border-radius: 10px; padding: 12px; margin-bottom: 15px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #818cf8;">💡 경험치 획득</div>
          <div style="font-size: 13px; line-height: 1.8;">
            <div>정답: <b>+${LEVEL_CONFIG.expPerCorrect}</b> EXP</div>
            <div>몬스터 처치: <b>+${LEVEL_CONFIG.expPerMonsterKill}</b> EXP</div>
            <div>일반 보스 👹: <b>+${LEVEL_CONFIG.expPerNormalBoss}</b> EXP</div>
            <div>중간 보스 👿: <b>+${LEVEL_CONFIG.expPerMidBoss}</b> EXP</div>
            <div>최종 보스 🐉: <b>+${LEVEL_CONFIG.expPerFinalBoss}</b> EXP</div>
          </div>
        </div>

        <button id="close-level-modal" style="
          width: 100%; padding: 12px; border: none; border-radius: 10px;
          background: #6366f1; color: white; font-size: 16px; font-weight: bold;
          cursor: pointer;
        ">닫기</button>
      </div>
    `;

    document.body.appendChild(modal);

    // 닫기 이벤트
    document.getElementById('close-level-modal').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }

  // 오답 등록 완료 (과목 선택 후) - SmilePrint API 우선, Gemini 폴백
  async completeRegister(subjectId) {
    if (!this.pendingImage) {
      alert('촬영된 사진이 없습니다.');
      this.changeScreen(SCREENS.MAIN);
      return;
    }

    const imageData = this.pendingImage;
    const subjectName = SUBJECTS[subjectId.toUpperCase()]?.name || '수학';

    let question = '';
    let answer = '';
    let answers = [];
    let choices = [];
    let correctIndex = 0;
    let explanation = '';
    let aiAnalysis = null;
    let topic = '';
    let difficulty = 2;
    let keywords = [];
    let questionType = '객관식';
    let formula = '';

    // 1. SmilePrint API 우선 시도
    if (imageAnalysisService.hasApiKey()) {
      try {
        this.showAnalyzingScreen('SmilePrint');

        console.log('🔍 SmilePrint API 분석 시작...');
        const result = await imageAnalysisService.analyze(imageData, subjectId);

        if (result && result.success && result.question) {
          question = result.question;
          answer = result.answer || '';
          choices = result.choices || [];
          correctIndex = result.correctIndex || 0;
          explanation = result.explanation || '';
          topic = result.topic || '';
          difficulty = this.parseDifficulty(result.difficulty);
          keywords = result.keywords || [];
          aiAnalysis = result.aiAnalysis;

          // 새 필드들
          answers = result.answers || [answer];
          questionType = result.questionType || '객관식';
          formula = result.formula || '';

          console.log('✅ SmilePrint 분석 성공:', result);
          console.log('📋 정답:', answer, '| 복수정답:', answers);
          console.log('📋 선택지:', choices);

          // 사용자에게 결과 확인
          const displayQuestion = question.length > 100 ? question.substring(0, 100) + '...' : question;
          const answerDisplay = answers.length > 1 ? answers.join(', ') : answer;
          const confirmed = confirm(`AI가 분석한 결과:\n\n문제: ${displayQuestion}\n정답: ${answerDisplay}\n주제: ${topic}\n풀이: ${explanation}\n\n이 내용이 맞나요?`);

          if (!confirmed) {
            question = prompt('문제를 수정하세요:', question) || question;
            answer = prompt('정답을 수정하세요:', answer) || answer;
          }
        } else {
          throw new Error(result?.message || '분석 결과 없음');
        }
      } catch (err) {
        console.error('SmilePrint 분석 실패:', err);
        // Gemini API로 폴백 시도
        if (geminiService.hasApiKey()) {
          console.log('🔄 Gemini API로 폴백...');
          try {
            this.showAnalyzingScreen('Gemini');
            const result = await geminiService.analyzeImage(imageData, subjectName);
            if (result && result.question) {
              question = result.question;
              answer = result.answer || '';
              choices = result.choices || [];
              correctIndex = result.correctIndex || 0;
              explanation = result.explanation || '';
              console.log('✅ Gemini 폴백 성공');

              const displayQuestion = question.length > 100 ? question.substring(0, 100) + '...' : question;
              const confirmed = confirm(`AI가 분석한 결과:\n\n문제: ${displayQuestion}\n정답: ${answer}\n\n이 내용이 맞나요?`);
              if (!confirmed) {
                question = prompt('문제를 수정하세요:', question) || question;
                answer = prompt('정답을 수정하세요:', answer) || answer;
              }
            } else {
              throw new Error('Gemini 분석 결과 없음');
            }
          } catch (geminiErr) {
            console.error('Gemini 폴백 실패:', geminiErr);
            alert(`AI 분석 실패: ${err.message}\n\n수동으로 입력해주세요.`);
            question = prompt('문제를 입력하세요:') || '';
            if (!question) return;
            answer = prompt('정답을 입력하세요:') || '';
          }
        } else {
          alert(`AI 분석 실패: ${err.message}\n\n수동으로 입력해주세요.`);
          question = prompt('문제를 입력하세요:') || '';
          if (!question) return;
          answer = prompt('정답을 입력하세요:') || '';
        }
      }
    }
    // 2. SmilePrint 키 없으면 Gemini API 시도
    else if (geminiService.hasApiKey()) {
      try {
        this.showAnalyzingScreen('Gemini');
        console.log('🤖 Gemini API 분석 시작...');
        const result = await geminiService.analyzeImage(imageData, subjectName);

        if (result && result.question) {
          question = result.question;
          answer = result.answer || '';
          choices = result.choices || [];
          correctIndex = result.correctIndex || 0;
          explanation = result.explanation || '';

          const displayQuestion = question.length > 100 ? question.substring(0, 100) + '...' : question;
          const confirmed = confirm(`AI가 분석한 결과:\n\n문제: ${displayQuestion}\n정답: ${answer}\n\n이 내용이 맞나요?`);
          if (!confirmed) {
            question = prompt('문제를 수정하세요:', question) || question;
            answer = prompt('정답을 수정하세요:', answer) || answer;
          }
        } else {
          throw new Error('분석 결과 없음');
        }
      } catch (err) {
        console.error('Gemini 분석 실패:', err);
        alert(`AI 분석 실패: ${err.message}\n\n수동으로 입력해주세요.`);
        question = prompt('문제를 입력하세요:') || '';
        if (!question) return;
        answer = prompt('정답을 입력하세요:') || '';
      }
    }
    // 3. API 키 없으면 수동 입력
    else {
      question = prompt('문제를 입력하세요:') || '';
      if (!question) return;
      answer = prompt('정답을 입력하세요:') || '';
    }

    // 정답 검증: 비어있으면 choices에서 추출
    if (!answer && choices && choices.length > 0) {
      answer = choices[correctIndex] || choices[0];
    }

    // 그래도 정답이 없으면 수동 입력 요청
    if (!answer) {
      answer = prompt('정답을 입력하세요 (숫자):') || '';
      if (!answer) {
        alert('정답이 없어 등록할 수 없습니다.');
        return;
      }
    }

    // 선택지가 없거나 부족하면 자동 생성
    if (!choices || choices.length < 4) {
      const wrongAnswers = this.generateWrongAnswers(answer);
      choices = [answer, ...wrongAnswers];
      correctIndex = 0;
    }

    // 몬스터 데이터 생성 (확장된 스키마)
    const monster = {
      subject: subjectId,
      imageData: imageData,
      question: question,
      answer: answer,
      answers: answers.length > 0 ? answers : [answer],
      choices: choices,
      correctIndex: correctIndex,
      explanation: explanation,
      topic: topic,
      difficulty: difficulty,
      keywords: keywords,
      questionType: questionType,
      formula: formula,
      hp: 80 + difficulty * 20,
      maxHp: 80 + difficulty * 20,
      createdAt: Date.now(),
      status: 'alive',
      aiAnalysis: aiAnalysis,
      stats: {
        attempts: 0,
        correct: 0,
        wrong: 0,
        lastAttempt: null,
        averageTime: 0
      },
      review: {
        nextReviewDate: null,
        reviewCount: 0,
        masteryLevel: 0
      }
    };

    await this.db.add('monsters', monster);
    await this.loadMonsters();

    this.pendingImage = null;
    this.previewImg = null;
    this.previewImageLoaded = false;

    alert('몬스터가 등록되었습니다! 👾');
    this.changeScreen(SCREENS.MAIN);
  }

  // 난이도 문자열 파싱
  parseDifficulty(diffStr) {
    if (diffStr === '상' || diffStr === 'high') return 3;
    if (diffStr === '하' || diffStr === 'low') return 1;
    return 2; // 기본값: 중
  }

  // AI 분석 중 화면
  showAnalyzingScreen(apiName = 'AI') {
    Renderer.clear();
    Renderer.drawGrid();
    Renderer.drawText(`🤖 ${apiName} 분석 중...`, 200, 300, {
      font: 'bold 24px system-ui',
      color: COLORS.ACCENT_LIGHT,
      align: 'center'
    });
    Renderer.drawText('문제를 읽고 답을 찾고 있어요', 200, 350, {
      font: '16px system-ui',
      color: COLORS.TEXT_SECONDARY,
      align: 'center'
    });
  }

  // AI 문제 생성 중 화면
  showGeneratingScreen(count) {
    Renderer.clear();
    Renderer.drawGrid();
    Renderer.drawText(`🤖 AI 문제 생성 중...`, 200, 280, {
      font: 'bold 24px system-ui',
      color: COLORS.ACCENT_LIGHT,
      align: 'center'
    });
    Renderer.drawText(`${count}개 문제를 만들고 있어요`, 200, 330, {
      font: '16px system-ui',
      color: COLORS.TEXT_SECONDARY,
      align: 'center'
    });
    Renderer.drawText('잠시만 기다려주세요...', 200, 370, {
      font: '14px system-ui',
      color: COLORS.TEXT_SECONDARY,
      align: 'center'
    });
  }

  // OCR 로딩 화면
  showOcrLoading() {
    Renderer.clear();
    Renderer.drawGrid();
    Renderer.drawText('📷 사진 분석 중...', 200, 300, {
      font: 'bold 20px system-ui',
      color: COLORS.ACCENT_LIGHT,
      align: 'center'
    });
    Renderer.drawText('잠시만 기다려주세요', 200, 340, {
      font: '14px system-ui',
      color: COLORS.TEXT_SECONDARY,
      align: 'center'
    });
  }

  // OCR 실행
  async runOcr(imageData) {
    if (typeof Tesseract === 'undefined') {
      console.warn('Tesseract.js not loaded');
      return '';
    }

    const result = await Tesseract.recognize(imageData, 'kor+eng', {
      logger: m => console.log('OCR:', m.status, Math.round(m.progress * 100) + '%')
    });

    return result.data.text.trim();
  }

  // 이미지 캡처 (iOS 호환)
  captureImage() {
    return new Promise((resolve) => {
      // 기존 input 제거
      const oldInput = document.getElementById('camera-input');
      if (oldInput) oldInput.remove();

      const input = document.createElement('input');
      input.type = 'file';
      input.id = 'camera-input';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.style.position = 'absolute';
      input.style.left = '-9999px';
      input.style.opacity = '0';

      // iOS는 DOM에 추가된 input만 작동
      document.body.appendChild(input);

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            resolve(reader.result);
            input.remove();
          };
          reader.onerror = () => {
            resolve(null);
            input.remove();
          };
          reader.readAsDataURL(file);
        } else {
          resolve(null);
          input.remove();
        }
      };

      // iOS Safari에서 취소 감지
      input.oncancel = () => {
        resolve(null);
        input.remove();
      };

      // 약간의 지연 후 클릭 (iOS 호환성)
      setTimeout(() => {
        input.click();
      }, 100);
    });
  }

  // 저장
  async save() {
    await this.db.put('player', this.player);
  }
}
