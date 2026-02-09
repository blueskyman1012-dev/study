// 시각 효과 시스템 (파티클, 플로팅텍스트, 화면흔들림, 플래시)
import { Renderer } from '../canvas/Renderer.js';
import { GAME_CONFIG, COSMETIC_ITEMS } from '../utils/constants.js';
import { t } from '../i18n/i18n.js';

export class EffectSystem {
  constructor() {
    this.particles = [];
    this.floatingTexts = [];
    this.screenShake = 0;
    this.screenFlash = null;
    this.comboGlow = 0;
    this.bossEntrance = 0;
    this.pulseTime = 0;
    this.levelUpPopup = null;
    this.achievementBanner = null;
    this._achievementQueue = [];
  }

  setCosmetics(cosmetics) {
    this._cosmetics = cosmetics;
  }

  getCorrectFlashColor() {
    if (!this._cosmetics) return '#22c55e';
    const style = this._cosmetics.correctFlash || 'default';
    const item = COSMETIC_ITEMS.correctFlash.items.find(i => i.id === style);
    return item?.color || '#22c55e';
  }

  // 활성 이펙트 유무 (dirty 렌더링 판단용)
  hasActiveEffects() {
    return this.particles.length > 0 ||
      this.floatingTexts.length > 0 ||
      this.screenShake > 0 ||
      this.screenFlash !== null ||
      this.bossEntrance > 0 ||
      this.levelUpPopup !== null ||
      this.achievementBanner !== null;
  }

