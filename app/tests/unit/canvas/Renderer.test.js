// Renderer.js 단위 테스트
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Renderer } from '../../../src/canvas/Renderer.js';
import { COLORS } from '../../../src/utils/constants.js';

describe('Renderer', () => {
  let mockCtx;

  beforeEach(() => {
    mockCtx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      font: '',
      textAlign: 'left',
      textBaseline: 'top',
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn(() => ({ width: 100 })),
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn()
    };

    Renderer.init(mockCtx, 400, 700);
  });

  describe('초기화', () => {
    it('RND-INIT-001: 렌더러가 올바르게 초기화되어야 한다', () => {
      expect(Renderer.ctx).toBe(mockCtx);
      expect(Renderer.width).toBe(400);
      expect(Renderer.height).toBe(700);
    });

    it('RND-INIT-002: 다른 크기로 재초기화할 수 있어야 한다', () => {
      Renderer.init(mockCtx, 800, 600);
      expect(Renderer.width).toBe(800);
      expect(Renderer.height).toBe(600);
    });
  });

  describe('화면 클리어', () => {
    it('RND-CLR-001: clear()가 배경색으로 전체 화면을 채워야 한다', () => {
      Renderer.clear();

      expect(mockCtx.fillStyle).toBe(COLORS.BG_PRIMARY);
      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 400, 700);
    });
  });

  describe('그리드 패턴', () => {
    it('RND-GRID-001: drawGrid()가 그리드 라인을 그려야 한다', () => {
      Renderer.drawGrid();

      // 40px 간격으로 그리드 라인
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('RND-GRID-002: 그리드 스타일이 올바르게 설정되어야 한다', () => {
      Renderer.drawGrid();

      expect(mockCtx.strokeStyle).toBe('rgba(99, 102, 241, 0.05)');
      expect(mockCtx.lineWidth).toBe(1);
    });
  });

  describe('둥근 사각형', () => {
    it('RND-RECT-001: roundRect()이 채우기만 할 수 있어야 한다', () => {
      Renderer.roundRect(10, 20, 100, 50, 8, '#FF0000', null);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arcTo).toHaveBeenCalled();
      expect(mockCtx.closePath).toHaveBeenCalled();
      expect(mockCtx.fillStyle).toBe('#FF0000');
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('RND-RECT-002: roundRect()이 테두리만 그릴 수 있어야 한다', () => {
      Renderer.roundRect(10, 20, 100, 50, 8, null, '#00FF00');

      expect(mockCtx.strokeStyle).toBe('#00FF00');
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('RND-RECT-003: roundRect()이 채우기와 테두리를 함께 그릴 수 있어야 한다', () => {
      Renderer.roundRect(10, 20, 100, 50, 8, '#FF0000', '#00FF00');

      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });

  describe('HP 바', () => {
    it('RND-HP-001: drawHPBar()가 배경과 현재 HP를 그려야 한다', () => {
      Renderer.drawHPBar(10, 20, 100, 10, 50, 100);

      // 배경과 현재 HP 바를 위해 최소 2번 호출
      expect(mockCtx.beginPath.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('RND-HP-002: HP가 0일 때 현재 HP 바가 그려지지 않아야 한다', () => {
      const fillCalls = mockCtx.fill.mock.calls.length;
      Renderer.drawHPBar(10, 20, 100, 10, 0, 100);

      // 배경만 그려짐 (1회)
      expect(mockCtx.fill.mock.calls.length - fillCalls).toBe(1);
    });

    it('RND-HP-003: HP가 최대값을 초과해도 100%로 제한되어야 한다', () => {
      Renderer.drawHPBar(10, 20, 100, 10, 150, 100);
      // ratio가 1로 제한되어야 함
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('RND-HP-004: 커스텀 색상을 사용할 수 있어야 한다', () => {
      Renderer.drawHPBar(10, 20, 100, 10, 50, 100, '#FF0000');
      expect(mockCtx.fillStyle).toBe('#FF0000');
    });
  });

  describe('텍스트', () => {
    it('RND-TXT-001: drawText()가 기본 옵션으로 텍스트를 그려야 한다', () => {
      Renderer.drawText('테스트', 100, 200);

      expect(mockCtx.font).toBe('14px system-ui');
      expect(mockCtx.fillStyle).toBe(COLORS.TEXT_PRIMARY);
      expect(mockCtx.textAlign).toBe('left');
      expect(mockCtx.textBaseline).toBe('top');
      expect(mockCtx.fillText).toHaveBeenCalledWith('테스트', 100, 200);
    });

    it('RND-TXT-002: drawText()가 커스텀 옵션을 적용해야 한다', () => {
      Renderer.drawText('커스텀', 50, 100, {
        font: 'bold 20px Arial',
        color: '#FF0000',
        align: 'center',
        baseline: 'middle'
      });

      expect(mockCtx.font).toBe('bold 20px Arial');
      expect(mockCtx.fillStyle).toBe('#FF0000');
      expect(mockCtx.textAlign).toBe('center');
      expect(mockCtx.textBaseline).toBe('middle');
    });
  });

  describe('버튼', () => {
    it('RND-BTN-001: drawButton()이 배경과 텍스트를 그려야 한다', () => {
      Renderer.drawButton(50, 100, 120, 40, '시작');

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('시작', 110, 120);
    });

    it('RND-BTN-002: drawButton()이 커스텀 스타일을 적용해야 한다', () => {
      Renderer.drawButton(50, 100, 120, 40, '버튼', {
        bgColor: '#FF0000',
        textColor: '#FFFFFF',
        borderColor: '#000000',
        fontSize: 20
      });

      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });

  describe('이미지', () => {
    it('RND-IMG-001: drawImage()가 로드된 이미지를 그려야 한다', () => {
      const mockImg = { complete: true };
      Renderer.drawImage(mockImg, 10, 20, 100, 100);

      expect(mockCtx.drawImage).toHaveBeenCalledWith(mockImg, 10, 20, 100, 100);
    });

    it('RND-IMG-002: drawImage()가 로드되지 않은 이미지는 무시해야 한다', () => {
      const mockImg = { complete: false };
      Renderer.drawImage(mockImg, 10, 20, 100, 100);

      expect(mockCtx.drawImage).not.toHaveBeenCalled();
    });

    it('RND-IMG-003: drawImage()가 null 이미지를 안전하게 처리해야 한다', () => {
      Renderer.drawImage(null, 10, 20, 100, 100);

      expect(mockCtx.drawImage).not.toHaveBeenCalled();
    });
  });

  describe('원', () => {
    it('RND-CIR-001: drawCircle()이 채워진 원을 그려야 한다', () => {
      Renderer.drawCircle(100, 100, 50, '#FF0000', null);

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.arc).toHaveBeenCalledWith(100, 100, 50, 0, Math.PI * 2);
      expect(mockCtx.fillStyle).toBe('#FF0000');
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('RND-CIR-002: drawCircle()이 테두리만 있는 원을 그려야 한다', () => {
      Renderer.drawCircle(100, 100, 50, null, '#00FF00');

      expect(mockCtx.strokeStyle).toBe('#00FF00');
      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });
});
