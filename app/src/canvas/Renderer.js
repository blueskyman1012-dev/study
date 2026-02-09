// Canvas 렌더러
import { COLORS } from '../utils/constants.js';
import { safeGetItem, safeSetItem } from '../utils/storage.js';

export const BG_THEMES = [
  { id: 'default', bg: '#0a0a0f', grid: 'rgba(120,130,255,0.5)', gridSub: 'rgba(120,130,255,0.18)', glow: 'rgba(99,102,241,0.4)' },
  { id: 'emerald', bg: '#060f0a', grid: 'rgba(52,211,153,0.5)', gridSub: 'rgba(52,211,153,0.18)', glow: 'rgba(16,185,129,0.4)' },
  { id: 'crimson', bg: '#0f0606', grid: 'rgba(248,113,113,0.5)', gridSub: 'rgba(248,113,113,0.18)', glow: 'rgba(239,68,68,0.4)' },
  { id: 'amber', bg: '#0f0b04', grid: 'rgba(251,191,36,0.5)', gridSub: 'rgba(251,191,36,0.18)', glow: 'rgba(245,158,11,0.4)' },
  { id: 'violet', bg: '#0b060f', grid: 'rgba(167,139,250,0.5)', gridSub: 'rgba(167,139,250,0.18)', glow: 'rgba(139,92,246,0.4)' },
  { id: 'cyan', bg: '#040b0f', grid: 'rgba(34,211,238,0.5)', gridSub: 'rgba(34,211,238,0.18)', glow: 'rgba(6,182,212,0.4)' },
  { id: 'rose', bg: '#0f0408', grid: 'rgba(251,113,133,0.5)', gridSub: 'rgba(251,113,133,0.18)', glow: 'rgba(244,63,94,0.4)' },
];

