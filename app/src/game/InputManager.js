// 입력 관리 (클릭 영역, 터치 스크롤, 드래그)
import { SCREENS } from '../utils/constants.js';
import { SoundService } from '../services/SoundService.js';

export class InputManager {
  constructor(game) {
    this.game = game;
    this.clickAreas = [];
    this.scrollY = 0;
    this.scrollMaxY = 0;
    this._touchStartY = null;
    this._touchLastY = null;
    this._isTouchScrolling = false;
    this._dragging = null;
    this._lastInputTime = 0;
    this._bgmInitiated = false;
  }

  registerClickArea(id, x, y, width, height, callback) {
    this.clickAreas.push({ id, x, y, width, height, callback });
  }

  registerDragArea(id, x, y, width, height, handler) {
    this.clickAreas.push({ id, x, y, width, height, callback: handler, draggable: true });
  }

  clearClickAreas() {
    this.clickAreas = [];
  }

  _getFixedHeaderHeight() {
    if (this.game.currentScreen === SCREENS.SHOP) return 86;
    return 60;
  }

  handleInput(x, y) {
    if (this._isTouchScrolling) return;

    // isGenerating 중에는 취소 버튼만 허용
    if (this.game.isGenerating) {
      for (const area of this.clickAreas) {
        if (area.id === 'cancelGeneration' &&
            x >= area.x && x <= area.x + area.width &&
            y >= area.y && y <= area.y + area.height) {
          area.callback(x, y);
          return;
        }
      }
      return;
    }

    const now = Date.now();
    // 모달 닫힌 직후 고스트 클릭 방지 (400ms 쿨다운)
    const dm = this.game.dialogManager;
    if (dm && dm._lastDismissTime && now - dm._lastDismissTime < 400) return;

    if (this._lastInputTime && now - this._lastInputTime < 200) return;
    this._lastInputTime = now;

    if (this.game.guideStep !== null) {
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

    if (this.game.effects.isLevelUpActive()) {
      this.game.effects.dismissLevelUp();
      return;
    }

    if (!this._bgmInitiated) {
      this._bgmInitiated = true;
      SoundService.init();
      if (this.game.currentScreen === SCREENS.MAIN) {
        SoundService.startLobbyBgm();
      }
    }

    const fixedH = this._getFixedHeaderHeight();
    const adjustedY = (this.scrollMaxY > 0 && y >= fixedH) ? y + this.scrollY : y;

    for (const area of this.clickAreas) {
      if (x >= area.x && x <= area.x + area.width &&
          adjustedY >= area.y && adjustedY <= area.y + area.height) {
        this.game._needsRender = true;
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

  handleTouchStart(canvasX, canvasY) {
    const fixedH = this._getFixedHeaderHeight();
    const adjustedY = (this.scrollMaxY > 0 && canvasY >= fixedH) ? canvasY + this.scrollY : canvasY;
    for (const area of this.clickAreas) {
      if (area.draggable && canvasX >= area.x && canvasX <= area.x + area.width &&
          adjustedY >= area.y && adjustedY <= area.y + area.height) {
        this._dragging = { id: area.id, handler: area.callback };
        area.callback(canvasX, adjustedY);
        this.game._needsRender = true;
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
      this.game.render();
      return;
    }
    if (this._touchLastY === null || this.scrollMaxY <= 0) return;
    const delta = this._touchLastY - canvasY;
    this._touchLastY = canvasY;

    if (Math.abs(canvasY - this._touchStartY) > 15) {
      this._isTouchScrolling = true;
    }

    if (this._isTouchScrolling) {
      this.scrollY = Math.max(0, Math.min(this.scrollMaxY, this.scrollY + delta));
      this.game._needsRender = true;
    }
  }

  handleTouchEnd() {
    if (this._dragging) {
      this._dragging = null;
      return;
    }
    this._touchStartY = null;
    this._touchLastY = null;
    setTimeout(() => { this._isTouchScrolling = false; }, 50);
  }
}