  update() {
    const now = Date.now();
    this.pulseTime = now;

    // 활성 이펙트 없으면 조기 종료
    if (!this.hasActiveEffects()) return;

    // 파티클 업데이트 (swap-pop으로 O(n) 삭제)
    let writeIdx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity || 0;
      p.life -= 16;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life > 0) {
        this.particles[writeIdx++] = p;
      }
    }
    this.particles.length = writeIdx;

    // 떠오르는 텍스트 업데이트 (swap-pop)
    writeIdx = 0;
    for (let i = 0; i < this.floatingTexts.length; i++) {
      const ft = this.floatingTexts[i];
      ft.y -= ft.speed;
      ft.life -= 16;
      ft.alpha = Math.max(0, ft.life / ft.maxLife);
      ft.scale = 1 + (1 - ft.alpha) * 0.3;
      if (ft.life > 0) {
        this.floatingTexts[writeIdx++] = ft;
      }
    }
    this.floatingTexts.length = writeIdx;

    // 화면 흔들림 감소
    if (this.screenShake > 0) {
      this.screenShake *= 0.85;
      if (this.screenShake < 0.5) this.screenShake = 0;
    }

    // 화면 플래시 감소
    if (this.screenFlash) {
      this.screenFlash.alpha -= 0.05;
      if (this.screenFlash.alpha <= 0) {
        this.screenFlash = null;
      }
    }

    // 콤보 글로우 감소
    if (this.comboGlow > 0) {
      this.comboGlow *= 0.95;
    }

    // 보스 등장 연출
    if (this.bossEntrance > 0) {
      this.bossEntrance -= 0.02;
    }

    // 업적 배너
    if (this.achievementBanner) {
      this.achievementBanner.elapsed += 16;
      const { elapsed } = this.achievementBanner;
      if (elapsed < 2000) {
        this.achievementBanner.alpha = 1;
      } else if (elapsed < 2500) {
        this.achievementBanner.alpha = 1 - (elapsed - 2000) / 500;
      } else {
        this.achievementBanner = null;
        if (this._achievementQueue.length > 0) {
          const next = this._achievementQueue.shift();
          this.achievementBanner = next;
          this.addParticleExplosion(200, 40, '#fbbf24', 15);
        }
      }
    }

    // 레벨업 팝업
    if (this.levelUpPopup) {
      this.levelUpPopup.elapsed += 16;
      const { elapsed } = this.levelUpPopup;
      if (elapsed < 2500) {
        this.levelUpPopup.alpha = 1;
      } else if (elapsed < 3000) {
        this.levelUpPopup.alpha = 1 - (elapsed - 2500) / 500;
      } else {
        this.levelUpPopup = null;
      }
    }
  }

  render() {
    const ctx = Renderer.ctx;

    // 파티클 배치 렌더링 (save/restore 1회)
    if (this.particles.length > 0) {
      ctx.save();
      const TWO_PI = Math.PI * 2;
      for (const p of this.particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }

    // 떠오르는 텍스트 배치 렌더링
    if (this.floatingTexts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const ft of this.floatingTexts) {
        ctx.globalAlpha = ft.alpha;
        ctx.font = `bold ${Math.round(ft.fontSize * ft.scale)}px system-ui`;
        ctx.fillStyle = ft.color;
        if (ft.glow) {
          ctx.shadowColor = ft.color;
          ctx.shadowBlur = 12;
        } else {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
      }
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 화면 플래시
    if (this.screenFlash) {
      ctx.save();
      ctx.globalAlpha = this.screenFlash.alpha;
      ctx.fillStyle = this.screenFlash.color;
      ctx.fillRect(0, 0, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
      ctx.restore();
    }

    // 업적 배너
    this.renderAchievementBanner();

    // 레벨업 팝업
    if (this.levelUpPopup) {
      const w = GAME_CONFIG.CANVAS_WIDTH;
      const h = GAME_CONFIG.CANVAS_HEIGHT;
      const a = this.levelUpPopup.alpha;

      ctx.save();

      // 반투명 오버레이
      ctx.globalAlpha = a * 0.4;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);

      // 카드 배경
      const cardW = 280;
      const cardH = 180;
      const cx = w / 2;
      const cy = h / 2;
      ctx.globalAlpha = a;

      const grad = ctx.createLinearGradient(cx - cardW / 2, cy - cardH / 2, cx + cardW / 2, cy + cardH / 2);
      grad.addColorStop(0, '#1a1040');
      grad.addColorStop(1, '#2d1b69');

      // 둥근 모서리 카드
      const r = 16;
      const x0 = cx - cardW / 2;
      const y0 = cy - cardH / 2;
      ctx.beginPath();
      ctx.moveTo(x0 + r, y0);
      ctx.lineTo(x0 + cardW - r, y0);
      ctx.arcTo(x0 + cardW, y0, x0 + cardW, y0 + r, r);
      ctx.lineTo(x0 + cardW, y0 + cardH - r);
      ctx.arcTo(x0 + cardW, y0 + cardH, x0 + cardW - r, y0 + cardH, r);
      ctx.lineTo(x0 + r, y0 + cardH);
      ctx.arcTo(x0, y0 + cardH, x0, y0 + cardH - r, r);
      ctx.lineTo(x0, y0 + r);
      ctx.arcTo(x0, y0, x0 + r, y0, r);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();

      // LEVEL UP! 텍스트
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 32px system-ui';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 4;
      ctx.strokeText('LEVEL UP!', cx, cy - 45);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('LEVEL UP!', cx, cy - 45);

      // LV 텍스트
      ctx.font = 'bold 26px system-ui';
      ctx.fillStyle = '#c084fc';
      ctx.strokeText(`LV.${this.levelUpPopup.level}`, cx, cy - 5);
      ctx.fillText(`LV.${this.levelUpPopup.level}`, cx, cy - 5);

      // 보너스 메시지
      ctx.font = 'bold 16px system-ui';
      ctx.fillStyle = '#e2e8f0';
      ctx.lineWidth = 2;
      const lines = this.levelUpPopup.bonusMsg.split('\n');
      lines.forEach((line, i) => {
        ctx.strokeText(line, cx, cy + 30 + i * 22);
        ctx.fillText(line, cx, cy + 30 + i * 22);
      });

      ctx.restore();
    }
  }

  addDamageText(x, y, damage, isPlayerDamage = false) {
    let color = isPlayerDamage ? '#ef4444' : '#fbbf24';
    let fontSize = isPlayerDamage ? 24 : 20;
    let glow = false;

    if (!isPlayerDamage && this._cosmetics) {
      const style = this._cosmetics.damageTextStyle || 'default';
      if (style === 'neon') {
        color = '#00ffff';
        glow = true;
      } else if (style === 'pixel') {
        fontSize = Math.round(fontSize * 1.4);
      }
    }

    this.floatingTexts.push({
      x, y,
      text: `-${damage}`,
      color,
      fontSize,
      speed: 0.8,
      life: 2000,
      maxLife: 2000,
      alpha: 1,
      scale: 1,
      glow
    });
  }

  addGoldText(x, y, amount) {
    this.floatingTexts.push({
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

  addComboText(combo) {
    this.floatingTexts.push({
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
    this.comboGlow = 1;
  }

  addParticleExplosion(x, y, color, count = 12, useCosmetic = false) {
    let particleColors = null;
    if (useCosmetic && this._cosmetics) {
      const style = this._cosmetics.particleStyle || 'default';
      if (style !== 'default') {
        const item = COSMETIC_ITEMS.particle.items.find(i => i.id === style);
        if (item?.colors) particleColors = item.colors;
      }
    }
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      const c = particleColors
        ? particleColors[Math.floor(Math.random() * particleColors.length)]
        : color;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 0.1,
        size: 3 + Math.random() * 4,
        color: c,
        life: 500 + Math.random() * 300,
        maxLife: 800,
        alpha: 1
      });
    }
  }

  shakeScreen(intensity = 10) {
    this.screenShake = intensity;
  }

  flashScreen(color, alpha = 0.3) {
    this.screenFlash = { color, alpha };
  }

  startBossEntrance() {
    this.bossEntrance = 1;
    this.flashScreen('#ff0000', 0.4);
    this.shakeScreen(15);
  }

  showLevelUp(level, bonusMsg) {
    this.levelUpPopup = { level, bonusMsg, alpha: 1, elapsed: 0 };
    this.addParticleExplosion(
      GAME_CONFIG.CANVAS_WIDTH / 2,
      GAME_CONFIG.CANVAS_HEIGHT / 2,
      '#fbbf24', 20
    );
    this.flashScreen('#fbbf24', 0.2);
  }

  isLevelUpActive() {
    return this.levelUpPopup !== null;
  }

  dismissLevelUp() {
    this.levelUpPopup = null;
  }

  showAchievementUnlock(achv) {
    const banner = {
      icon: achv.icon,
      name: achv.nameKey,
      reward: achv.reward,
      alpha: 1,
      elapsed: 0
    };
    if (this.achievementBanner) {
      this._achievementQueue.push(banner);
    } else {
      this.achievementBanner = banner;
      this.addParticleExplosion(200, 40, '#fbbf24', 15);
    }
  }

  renderAchievementBanner() {
    if (!this.achievementBanner) return;
    const ctx = Renderer.ctx;
    const a = this.achievementBanner.alpha;
    const w = GAME_CONFIG.CANVAS_WIDTH;

    ctx.save();
    ctx.globalAlpha = a;

    // 배너 배경
    const bannerH = 50;
    const slideY = Math.min(0, -50 + this.achievementBanner.elapsed * 0.2);
    ctx.fillStyle = 'rgba(99,102,241,0.95)';
    ctx.fillRect(0, slideY, w, bannerH);

    // 아이콘 + 텍스트
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '20px system-ui';
    ctx.fillStyle = '#fff';
    ctx.fillText(this.achievementBanner.icon, 30, slideY + bannerH / 2);

    ctx.font = 'bold 14px system-ui';
    ctx.fillStyle = '#fbbf24';
    ctx.textAlign = 'left';
    ctx.fillText(`🏆 ${t(this.achievementBanner.name)}`, 55, slideY + 18);

    ctx.font = '12px system-ui';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`+${this.achievementBanner.reward}G`, 55, slideY + 36);

    ctx.restore();
  }
}
