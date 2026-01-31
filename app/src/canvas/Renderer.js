// Canvas 렌더러
import { COLORS } from '../utils/constants.js';

export const Renderer = {
  ctx: null,
  width: 400,
  height: 700,

  init(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  },

  // 화면 클리어
  clear() {
    this.ctx.fillStyle = COLORS.BG_PRIMARY;
    this.ctx.fillRect(0, 0, this.width, this.height);
  },

  // 그리드 패턴
  drawGrid() {
    // 메인 그리드 (굵은 선)
    this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.38)';
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= this.width; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    for (let y = 0; y <= this.height; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    // 서브 그리드 (가는 선)
    this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
    this.ctx.lineWidth = 0.5;

    for (let x = 20; x <= this.width; x += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }

    for (let y = 20; y <= this.height; y += 40) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
  },

  // 둥근 사각형
  roundRect(x, y, w, h, r, fill, stroke) {
    this.ctx.beginPath();
    this.ctx.moveTo(x + r, y);
    this.ctx.arcTo(x + w, y, x + w, y + h, r);
    this.ctx.arcTo(x + w, y + h, x, y + h, r);
    this.ctx.arcTo(x, y + h, x, y, r);
    this.ctx.arcTo(x, y, x + w, y, r);
    this.ctx.closePath();

    if (fill) {
      this.ctx.fillStyle = fill;
      this.ctx.fill();
    }
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  },

  // HP 바 (그라데이션 적용)
  drawHPBar(x, y, w, h, current, max, color = COLORS.HP_PLAYER) {
    const ratio = Math.max(0, Math.min(1, current / max));
    const barWidth = w * ratio;
    const radius = h / 2;

    // 배경 (약간 입체감)
    this.ctx.save();
    this.roundRect(x, y, w, h, radius, 'rgba(0,0,0,0.3)');
    this.roundRect(x, y + 1, w, h - 2, radius, 'rgba(255,255,255,0.05)');

    // 현재 HP (너비가 최소값 이상일 때만 그리기)
    if (barWidth > 2) {
      const safeRadius = Math.min(radius, barWidth / 2);

      // 그라데이션 생성
      const gradient = this.ctx.createLinearGradient(x, y, x, y + h);
      gradient.addColorStop(0, this.lightenColor(color, 30));
      gradient.addColorStop(0.5, color);
      gradient.addColorStop(1, this.darkenColor(color, 20));

      this.roundRect(x, y, barWidth, h, safeRadius, gradient);

      // 하이라이트 (상단)
      this.ctx.globalAlpha = 0.3;
      this.roundRect(x + 2, y + 2, Math.max(0, barWidth - 4), h / 3, safeRadius / 2, 'rgba(255,255,255,0.5)');
      this.ctx.globalAlpha = 1;
    } else if (barWidth > 0) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, barWidth, h);
    }
    this.ctx.restore();
  },

  // 타이머 바 (경고 효과 포함)
  drawTimerBar(x, y, w, h, current, max, pulseTime = 0) {
    const ratio = Math.max(0, Math.min(1, current / max));
    const barWidth = w * ratio;
    const radius = h / 2;

    // 색상 결정 (시간에 따라 변경)
    let color;
    if (ratio > 0.5) {
      color = '#22c55e';  // 초록
    } else if (ratio > 0.25) {
      color = '#fbbf24';  // 노랑
    } else {
      color = '#ef4444';  // 빨강
      // 위험 상태에서 깜빡임
      if (Math.sin(pulseTime / 100) > 0) {
        color = '#ff6b6b';
      }
    }

    // 배경
    this.roundRect(x, y, w, h, radius, 'rgba(0,0,0,0.3)');

    if (barWidth > 2) {
      const safeRadius = Math.min(radius, barWidth / 2);

      // 그라데이션
      const gradient = this.ctx.createLinearGradient(x, y, x, y + h);
      gradient.addColorStop(0, this.lightenColor(color, 20));
      gradient.addColorStop(1, this.darkenColor(color, 10));

      this.roundRect(x, y, barWidth, h, safeRadius, gradient);
    }
  },

  // 색상 밝게
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    return `rgb(${R},${G},${B})`;
  },

  // 색상 어둡게
  darkenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    return `rgb(${R},${G},${B})`;
  },

  // 텍스트 (오답등록 버튼과 동일한 폰트)
  drawText(text, x, y, options = {}) {
    const {
      font = '14px',
      color = COLORS.TEXT_PRIMARY,
      align = 'left',
      baseline = 'top'
    } = options;

    // font에서 weight와 size 추출
    const match = font.match(/(bold\s+)?(\d+)px/i);
    const weight = match && match[1] ? 'bold ' : '';
    const size = match ? match[2] : '14';

    // 오답등록 버튼과 동일한 폰트
    this.ctx.font = `${weight}${size}px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  },

  // 버튼 (선명한 텍스트)
  drawButton(x, y, w, h, text, options = {}) {
    const {
      bgColor = COLORS.ACCENT,
      textColor = COLORS.TEXT_PRIMARY,
      borderColor = null,
      fontSize = 16
    } = options;

    this.roundRect(x, y, w, h, 12, bgColor, borderColor);
    this.drawText(text, x + w / 2, y + h / 2, {
      font: `bold ${fontSize}px system-ui`,
      color: textColor,
      align: 'center',
      baseline: 'middle'
    });
  },

  // 이미지
  drawImage(img, x, y, w, h) {
    if (img && img.complete) {
      this.ctx.drawImage(img, x, y, w, h);
    }
  },

  // 원
  drawCircle(x, y, r, fill, stroke) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, r, 0, Math.PI * 2);

    if (fill) {
      this.ctx.fillStyle = fill;
      this.ctx.fill();
    }
    if (stroke) {
      this.ctx.strokeStyle = stroke;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
    }
  }
};
