// 오답헌터 - 메인 진입점
import { Database } from './data/Database.js';
import { Game } from './game/Game.js';
import { Renderer } from './canvas/Renderer.js';
import { GAME_CONFIG, SCREENS } from './utils/constants.js';
import './style.css';

class App {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.db = null;
    this.game = null;
    this.registerBtn = null;
    this.cameraInput = null;
    this.cameraModal = null;
    this.cameraVideo = null;
    this.captureCanvas = null;
    this.mediaStream = null;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  async init() {
    console.log('🎮 오답헌터 초기화 중...');

    // Canvas 초기화
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });

    // 텍스트 선명하게 렌더링
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = 'high';
    this.ctx.textRendering = 'optimizeLegibility';

    this.setupCanvas();

    // iOS 호환 버튼 초기화
    this.registerBtn = document.getElementById('register-btn');
    this.cameraInput = document.getElementById('camera-input');
    this.setupCameraInput();

    // 렌더러 초기화
    Renderer.init(this.ctx, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

    // 로딩 화면
    this.showLoading();

    // IndexedDB 초기화
    this.db = new Database();
    await this.db.open();

    // 게임 초기화
    this.game = new Game(this.db);
    await this.game.init();

    // 이벤트 리스너
    this.setupEvents();

    // 게임 루프 시작
    this.gameLoop();

    console.log('🎮 오답헌터 시작!');
  }

  // 카메라 설정 (iOS/Android 분기)
  setupCameraInput() {
    // 카메라 모달 요소
    this.cameraModal = document.getElementById('camera-modal');
    this.cameraVideo = document.getElementById('camera-video');
    this.captureCanvas = document.getElementById('capture-canvas');

    // iOS: 파일 입력 사용
    this.cameraInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          this.game.pendingImage = reader.result;
          this.game.previewImg = null;
          this.game.previewImageLoaded = false;
          // 과목 선택 없이 바로 수학으로 등록
          this.game.completeRegister('math');
        };
        reader.readAsDataURL(file);
      }
      this.cameraInput.value = '';
    });

    // 오답등록 버튼 클릭
    this.registerBtn.addEventListener('click', () => {
      if (this.isIOS) {
        // iOS: 파일 입력 트리거
        this.cameraInput.click();
      } else {
        // Android: 카메라 직접 열기
        this.openCamera();
      }
    });

    // 촬영 버튼
    document.getElementById('camera-capture').addEventListener('click', () => {
      this.capturePhoto();
    });

    // 닫기 버튼
    document.getElementById('camera-close').addEventListener('click', () => {
      this.closeCamera();
    });
  }

  // Android: 카메라 열기
  async openCamera() {
    try {
      // 모달 먼저 표시
      this.cameraModal.style.display = 'flex';

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this.cameraVideo.srcObject = this.mediaStream;

      // 비디오 재생 대기
      await this.cameraVideo.play();

    } catch (err) {
      console.error('카메라 오류:', err);
      this.cameraModal.style.display = 'none';
      alert('카메라를 열 수 없습니다: ' + err.message);
    }
  }

  // 사진 촬영
  capturePhoto() {
    const video = this.cameraVideo;
    const canvas = this.captureCanvas;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    this.game.pendingImage = imageData;
    this.game.previewImg = null;
    this.game.previewImageLoaded = false;

    this.closeCamera();

    // 과목 선택 없이 바로 수학으로 등록
    this.game.completeRegister('math');
  }

  // 카메라 닫기
  closeCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
    this.cameraModal.style.display = 'none';
  }

  setupCanvas() {
    this.canvas.width = GAME_CONFIG.CANVAS_WIDTH;
    this.canvas.height = GAME_CONFIG.CANVAS_HEIGHT;
    this.resizeCanvas();
  }

  resizeCanvas() {
    const container = document.getElementById('game-container');
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const gameRatio = GAME_CONFIG.CANVAS_WIDTH / GAME_CONFIG.CANVAS_HEIGHT;
    const containerRatio = containerWidth / containerHeight;

    let displayWidth, displayHeight;

    if (containerRatio > gameRatio) {
      // 높이에 맞춤
      displayHeight = containerHeight;
      displayWidth = displayHeight * gameRatio;
    } else {
      // 너비에 맞춤
      displayWidth = containerWidth;
      displayHeight = displayWidth / gameRatio;
    }

    this.canvas.style.width = `${displayWidth}px`;
    this.canvas.style.height = `${displayHeight}px`;

    // 버튼 위치 조정
    this.updateButtonPosition(displayWidth, displayHeight);
  }

  // 오답등록 버튼 위치 업데이트
  updateButtonPosition(displayWidth, displayHeight) {
    if (!this.registerBtn) return;

    const scale = displayWidth / GAME_CONFIG.CANVAS_WIDTH;

    // 캔버스 내 버튼 위치 (Game.js의 renderMainScreen 기준)
    const btnX = 80;
    const btnY = 420;
    const btnW = 240;
    const btnH = 60;

    // 캔버스 위치 계산
    const rect = this.canvas.getBoundingClientRect();

    this.registerBtn.style.left = `${rect.left + btnX * scale}px`;
    this.registerBtn.style.top = `${rect.top + btnY * scale}px`;
    this.registerBtn.style.width = `${btnW * scale}px`;
    this.registerBtn.style.height = `${btnH * scale}px`;
    this.registerBtn.style.fontSize = `${18 * scale}px`;
    this.registerBtn.style.lineHeight = `${btnH * scale}px`;
    this.registerBtn.style.padding = '0';
  }

  setupEvents() {
    // 리사이즈
    window.addEventListener('resize', () => this.resizeCanvas());

    // 클릭
    this.canvas.addEventListener('click', (e) => this.handleInput(e));

    // 터치
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleInput(e.touches[0]);
    }, { passive: false });

    // 터치 이동 방지
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
    }, { passive: false });
  }

  handleInput(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    this.game.handleInput(x, y);
  }

  showLoading() {
    Renderer.clear();
    Renderer.drawText('로딩 중...', 200, 350, {
      font: 'bold 24px system-ui',
      color: '#6366f1',
      align: 'center'
    });
  }

  gameLoop() {
    this.game.update();
    this.game.render();

    // 메인 화면에서만 오답등록 버튼 표시
    if (this.registerBtn) {
      if (this.game.currentScreen === SCREENS.MAIN) {
        this.registerBtn.classList.add('visible');
        // 위치 재조정 (y: 385~445)
        const rect = this.canvas.getBoundingClientRect();
        const scale = rect.width / GAME_CONFIG.CANVAS_WIDTH;
        this.registerBtn.style.left = `${rect.left + 20 * scale}px`;
        this.registerBtn.style.top = `${rect.top + 385 * scale}px`;
        this.registerBtn.style.width = `${360 * scale}px`;
        this.registerBtn.style.height = `${60 * scale}px`;
        this.registerBtn.style.fontSize = `${18 * scale}px`;
      } else {
        this.registerBtn.classList.remove('visible');
      }
    }

    requestAnimationFrame(() => this.gameLoop());
  }
}

// 앱 시작 (폰트 로드 후)
const app = new App();
window.addEventListener('DOMContentLoaded', async () => {
  // 폰트 로드 대기
  await document.fonts.ready;
  app.init();
});
