# 오답헌터 - 웹 개발 계획서 (Node.js 기반)

> HTML5 + Canvas + JavaScript + IndexedDB + Node.js

---

## 1. 기술 스택

### 1-1. 프론트엔드

| 구분 | 기술 | 용도 |
|------|------|------|
| 마크업 | HTML5 | 구조 |
| 스타일 | CSS3 | UI, 애니메이션 |
| 로직 | JavaScript (ES6+) | 게임 로직 |
| 렌더링 | Canvas 2D | 게임 화면 |
| 저장 | IndexedDB | 로컬 데이터 |

### 1-2. 백엔드 / 개발환경

| 구분 | 기술 | 용도 |
|------|------|------|
| 런타임 | Node.js | 서버, 빌드 |
| 패키지 관리 | npm | 의존성 관리 |
| 개발 서버 | Vite | HMR, 빠른 개발 |
| API 서버 | Express.js | AI API 프록시 (향후) |
| 번들러 | Vite (esbuild) | 프로덕션 빌드 |

### 1-3. 향후 확장

| 구분 | 기술 | 용도 |
|------|------|------|
| AI API | OpenAI / Claude | 문제 생성, 힌트 |
| 실시간 | Socket.io | 랭킹, 알림 (선택) |
| 배포 | Vercel / Netlify | 정적 호스팅 |

---

## 2. 프로젝트 구조

### 2-1. 폴더 구조

```
app/
├── package.json            # 프로젝트 설정
├── vite.config.js          # Vite 설정
├── .gitignore
│
├── index.html              # 메인 HTML
├── manifest.json           # PWA 매니페스트
│
├── src/                    # 소스 코드
│   ├── main.js             # 앱 진입점
│   ├── style.css           # 메인 스타일
│   │
│   ├── game/               # 게임 로직
│   │   ├── Game.js         # 게임 메인 클래스
│   │   ├── Battle.js       # 전투 시스템
│   │   ├── Monster.js      # 몬스터 클래스
│   │   ├── Player.js       # 플레이어 클래스
│   │   └── Dungeon.js      # 던전 시스템
│   │
│   ├── ui/                 # UI 컴포넌트
│   │   ├── screens/        # 화면별 UI
│   │   │   ├── MainScreen.js
│   │   │   ├── BattleScreen.js
│   │   │   ├── ResultScreen.js
│   │   │   └── ShopScreen.js
│   │   ├── components/     # 공통 컴포넌트
│   │   │   ├── Button.js
│   │   │   ├── Modal.js
│   │   │   └── Toast.js
│   │   └── HUD.js          # 게임 내 UI
│   │
│   ├── canvas/             # 렌더링
│   │   ├── Renderer.js     # 렌더링 엔진
│   │   ├── Sprite.js       # 스프라이트
│   │   └── Animation.js    # 애니메이션
│   │
│   ├── data/               # 데이터 관리
│   │   ├── Database.js     # IndexedDB 래퍼
│   │   ├── PlayerData.js   # 플레이어 데이터
│   │   └── GameConfig.js   # 게임 설정값
│   │
│   ├── services/           # 외부 서비스
│   │   ├── AIService.js    # AI API 호출
│   │   ├── Camera.js       # 카메라/이미지
│   │   └── Storage.js      # 저장/불러오기
│   │
│   └── utils/              # 유틸리티
│       ├── constants.js    # 상수
│       ├── helpers.js      # 헬퍼 함수
│       └── EventBus.js     # 이벤트 관리
│
├── public/                 # 정적 파일
│   ├── images/
│   │   ├── monsters/
│   │   ├── items/
│   │   └── ui/
│   ├── sounds/             # 사운드 (선택)
│   └── fonts/
│
├── server/                 # 백엔드 (향후)
│   ├── index.js            # Express 서버
│   ├── routes/
│   │   └── ai.js           # AI API 라우트
│   └── middleware/
│
└── scripts/                # 유틸리티 스크립트
    └── generate-icons.js   # 아이콘 생성
```

### 2-2. 간단 버전 (MVP)

```
app/
├── package.json
├── index.html
├── src/
│   ├── main.js
│   ├── style.css
│   ├── game.js         # 게임 로직 통합
│   ├── database.js     # IndexedDB
│   └── renderer.js     # Canvas 렌더링
└── public/
    └── images/
```

