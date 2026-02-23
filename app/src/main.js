// 오답헌터 - 메인 진입점
import { Database } from './data/Database.js';
import { Game } from './game/Game.js';
import { Renderer } from './canvas/Renderer.js';
import { GAME_CONFIG, SCREENS } from './utils/constants.js';
import { apiService } from './services/ApiService.js';
import { geminiService } from './services/GeminiService.js';
import { imageAnalysisService } from './services/ImageAnalysisService.js';
import { t, applyToHTML } from './i18n/i18n.js';
import { safeGetItem, safeSetItem, safeRemoveItem, secureGetItem, secureSetItem, secureRemoveItem } from './utils/storage.js';
import './style.css';

const API_URL = 'https://study-api.blueskyman1012.workers.dev';

class App {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.db = null;
    this.game = null;
    this.registerBtn = null;
    this.problemViewerBtn = null;
    this.cameraInput = null;
    this.cameraModal = null;
    this.cameraVideo = null;
    this.captureCanvas = null;
    this.mediaStream = null;
    this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    this.sessionToken = null;
    this.currentUser = null;
    this.lastSyncTime = 0;
    this._animFrameId = null;
    this._eventsSetup = false;
  }

  async init() {
    // 로그아웃 버튼 (항상 등록)
    document.getElementById('logout-btn').addEventListener('click', () => this.logout());

    // localStorage→sessionStorage 마이그레이션 (1회성)
    this._migrateSensitiveKeys();

    // 기존 세션 확인
    this.sessionToken = secureGetItem('session_token');
    if (this.sessionToken) {
      const valid = await this.verifySession();
      if (valid) {
        this.showGame();
        return;
      }
      // 토큰 만료 → 다시 로그인
      secureRemoveItem('session_token');
      this.sessionToken = null;
    }

    // Google 로그인 화면 표시
    this.initGoogleLogin();
  }

  _migrateSensitiveKeys() {
    const sensitiveKeys = ['session_token', 'gemini_api_key', 'smileprint_api_key'];
    for (const key of sensitiveKeys) {
      const val = safeGetItem(key);
      if (val) {
        secureSetItem(key, val);
        safeRemoveItem(key);
      }
    }
  }

  initGoogleLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('game-container').style.display = 'none';

    // Google Identity Services 초기화
    if (typeof google !== 'undefined' && google.accounts) {
      this.renderGoogleButton();
    } else {
      // GIS 스크립트 로드 대기
      const checkGoogle = setInterval(() => {
        if (typeof google !== 'undefined' && google.accounts) {
          clearInterval(checkGoogle);
          this.renderGoogleButton();
        }
      }, 100);
      // 5초 타임아웃
      setTimeout(() => {
        clearInterval(checkGoogle);
        if (typeof google === 'undefined') {
          document.getElementById('login-status').textContent = t('googleLoadFailed');
        }
      }, 5000);
    }

  }

  renderGoogleButton() {
    google.accounts.id.initialize({
      client_id: '907312801581-6ddqujogiq9sanjd18ah9vs7pr5vmuo3.apps.googleusercontent.com',
      callback: (response) => this.handleGoogleLogin(response)
    });

    google.accounts.id.renderButton(
      document.getElementById('google-login-btn'),
      { theme: 'outline', size: 'large', text: 'signin_with', locale: 'ko', width: 280 }
    );
  }

  async handleGoogleLogin(response) {
    document.getElementById('login-status').textContent = t('loggingIn');
    try {
      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: response.credential })
      });

      const data = await res.json();
      if (data.success) {
        this.sessionToken = data.sessionToken;
        this.currentUser = data.user;
        secureSetItem('session_token', data.sessionToken);
        safeSetItem('user_name', data.user.name);
        safeSetItem('user_picture', data.user.picture);
        apiService.setToken(data.sessionToken);
        this.showGame();
      } else {
        document.getElementById('login-status').textContent = data.error || t('loginFailed');
      }
    } catch (err) {
      console.error('로그인 오류:', err);
      document.getElementById('login-status').textContent = t('serverError');
    }
  }

  async verifySession() {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${this.sessionToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        apiService.setToken(this.sessionToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  logout() {
    // gameLoop 중지
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    this.sessionToken = null;
    this.currentUser = null;
    apiService.setToken(null);
    secureRemoveItem('session_token');
    safeRemoveItem('user_name');
    safeRemoveItem('user_picture');
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('game-container').style.display = 'none';
    document.getElementById('login-status').textContent = '';
    // Google 로그인 버튼 다시 렌더링
    if (typeof google !== 'undefined' && google.accounts) {
      this.renderGoogleButton();
    }
  }

  async showGame() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';

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
    this.problemViewerBtn = document.getElementById('problem-viewer-btn');
    this.cameraInput = document.getElementById('camera-input');
    this.setupCameraInput();
    this.setupProblemViewerBtn();

    // 렌더러 초기화
    Renderer.init(this.ctx, GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);

    // 로딩 화면
    this.showLoading();

    // IndexedDB 초기화 (로컬 캐시용으로 유지)
    this.db = new Database();
    await this.db.open();

    // 로그인 상태면 서버에서 데이터 다운로드
    if (apiService.isLoggedIn()) {
      try {
        await apiService.uploadMonsters(this.db);

        const [,,,keys] = await Promise.all([
          apiService.downloadPlayerData(this.db),
          apiService.downloadMonsters(this.db),
          apiService.downloadRuns(this.db),
          apiService.downloadKeys()
        ]);
        if (keys) {
          if (keys.smileprint_api_key) {
            imageAnalysisService.apiKey = keys.smileprint_api_key;
            secureSetItem('smileprint_api_key', keys.smileprint_api_key);
          }
          if (keys.gemini_api_key) {
            geminiService.apiKey = keys.gemini_api_key;
            secureSetItem('gemini_api_key', keys.gemini_api_key);
          }
        }
      } catch (err) {
        console.warn('서버 동기화 실패, 로컬 데이터 사용:', err.message);
      }
    }

    // 게임 초기화
    this.game = new Game(this.db);
    await this.game.init();

    // 이벤트 리스너
    this.setupEvents();

    // 버튼 레이아웃 캐싱 (resize 리스너는 setupEvents 내에서 등록)
    this._logoutBtn = document.getElementById('logout-btn');
    this._updateButtonLayout();

    // 이전 gameLoop가 있으면 중지 후 재시작
    if (this._animFrameId) {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
    this.gameLoop();

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
      this.game.showModal(t('cameraError') + err.message);
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

  // 문제 보기 버튼 설정
  setupProblemViewerBtn() {
    if (!this.problemViewerBtn) return;
    this.problemViewerBtn.addEventListener('click', () => {
      if (this.game) {
        this.game.showProblemViewer().catch(err => {
          this.game.showModal('오류: ' + err.message);
        });
      }
    });
  }

  setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = GAME_CONFIG.CANVAS_WIDTH * dpr;
    this.canvas.height = GAME_CONFIG.CANVAS_HEIGHT * dpr;
    this.ctx.scale(dpr, dpr);
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
    // 이미 등록되었으면 중복 등록 방지
    if (this._eventsSetup) return;
    this._eventsSetup = true;

    // 리사이즈 (버튼 레이아웃 업데이트도 통합)
    window.addEventListener('resize', () => {
      this.resizeCanvas();
      this._updateButtonLayout();
    });

    // 클릭 (터치 직후 발생하는 click은 무시)
    this.canvas.addEventListener('click', (e) => {
      if (this._touchHandled) return;
      this.handleInput(e);
    });

    // 마우스 드래그 (데스크탑 슬라이더)
    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = GAME_CONFIG.CANVAS_WIDTH / rect.width;
      const scaleY = GAME_CONFIG.CANVAS_HEIGHT / rect.height;
      const canvasX = (e.clientX - rect.left) * scaleX;
      const canvasY = (e.clientY - rect.top) * scaleY;
      this.game.handleTouchStart(canvasX, canvasY);
      if (this.game._dragging) {
        this._mouseDragging = true;
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!this._mouseDragging) return;
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = GAME_CONFIG.CANVAS_WIDTH / rect.width;
      const canvasX = (e.clientX - rect.left) * scaleX;
      this.game.handleTouchMove(canvasX, 0);
    });
    window.addEventListener('mouseup', () => {
      if (!this._mouseDragging) return;
      this._mouseDragging = false;
      this.game.handleTouchEnd();
    });

    // 터치
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = GAME_CONFIG.CANVAS_WIDTH / rect.width;
      const scaleY = GAME_CONFIG.CANVAS_HEIGHT / rect.height;
      const canvasX = (touch.clientX - rect.left) * scaleX;
      const canvasY = (touch.clientY - rect.top) * scaleY;
      this.game.handleTouchStart(canvasX, canvasY);
      this._pendingTouch = touch;
    }, { passive: false });

    // 터치 이동 (스크롤/드래그)
    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = GAME_CONFIG.CANVAS_WIDTH / rect.width;
      const scaleY = GAME_CONFIG.CANVAS_HEIGHT / rect.height;
      const canvasX = (touch.clientX - rect.left) * scaleX;
      const canvasY = (touch.clientY - rect.top) * scaleY;
      this.game.handleTouchMove(canvasX, canvasY);
    }, { passive: false });

    // 터치 종료
    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      const wasDragging = !!this.game._dragging;
      if (this._pendingTouch && !this.game._isTouchScrolling && !wasDragging) {
        this.handleInput(this._pendingTouch);
      }
      this.game.handleTouchEnd();
      this._pendingTouch = null;
      // 터치 후 click 이벤트 억제
      this._touchHandled = true;
      setTimeout(() => { this._touchHandled = false; }, 300);
    }, { passive: false });

    // 탭 복귀 시 자동 동기화
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.syncFromServer();
      }
    });

    // 마우스 휠 스크롤
    this.canvas.addEventListener('wheel', (e) => {
      if (this.game.scrollMaxY > 0) {
        e.preventDefault();
        this.game.scrollY = Math.max(0, Math.min(this.game.scrollMaxY, this.game.scrollY + e.deltaY * 0.5));
        this.game.render();
      }
    }, { passive: false });

    // 방향키 스크롤
    document.addEventListener('keydown', (e) => {
      if (this.game.scrollMaxY > 0) {
        const step = 40;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.game.scrollY = Math.min(this.game.scrollMaxY, this.game.scrollY + step);
          this.game.render();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.game.scrollY = Math.max(0, this.game.scrollY - step);
          this.game.render();
        }
      }
    });

    // Android 뒤로가기 (popstate)
    history.pushState(null, '', location.href);
    window.addEventListener('popstate', () => {
      history.pushState(null, '', location.href);
      const screen = this.game.currentScreen;
      if (screen !== SCREENS.MAIN) {
        this.game.changeScreen(SCREENS.MAIN);
      }
    });
  }

  async syncFromServer() {
    if (!apiService.isLoggedIn()) return;
    if (this.game && this.game.currentScreen === SCREENS.BATTLE) return;
    if (Date.now() - this.lastSyncTime < 30000) return;
    if (this._syncing) return;

    this._syncing = true;
    try {
      await apiService.downloadPlayerData(this.db);
      await apiService.downloadMonsters(this.db);
      await apiService.downloadRuns(this.db);
      await this.game.playerManager.loadPlayer();
      await this.game.monsterManager.loadMonsters();
      this.lastSyncTime = Date.now();
      this.game.render();
    } catch (err) {
      console.warn('탭 복귀 동기화 실패:', err.message);
    } finally {
      this._syncing = false;
    }
  }

  handleInput(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = GAME_CONFIG.CANVAS_WIDTH / rect.width;
    const scaleY = GAME_CONFIG.CANVAS_HEIGHT / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    this.game.handleInput(x, y);
  }

  showLoading() {
    Renderer.clear();
    Renderer.drawText(t('loading'), 200, 350, {
      font: 'bold 24px system-ui',
      color: '#6366f1',
      align: 'center'
    });
  }

  _updateButtonLayout() {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    this._cachedRect = rect;
    this._cachedScale = rect.width / GAME_CONFIG.CANVAS_WIDTH;
  }

  _updateHTMLButtons() {
    const isMain = this.game.currentScreen === SCREENS.MAIN && this.game.guideStep === null && !this.game.isGenerating;

    // 캔버스 rect 갱신 (스크롤/리사이즈 대응)
    if (!this._cachedRect && this.canvas) {
      this._updateButtonLayout();
    }

    // 오답등록 버튼
    if (this.registerBtn) {
      if (isMain) {
        this.registerBtn.classList.add('visible');
        if (this._cachedRect) {
          const s = this._cachedScale;
          const r = this._cachedRect;
          this.registerBtn.style.left = `${r.left + 20 * s}px`;
          this.registerBtn.style.top = `${r.top + 390 * s}px`;
          this.registerBtn.style.width = `${360 * s}px`;
          this.registerBtn.style.height = `${65 * s}px`;
          this.registerBtn.style.fontSize = `${20 * s}px`;
        }
      } else {
        this.registerBtn.classList.remove('visible');
      }
    }

    // 문제 보기 버튼 (오답등록 바로 아래)
    if (this.problemViewerBtn) {
      if (isMain) {
        this.problemViewerBtn.classList.add('visible');
        if (this._cachedRect) {
          const s = this._cachedScale;
          const r = this._cachedRect;
          this.problemViewerBtn.style.left = `${r.left + 20 * s}px`;
          this.problemViewerBtn.style.top = `${r.top + 462 * s}px`;
          this.problemViewerBtn.style.width = `${360 * s}px`;
          this.problemViewerBtn.style.height = `${55 * s}px`;
          this.problemViewerBtn.style.fontSize = `${18 * s}px`;
        }
      } else {
        this.problemViewerBtn.classList.remove('visible');
      }
    }

    // 로그아웃 버튼
    if (this._logoutBtn) {
      this._logoutBtn.style.display = isMain ? '' : 'none';
    }
  }

  gameLoop() {
    this.game.update();

    // HTML 버튼 표시/숨김은 매 프레임 처리 (early return 전에 실행)
    this._updateHTMLButtons();

    if (!this.game._needsRender) {
      this._animFrameId = requestAnimationFrame(() => this.gameLoop());
      return;
    }
    this.game._needsRender = false;
    this.game.render();

    this._animFrameId = requestAnimationFrame(() => this.gameLoop());
  }
}

// 앱 시작 (폰트 로드 후)
const app = new App();

window.addEventListener('DOMContentLoaded', async () => {
  applyToHTML();
  await document.fonts.ready;
  app.init();
});
