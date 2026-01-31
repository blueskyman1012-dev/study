// 테스트 환경 설정
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Canvas mock
class CanvasRenderingContext2D {
  constructor() {
    this.fillStyle = '';
    this.strokeStyle = '';
    this.lineWidth = 1;
    this.font = '';
    this.textAlign = 'left';
    this.textBaseline = 'top';
  }

  fillRect() {}
  strokeRect() {}
  clearRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  arcTo() {}
  fill() {}
  stroke() {}
  fillText() {}
  strokeText() {}
  measureText(text) {
    return { width: text.length * 10 };
  }
  drawImage() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
}

// HTMLCanvasElement mock
HTMLCanvasElement.prototype.getContext = function(type) {
  if (type === '2d') {
    return new CanvasRenderingContext2D();
  }
  return null;
};

// requestAnimationFrame mock
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id));

// localStorage mock
const localStorageMock = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = value;
  },
  removeItem(key) {
    delete this.store[key];
  },
  clear() {
    this.store = {};
  }
};
global.localStorage = localStorageMock;

// Console 에러 억제 (테스트 중 불필요한 로그 방지)
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'warn').mockImplementation(() => {});