---

## 3. package.json 설정

### 3-1. 기본 설정

```json
{
  "name": "odap-hunter",
  "version": "1.0.0",
  "description": "오답헌터 - 로그라이크 학습 RPG",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "server": "node server/index.js"
  },
  "devDependencies": {
    "vite": "^5.0.0"
  },
  "dependencies": {}
}
```

### 3-2. 확장 버전 (AI 기능 포함)

```json
{
  "name": "odap-hunter",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "server": "node server/index.js",
    "server:dev": "nodemon server/index.js"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "nodemon": "^3.0.0"
  },
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "openai": "^4.0.0",
    "dotenv": "^16.0.0"
  }
}
```

---

## 4. Vite 설정

### 4-1. vite.config.js

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  base: './',
  publicDir: 'public',

  server: {
    port: 3000,
    open: true,
    proxy: {
      // AI API 프록시 (개발 시)
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  },

  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild'
  }
});
```

---

## 5. 핵심 모듈 (ES Modules)

### 5-1. 진입점 (main.js)

```javascript
// src/main.js
import { Database } from './data/Database.js';
import { Game } from './game/Game.js';
import { Renderer } from './canvas/Renderer.js';
import './style.css';

class App {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.db = null;
    this.game = null;
  }

  async init() {
    // Canvas 초기화
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.resizeCanvas();

    // 렌더러 초기화
    Renderer.init(this.ctx, this.canvas.width, this.canvas.height);

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

  resizeCanvas() {
    const container = document.getElementById('game-container');
    const ratio = Math.min(
      container.clientWidth / 400,
      container.clientHeight / 700
    );

    this.canvas.style.width = `${400 * ratio}px`;
    this.canvas.style.height = `${700 * ratio}px`;
    this.canvas.width = 400;
    this.canvas.height = 700;
  }

  setupEvents() {
    // 리사이즈
    window.addEventListener('resize', () => this.resizeCanvas());

    // 클릭/터치
    this.canvas.addEventListener('click', (e) => this.handleInput(e));
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleInput(e.touches[0]);
    });
  }

  handleInput(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    this.game.handleInput(x, y);
  }

  gameLoop() {
    this.game.update();
    this.game.render();
    requestAnimationFrame(() => this.gameLoop());
  }
}

// 앱 시작
const app = new App();
window.addEventListener('DOMContentLoaded', () => app.init());
```

### 5-2. IndexedDB (Database.js)

```javascript
// src/data/Database.js
export class Database {
  constructor() {
    this.db = null;
    this.DB_NAME = 'OdapHunterDB';
    this.DB_VERSION = 1;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        this.createStores(db);
      };
    });
  }

  createStores(db) {
    // 플레이어
    if (!db.objectStoreNames.contains('player')) {
      db.createObjectStore('player', { keyPath: 'id' });
    }

    // 몬스터 (오답)
    if (!db.objectStoreNames.contains('monsters')) {
      const store = db.createObjectStore('monsters', {
        keyPath: 'id',
        autoIncrement: true
      });
      store.createIndex('subject', 'subject');
      store.createIndex('status', 'status');
      store.createIndex('createdAt', 'createdAt');
    }

    // 아이템
    if (!db.objectStoreNames.contains('items')) {
      db.createObjectStore('items', { keyPath: 'id' });
    }

    // 런 기록
    if (!db.objectStoreNames.contains('runs')) {
      const store = db.createObjectStore('runs', {
        keyPath: 'id',
        autoIncrement: true
      });
      store.createIndex('date', 'startTime');
    }

    // 설정
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }
  }

  // CRUD 메서드
  async add(storeName, data) {
    return this._transaction(storeName, 'readwrite', (store) => store.add(data));
  }

  async get(storeName, key) {
    return this._transaction(storeName, 'readonly', (store) => store.get(key));
  }

  async getAll(storeName) {
    return this._transaction(storeName, 'readonly', (store) => store.getAll());
  }

  async put(storeName, data) {
    return this._transaction(storeName, 'readwrite', (store) => store.put(data));
  }

  async delete(storeName, key) {
    return this._transaction(storeName, 'readwrite', (store) => store.delete(key));
  }

  async getByIndex(storeName, indexName, value) {
    return this._transaction(storeName, 'readonly', (store) => {
      const index = store.index(indexName);
      return index.getAll(value);
    });
  }

  // 트랜잭션 헬퍼
  _transaction(storeName, mode, callback) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const request = callback(store);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
