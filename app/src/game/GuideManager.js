// 신규 유저 가이드 관리
import { Renderer } from '../canvas/Renderer.js';
import { safeSetItem } from '../utils/storage.js';
import { t } from '../i18n/i18n.js';

export class GuideManager {
  constructor(game) {
    this.game = game;
    this.guideStep = null;
  }

  showGuide() {
    this.guideStep = 0;
    this.game.render();
  }

  _advanceGuide() {
    const totalPages = 7;
    if (this.guideStep < totalPages - 1) {
      this.guideStep++;
    } else {
      this.guideStep = null;
      safeSetItem('guide_shown', '1');
    }
    this.game.render();
  }

  renderGuide(ctx) {
    const totalPages = 7;
    const step = this.guideStep;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, 400, 700);

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

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.stroke();

    const icons = ['👋', '📸', '⚔️', '💥', '🎒', '🏪', '🏆'];
    Renderer.drawText(icons[step], 200, 150, { font: '56px system-ui', align: 'center' });

    Renderer.drawText(t(`guide_title_${step}`), 200, 230, {
      font: 'bold 22px system-ui', color: '#818cf8', align: 'center'
    });

    // 페이지 번호 표시
    Renderer.drawText(`${step + 1}/${totalPages}`, 200, 255, {
      font: '13px system-ui', color: 'rgba(255,255,255,0.5)', align: 'center'
    });

    const desc = t(`guide_desc_${step}`);
    const lines = desc.split('\n');
    let lineY = 280;
    for (const line of lines) {
      Renderer.drawText(line, 200, lineY, {
        font: '15px system-ui', color: '#e2e8f0', align: 'center'
      });
      lineY += 22;
    }

    const indicatorY = 530;
    for (let i = 0; i < totalPages; i++) {
      const ix = 200 + (i - (totalPages - 1) / 2) * 20;
      ctx.beginPath();
      ctx.arc(ix, indicatorY, 5, 0, Math.PI * 2);
      ctx.fillStyle = i === step ? '#818cf8' : 'rgba(255,255,255,0.3)';
      ctx.fill();
    }

    const btnY = 555, btnW = 200, btnH = 44;
    const btnX = 100;
    const isLast = step === totalPages - 1;
    const btnText = isLast ? t('guide_start') : t('guide_next');

    Renderer.roundRect(btnX, btnY, btnW, btnH, 12, '#6366f1');
    Renderer.drawText(btnText, 200, btnY + btnH / 2, {
      font: 'bold 17px system-ui', color: '#ffffff', align: 'center'
    });

    this.game.registerClickArea('guide_btn', btnX, btnY, btnW, btnH, () => {
      this._advanceGuide();
    });
  }
}