export const Renderer = {
  ctx: null,
  width: 400,
  height: 700,

  _gridCache: null,
  _bgTheme: null,
  _uiOpacity: null,
  _bgImage: null,
  _bgImageList: null,

  // 성능 캐시
  _fontCache: new Map(),
  _lastFont: null,
  _colorCache: new Map(),
  _gradientCache: new Map(),

  init(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this._gridCache = null;
    // 저장된 사용자 설정 복원 (구매한 테마/투명도 유지)
    this._loadBgTheme();
    this._loadUiOpacity();
    const savedBgImage = safeGetItem('bg_image');
    if (savedBgImage) {
      this._loadBgImage(savedBgImage);
    } else {
      this._bgImage = null;
    }
    // 성능 캐시 초기화
    this._fontCache.clear();
    this._lastFont = null;
    this._colorCache.clear();
    this._gradientCache.clear();
  },

  _loadUiOpacity() {
    const val = safeGetItem('ui_opacity');
    this._uiOpacity = val !== null ? parseFloat(val) : 1.0;
  },

  getUiOpacity() {
    if (this._uiOpacity === null) this._loadUiOpacity();
    return this._uiOpacity;
  },

  setUiOpacity(val) {
    this._uiOpacity = Math.max(0.1, Math.min(1.0, val));
    safeSetItem('ui_opacity', String(this._uiOpacity));
  },

  applyUiOpacity() {
    this.ctx.globalAlpha = this.getUiOpacity();
  },

  resetOpacity() {
    this.ctx.globalAlpha = 1;
  },

  _loadBgTheme() {
    const id = safeGetItem('bg_theme') || 'default';
    this._bgTheme = BG_THEMES.find(t => t.id === id) || BG_THEMES[0];
  },

  setRandomBgTheme() {
    const others = BG_THEMES.filter(t => t.id !== this._bgTheme?.id);
    const picked = others[Math.floor(Math.random() * others.length)];
    safeSetItem('bg_theme', picked.id);
    this._bgTheme = picked;
    this._gridCache = null;
    // 색상 테마로 변경 시 이미지 배경 해제
    this._bgImage = null;
    safeSetItem('bg_image', '');
  },

  setBgTheme(themeId) {
    const theme = BG_THEMES.find(t => t.id === themeId);
    if (!theme) return;
    safeSetItem('bg_theme', theme.id);
    this._bgTheme = theme;
    this._gridCache = null;
    this._bgImage = null;
    safeSetItem('bg_image', '');
  },

  // 배경 이미지 목록 로드 (매번 새로 fetch)
  async loadBgImageList() {
    try {
      const resp = await fetch('./background/list.json?' + Date.now());
      if (!resp.ok) {
        this._bgImageList = [];
        return this._bgImageList;
      }
      this._bgImageList = await resp.json();
    } catch {
      this._bgImageList = [];
    }
    return this._bgImageList;
  },

  async _loadBgImage(path) {
    if (!path) { this._bgImage = null; return false; }
    // 상대 경로로 변환
    const src = path.startsWith('/') ? '.' + path : path;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { this._bgImage = img; resolve(true); };
      img.onerror = () => { this._bgImage = null; resolve(false); };
      img.src = src;
    });
  },

  // 화면 클리어
  clear() {
    if (this._bgImage && this._bgImage.complete) {
      this.ctx.drawImage(this._bgImage, 0, 0, this.width, this.height);
      // 반투명 오버레이로 UI 가독성 확보
      this.ctx.fillStyle = 'rgba(0,0,0,0.4)';
      this.ctx.fillRect(0, 0, this.width, this.height);
    } else {
      this.ctx.fillStyle = this._bgTheme?.bg || COLORS.BG_PRIMARY;
      this.ctx.fillRect(0, 0, this.width, this.height);
    }
  },

  // 그리드 패턴 (오프스크린 캐싱) - 이미지 배경일 때는 그리지 않음
  drawGrid() {
    // 이미지 배경이 설정되어 있으면 그리드 숨김
    if (this._bgImage && this._bgImage.complete) return;

    if (!this._gridCache) {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const theme = this._bgTheme || BG_THEMES[0];
      const offscreen = document.createElement('canvas');
      offscreen.width = this.width * dpr;
      offscreen.height = this.height * dpr;
      const oc = offscreen.getContext('2d');
      oc.scale(dpr, dpr);

      // 주 그리드 (네온 효과)
      oc.strokeStyle = theme.grid;
      oc.lineWidth = 1;
      oc.shadowColor = theme.glow;
      oc.shadowBlur = 3;
      for (let x = 0; x <= this.width; x += 40) {
        oc.beginPath(); oc.moveTo(x, 0); oc.lineTo(x, this.height); oc.stroke();
      }
      for (let y = 0; y <= this.height; y += 40) {
        oc.beginPath(); oc.moveTo(0, y); oc.lineTo(this.width, y); oc.stroke();
      }
      // 보조 그리드
      oc.shadowBlur = 0;
      oc.strokeStyle = theme.gridSub;
      oc.lineWidth = 0.5;
      for (let x = 20; x <= this.width; x += 40) {
        oc.beginPath(); oc.moveTo(x, 0); oc.lineTo(x, this.height); oc.stroke();
      }
      for (let y = 20; y <= this.height; y += 40) {
        oc.beginPath(); oc.moveTo(0, y); oc.lineTo(this.width, y); oc.stroke();
      }
      this._gridCache = offscreen;
    }
    this.ctx.drawImage(this._gridCache, 0, 0, this.width, this.height);
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

      // 그라데이션 캐시: 위치+높이+색상이 같으면 재사용
      const gKey = `HP_${x}_${y}_${h}_${color}`;
      let gradient = this._gradientCache.get(gKey);
      if (!gradient) {
        gradient = this.ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, this.lightenColor(color, 30));
        gradient.addColorStop(0.5, color);
        gradient.addColorStop(1, this.darkenColor(color, 20));
        this._evictGradientCache();
        this._gradientCache.set(gKey, gradient);
      }

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

      // 그라데이션 캐시: 타이머바 위치+높이+색상이 같으면 재사용
      const gKey = `TM_${x}_${y}_${h}_${color}`;
      let gradient = this._gradientCache.get(gKey);
      if (!gradient) {
        gradient = this.ctx.createLinearGradient(x, y, x, y + h);
        gradient.addColorStop(0, this.lightenColor(color, 20));
        gradient.addColorStop(1, this.darkenColor(color, 10));
        this._evictGradientCache();
        this._gradientCache.set(gKey, gradient);
      }

      this.roundRect(x, y, barWidth, h, safeRadius, gradient);
    }
  },

  // 그라디언트 캐시 크기 제한 (50개 초과 시 전체 클리어)
  _evictGradientCache() {
    if (this._gradientCache.size > 50) {
      this._gradientCache.clear();
    }
  },

  // 색상 밝게 (캐시 적용)
  lightenColor(color, percent) {
    const key = `${color}_L${percent}`;
    let result = this._colorCache.get(key);
    if (result) return result;
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.min(255, (num >> 16) + amt);
    const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
    const B = Math.min(255, (num & 0x0000FF) + amt);
    result = `rgb(${R},${G},${B})`;
    this._colorCache.set(key, result);
    return result;
  },

  // 색상 어둡게 (캐시 적용)
  darkenColor(color, percent) {
    const key = `${color}_D${percent}`;
    let result = this._colorCache.get(key);
    if (result) return result;
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(0, (num >> 16) - amt);
    const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
    const B = Math.max(0, (num & 0x0000FF) - amt);
    result = `rgb(${R},${G},${B})`;
    this._colorCache.set(key, result);
    return result;
  },

  // 텍스트 (오답등록 버튼과 동일한 폰트, 캐시 적용)
  drawText(text, x, y, options = {}) {
    const {
      font = '14px',
      color = COLORS.TEXT_PRIMARY,
      align = 'left',
      baseline = 'top',
      stroke = false
    } = options;

    // 폰트 문자열 캐시: 정규식 파싱 결과를 Map에 저장
    let resolved = this._fontCache.get(font);
    if (!resolved) {
      const match = font.match(/(bold\s+)?(\d+)px/i);
      const weight = match && match[1] ? 'bold ' : '';
      const size = match ? match[2] : '14';
      resolved = `${weight}${size}px Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      this._fontCache.set(font, resolved);
    }
    // ctx.font 할당 스킵: 이전 프레임과 동일하면 생략
    if (this._lastFont !== resolved) {
      this.ctx.font = resolved;
      this._lastFont = resolved;
    }
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;

    if (stroke) {
      this.ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      this.ctx.lineWidth = 3;
      this.ctx.lineJoin = 'round';
      this.ctx.strokeText(text, x, y);
    }

    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
  },

  // 버튼 (선명한 텍스트)
  drawButton(x, y, w, h, text, options = {}) {
    const {
      bgColor = COLORS.ACCENT,
      textColor = COLORS.TEXT_PRIMARY,
      borderColor = null,
      fontSize = 16,
      stroke = false
    } = options;

    this.roundRect(x, y, w, h, 12, bgColor, borderColor);
    this.drawText(text, x + w / 2, y + h / 2, {
      font: `bold ${fontSize}px system-ui`,
      color: textColor,
      align: 'center',
      baseline: 'middle',
      stroke
    });
  },

  // 이미지
  drawImage(img, x, y, w, h) {
    if (img && img.complete) {
      this.ctx.drawImage(img, x, y, w, h);
    }
  },

  // 그래디언트 카드 배경
  drawGradientCard(x, y, w, h, r, colorTop, colorBottom) {
    const gradient = this.ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, colorTop);
    gradient.addColorStop(1, colorBottom);
    this.roundRect(x, y, w, h, r, gradient);
  },

  // 현재 테마 ID 반환
  getCurrentBgThemeId() {
    return this._bgTheme?.id || 'default';
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