```

### 5-3. 게임 클래스 (Game.js)

```javascript
// src/game/Game.js
import { Player } from './Player.js';
import { Battle } from './Battle.js';
import { Dungeon } from './Dungeon.js';
import { Renderer } from '../canvas/Renderer.js';
import { SCREENS, GAME_CONFIG } from '../utils/constants.js';

export class Game {
  constructor(db) {
    this.db = db;
    this.player = null;
    this.currentScreen = SCREENS.MAIN;
    this.battle = null;
    this.dungeon = null;
    this.clickAreas = [];
  }

  async init() {
    // 플레이어 데이터 로드
    await this.loadPlayer();
  }

  async loadPlayer() {
    let playerData = await this.db.get('player', 'main');

    if (!playerData) {
      playerData = this.createNewPlayer();
      await this.db.put('player', playerData);
    }

    this.player = new Player(playerData);
  }

  createNewPlayer() {
    return {
      id: 'main',
      level: 1,
      exp: 0,
      gold: 100,
      maxHp: 100,
      equippedItems: [],
      permanentUpgrades: {
        hp: 0,
        time: 0,
        goldBonus: 0
      },
      stats: {
        totalRuns: 0,
        totalKills: 0,
        bestCombo: 0
      },
      createdAt: Date.now()
    };
  }

  // 화면 전환
  changeScreen(screen) {
    this.currentScreen = screen;
    this.clearClickAreas();
  }

  // 던전 시작
  async startDungeon(dungeonType) {
    const monsters = await this.db.getByIndex('monsters', 'status', 'alive');

    if (monsters.length === 0) {
      this.showToast('등록된 오답이 없습니다!');
      return;
    }

    this.dungeon = new Dungeon(dungeonType, monsters);
    this.battle = new Battle(this.player, this.dungeon);
    this.changeScreen(SCREENS.BATTLE);
  }

  // 입력 처리
  handleInput(x, y) {
    for (const area of this.clickAreas) {
      if (x >= area.x && x <= area.x + area.width &&
          y >= area.y && y <= area.y + area.height) {
        area.callback();
        return;
      }
    }
  }

  // 클릭 영역 관리
  registerClickArea(id, x, y, width, height, callback) {
    this.clickAreas.push({ id, x, y, width, height, callback });
  }

  clearClickAreas() {
    this.clickAreas = [];
  }

  // 업데이트
  update() {
    if (this.currentScreen === SCREENS.BATTLE && this.battle) {
      this.battle.update();
    }
  }

  // 렌더링
  render() {
    Renderer.clear();

    switch (this.currentScreen) {
      case SCREENS.MAIN:
        this.renderMainScreen();
        break;
      case SCREENS.BATTLE:
        this.renderBattleScreen();
        break;
      case SCREENS.RESULT:
        this.renderResultScreen();
        break;
      case SCREENS.SHOP:
        this.renderShopScreen();
        break;
    }
  }

  renderMainScreen() {
    // 메인 화면 렌더링
    Renderer.drawGrid();

    // 플레이어 정보
    Renderer.drawText(`LV.${this.player.level}`, 200, 100, {
      font: 'bold 24px system-ui',
      align: 'center'
    });

    Renderer.drawText(`💰 ${this.player.gold}`, 200, 140, {
      font: '18px system-ui',
      color: '#fbbf24',
      align: 'center'
    });

    // 던전 입장 버튼
    Renderer.roundRect(100, 300, 200, 60, 12, '#6366f1');
    Renderer.drawText('던전 입장', 200, 320, {
      font: 'bold 18px system-ui',
      align: 'center'
    });

    this.registerClickArea('dungeon', 100, 300, 200, 60, () => {
      this.startDungeon('math');
    });

    // 오답 등록 버튼
    Renderer.roundRect(100, 380, 200, 60, 12, '#1a1a24', '#6366f1');
    Renderer.drawText('📸 오답 등록', 200, 400, {
      font: '16px system-ui',
      align: 'center'
    });

    this.registerClickArea('register', 100, 380, 200, 60, () => {
      this.registerMonster();
    });
  }

  renderBattleScreen() {
    if (this.battle) {
      this.battle.render();
    }
  }

  renderResultScreen() {
    // 결과 화면 렌더링
  }

  renderShopScreen() {
    // 상점 화면 렌더링
  }

  // 토스트 메시지
  showToast(message) {
    // 토스트 표시 로직
    console.log('Toast:', message);
  }

  // 오답 등록
  async registerMonster() {
    // 카메라/갤러리에서 이미지 가져오기
    const imageData = await this.captureImage();
    if (!imageData) return;

    // 과목 선택 (간단히 프롬프트로)
    const subject = prompt('과목을 입력하세요 (math/english/korean/science):') || 'math';

    const monster = {
      subject,
      imageData,
      question: prompt('문제를 입력하세요:') || '',
      answer: prompt('정답을 입력하세요:') || '',
      choices: [],
      hp: 100,
      maxHp: 100,
      createdAt: Date.now(),
      status: 'alive'
    };

    await this.db.add('monsters', monster);
    this.showToast('몬스터가 등록되었습니다! 👾');
  }

  captureImage() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        } else {
          resolve(null);
        }
      };

      input.click();
    });
  }

  // 저장
  async save() {
    await this.db.put('player', this.player.toJSON());
  }
}
```

### 5-4. 렌더러 (Renderer.js)

```javascript
// src/canvas/Renderer.js
export const Renderer = {
  ctx: null,
  width: 400,
  height: 700,

  init(ctx, width, height) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
  },

  clear() {
    this.ctx.fillStyle = '#0a0a0f';
    this.ctx.fillRect(0, 0, this.width, this.height);
  },

  drawGrid() {
    this.ctx.strokeStyle = 'rgba(99, 102, 241, 0.05)';
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
  },

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

  drawHPBar(x, y, w, h, current, max, color = '#22c55e') {
    const ratio = Math.max(0, current / max);

    // 배경
    this.roundRect(x, y, w, h, h / 2, 'rgba(255,255,255,0.1)');

    // 현재 HP
    if (ratio > 0) {
      this.roundRect(x, y, w * ratio, h, h / 2, color);
    }
  },

  drawText(text, x, y, options = {}) {
    const {
      font = '14px system-ui',
      color = '#e2e8f0',
      align = 'left',
      baseline = 'top'
    } = options;

    this.ctx.font = font;
    this.ctx.fillStyle = color;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = baseline;
    this.ctx.fillText(text, x, y);
  },

  drawImage(img, x, y, w, h) {
    if (img.complete) {
      this.ctx.drawImage(img, x, y, w, h);
    }
  }
};
```

---

## 6. Express 서버 (AI API용)

### 6-1. server/index.js

```javascript
// server/index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { aiRoutes } from './routes/ai.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// 미들웨어
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API 라우트
app.use('/api', aiRoutes);

// 헬스체크
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
```

### 6-2. server/routes/ai.js

```javascript
// server/routes/ai.js
import { Router } from 'express';
import OpenAI from 'openai';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 문제 생성
router.post('/generate', async (req, res) => {
  try {
    const { category, difficulty, context } = req.body;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: '당신은 고등학생을 위한 수학 문제를 만드는 선생님입니다.'
        },
        {
          role: 'user',
          content: `다음 조건으로 문제를 생성해주세요:
            - 유형: ${category}
            - 난이도: ${difficulty}
            - 형식: 4지선다

            JSON 형식으로 응답: { question, choices, answer, explanation }`
        }
      ],
      temperature: 0.7
    });

    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ error: 'Failed to generate problem' });
  }
});

// 힌트 생성
router.post('/hint', async (req, res) => {
  try {
    const { question } = req.body;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '학생에게 문제 풀이 힌트를 제공합니다. 답을 직접 알려주지 말고, 풀이 방향만 안내하세요.'
        },
        {
          role: 'user',
          content: `이 문제의 힌트를 주세요: ${question}`
        }
      ],
      temperature: 0.5,
      max_tokens: 200
    });

    res.json({ hint: completion.choices[0].message.content });
  } catch (error) {
    console.error('Hint error:', error);
    res.status(500).json({ error: 'Failed to generate hint' });
  }
});

// 오답 분석
router.post('/analyze', async (req, res) => {
  try {
    const { wrongAnswers } = req.body;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: '학생의 오답 패턴을 분석하여 취약점을 파악합니다.'
        },
        {
          role: 'user',
          content: `다음 오답 목록을 분석해주세요: ${JSON.stringify(wrongAnswers)}`
        }
      ]
    });

    res.json({ analysis: completion.choices[0].message.content });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: 'Failed to analyze' });
  }
});

export { router as aiRoutes };
```

### 6-3. .env 파일

```
OPENAI_API_KEY=sk-your-api-key-here
PORT=4000
```

---

## 7. 실행 스크립트

### 7-1. start.bat (Windows)

```batch
@echo off
cd /d %~dp0
echo Starting 오답헌터...
start http://localhost:3000
npm run dev
```

### 7-2. start.sh (Mac/Linux)

```bash
#!/bin/bash
cd "$(dirname "$0")"
echo "Starting 오답헌터..."
open http://localhost:3000 || xdg-open http://localhost:3000
npm run dev
```

---

## 8. 개발 단계

### Phase 1: 환경 설정

```
[작업]
├── Node.js 설치
├── npm init
├── Vite 설치 및 설정
├── 기본 폴더 구조 생성
├── index.html + main.js 작성
└── 개발 서버 실행 확인

[명령어]
npm init -y
npm install -D vite
npm run dev
```

### Phase 2: 기본 게임

```
[작업]
├── Canvas 초기화
├── Renderer 모듈
├── IndexedDB 설정
├── 메인 화면 UI
├── 클릭 이벤트 처리
└── 오답 등록 (이미지 캡처)

[산출물]
- 메인 화면 표시
- 오답 사진 저장 가능
```

### Phase 3: 전투 시스템

```
[작업]
├── Battle 클래스
├── 전투 화면 렌더링
├── 선택지 클릭 처리
├── 정답/오답 판정
├── HP/콤보 시스템
└── 스테이지 진행

[산출물]
- 전투 1회 플레이 가능
```

### Phase 4: 로그라이크

```
[작업]
├── 버프 선택 UI
├── 영구 강화 시스템
├── 골드/경험치
├── 레벨업
└── 결과 화면

[산출물]
- 완전한 1런 플레이
```

### Phase 5: AI 연동

```
[작업]
├── Express 서버 구축
├── OpenAI API 연동
├── 힌트 생성 기능
├── 문제 생성 기능 (선택)
└── 오답 분석 기능 (선택)

[산출물]
- AI 힌트 사용 가능
```

---

## 9. 배포

### 9-1. 프로덕션 빌드

```bash
npm run build
```

→ `dist/` 폴더에 최적화된 파일 생성

### 9-2. 배포 옵션

| 서비스 | 특징 | 비용 |
|--------|------|------|
| Vercel | 자동 배포, 서버리스 | 무료 |
| Netlify | 간편 설정 | 무료 |
| GitHub Pages | 정적 호스팅 | 무료 |
| Cloudflare Pages | 빠른 CDN | 무료 |

### 9-3. Vercel 배포

```bash
npm install -g vercel
vercel
```

---

## 10. 요약

```
[Node.js 기반 장점]

1. 언어 통일 (프론트/백엔드 모두 JS)
2. npm 생태계 활용
3. Vite로 빠른 개발
4. ES Modules 지원
5. AI API 서버 확장 용이
6. 간편한 배포

[실행 순서]

1. Node.js 설치 (https://nodejs.org)
2. npm install
3. npm run dev
4. http://localhost:3000 접속
```

---

## 관련 문서

- [핵심 설계](../../오답헌터_핵심설계_20260112.md)
- [AI 기능](../../오답헌터_AI기능_20260112.md)
- [시스템 설계](../../오답헌터_시스템설계_20260112.md)
- [개발 계획](../../오답헌터_개발계획_20260112.md)
