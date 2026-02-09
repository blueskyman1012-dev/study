// 백엔드 API 호출 서비스 (Cloudflare Workers D1 연동)
const API_URL = 'https://study-api.blueskyman1012.workers.dev';

// API 오류 타입 분류
const ERROR_TYPES = {
  AUTH: 'auth',           // 401 - 인증 실패
  RATE_LIMIT: 'rate_limit', // 429 - 속도 제한
  SERVER: 'server',       // 500+ - 서버 오류
  NETWORK: 'network',     // 네트워크 연결 실패
  UNKNOWN: 'unknown'
};

function classifyError(status) {
  if (status === 401 || status === 403) return ERROR_TYPES.AUTH;
  if (status === 429) return ERROR_TYPES.RATE_LIMIT;
  if (status >= 500) return ERROR_TYPES.SERVER;
  return ERROR_TYPES.UNKNOWN;
}

export class ApiService {
  constructor() {
    this.sessionToken = null;
    this.lastError = null;  // 마지막 오류 정보
  }

  setToken(token) {
    this.sessionToken = token;
  }

  isLoggedIn() {
    return !!this.sessionToken;
  }

  // 마지막 오류 조회
  getLastError() {
    return this.lastError;
  }

  async _fetch(path, options = {}) {
    if (!this.sessionToken) {
      this.lastError = { type: ERROR_TYPES.AUTH, status: 0, message: '로그인 필요' };
      return null;
    }

    try {
      const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.sessionToken}`,
          ...options.headers
        }
      });

      if (!res.ok) {
        const errorType = classifyError(res.status);
        const errorMsg = `API ${path} 실패: ${res.status}`;

        this.lastError = { type: errorType, status: res.status, message: errorMsg, path };

        // 오류 타입별 로그 레벨 분리
        if (errorType === ERROR_TYPES.AUTH) {
          console.warn(`🔒 [인증 오류] ${errorMsg} - 재로그인 필요`);
        } else if (errorType === ERROR_TYPES.RATE_LIMIT) {
          console.warn(`⏳ [속도 제한] ${errorMsg} - 잠시 후 재시도`);
        } else if (errorType === ERROR_TYPES.SERVER) {
          console.error(`🔥 [서버 오류] ${errorMsg}`);
        } else {
          console.warn(`⚠️ [API 오류] ${errorMsg}`);
        }

        return null;
      }

      this.lastError = null;
      return await res.json();
    } catch (err) {
      this.lastError = { type: ERROR_TYPES.NETWORK, status: 0, message: err.message, path };
      console.warn(`🌐 [네트워크 오류] API ${path}: ${err.message}`);
      return null;
    }
  }

  // --- Player ---
  async getPlayer() {
    return this._fetch('/api/player');
  }

  async putPlayer(playerData) {
    return this._fetch('/api/player', {
      method: 'PUT',
      body: JSON.stringify({
        level: playerData.level,
        exp: playerData.exp,
        hp: playerData.currentHp,
        attack: playerData.permanentUpgrades?.damage || 0,
        defense: 0,
        gold: playerData.gold,
        data: {
          maxHp: playerData.maxHp,
          permanentUpgrades: playerData.permanentUpgrades,
          inventory: playerData.inventory,
          stats: playerData.stats,
          createdAt: playerData.createdAt
        }
      })
    });
  }

  // --- Monsters ---
  async getMonsters() {
    return this._fetch('/api/monsters');
  }

  async postMonster(monster) {
    return this._fetch('/api/monsters', {
      method: 'POST',
      body: JSON.stringify({
        subject: monster.subject || 'math',
        question: monster.question || '',
        answer: monster.answer || '',
        wrong_answer: (monster.choices || []).filter(c => c !== monster.answer).join('|'),
        explanation: monster.explanation || '',
        difficulty: monster.difficulty || 2,
        data: {
          answers: monster.answers,
          choices: monster.choices,
          correctIndex: monster.correctIndex,
          topic: monster.topic,
          keywords: monster.keywords,
          questionType: monster.questionType,
          formula: monster.formula,
          imageData: monster.imageData,
          aiAnalysis: monster.aiAnalysis,
          stats: monster.stats,
          review: monster.review,
          isGenerated: monster.isGenerated
        }
      })
    });
  }

  async putMonster(id, updates) {
    return this._fetch(`/api/monsters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // --- Runs ---
  async postRun(runData) {
    return this._fetch('/api/runs', {
      method: 'POST',
      body: JSON.stringify({
        start_time: new Date(runData.startTime).toISOString(),
        end_time: runData.endTime ? new Date(runData.endTime).toISOString() : new Date().toISOString(),
        score: runData.earnedExp || 0,
        monsters_defeated: (runData.defeatedMonsters || []).length,
        data: {
          result: runData.result,
          earnedGold: runData.earnedGold,
          bestCombo: runData.bestCombo,
          correctAnswers: runData.correctAnswers,
          totalAnswers: runData.totalAnswers,
          goldMultiplier: runData.goldMultiplier
        }
      })
    });
  }

  async getRuns() {
    return this._fetch('/api/runs');
  }

  async downloadRuns(db) {
    const result = await this.getRuns();
    if (!result?.runs || !Array.isArray(result.runs)) return false;

    // 서버에 런 데이터가 없으면 로컬 유지
    if (result.runs.length === 0) return false;

    // 백업: 기존 로컬 데이터 보관
    const backup = await db.getAll('runs') || [];

    try {
      // 기존 로컬 runs 삭제
      for (const r of backup) {
        await db.delete('runs', r.id);
      }

      // 서버 데이터로 교체
      for (const sr of result.runs) {
        const extra = typeof sr.data === 'string' ? JSON.parse(sr.data) : (sr.data || {});
        const run = {
          serverId: sr.id,
          startTime: sr.start_time ? new Date(sr.start_time).getTime() : Date.now(),
          endTime: sr.end_time ? new Date(sr.end_time).getTime() : Date.now(),
          earnedExp: sr.score || 0,
          defeatedCount: sr.monsters_defeated || 0,
          result: extra.result || 'unknown',
          earnedGold: extra.earnedGold || 0,
          bestCombo: extra.bestCombo || 0,
          correctAnswers: extra.correctAnswers || 0,
          totalAnswers: extra.totalAnswers || 0,
          goldMultiplier: extra.goldMultiplier || 1
        };
        await db.add('runs', run);
      }

      return true;
    } catch (err) {
      // 실패 시 백업 복구
      console.error('런 데이터 동기화 실패, 백업 복구 시도:', err);
      try {
        // 현재 상태 정리
        const partial = await db.getAll('runs') || [];
        for (const r of partial) {
          await db.delete('runs', r.id);
        }
        // 백업 복구
        for (const r of backup) {
          await db.add('runs', r);
        }
        console.log('백업 복구 완료');
      } catch (restoreErr) {
        console.error('백업 복구 실패:', restoreErr);
      }
      return false;
    }
  }

  // --- Settings ---
  async getSettings() {
    return this._fetch('/api/settings');
  }

  async putSettings(settings) {
    return this._fetch('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  }

  // --- Keys ---
  async saveKey(keyName, keyValue) {
    return this._fetch('/api/keys', {
      method: 'POST',
      body: JSON.stringify({ key_name: keyName, key_value: keyValue })
    });
  }

  async deleteKey(keyName) {
    return this._fetch(`/api/keys/${keyName}`, { method: 'DELETE' });
  }

  // 서버에서 API 키 로드 → 로컬 서비스에 적용
  async downloadKeys() {
    const result = await this._fetch('/api/keys');
    if (!result?.keys) return null;
    return result.keys;
  }

  // --- 로컬 → 서버 업로드 ---
  async uploadMonsters(db) {
    const alive = await db.getByIndex('monsters', 'status', 'alive') || [];
    const cleared = await db.getByIndex('monsters', 'status', 'cleared') || [];
    const allMonsters = [...alive, ...cleared];

    let uploaded = 0;
    for (const monster of allMonsters) {
      if (monster.serverId) continue; // 이미 서버에 있음

      const result = await this.postMonster(monster);
      if (result?.id) {
        monster.serverId = result.id;
        await db.put('monsters', monster);
        uploaded++;
      }
    }

    if (uploaded > 0) {
      console.log(`📤 몬스터 ${uploaded}건 서버 업로드 완료`);
    }
    return uploaded;
  }

  // --- 서버 데이터 → 로컬 동기화 ---
  async downloadPlayerData(db) {
    const result = await this.getPlayer();
    if (!result?.player) return null;

    const sp = result.player;
    const extra = typeof sp.data === 'string' ? JSON.parse(sp.data) : (sp.data || {});

    const localPlayer = await db.get('player', 'main');
    const player = localPlayer || {
      id: 'main',
      createdAt: extra.createdAt || Date.now()
    };

    player.level = sp.level || 1;
    player.exp = sp.exp || 0;
    player.gold = sp.gold || 0;
    player.maxHp = extra.maxHp || sp.hp || 100;
    player.currentHp = player.maxHp;
    player.permanentUpgrades = extra.permanentUpgrades || { hp: 0, time: 0, goldBonus: 0, damage: 0 };
    player.inventory = extra.inventory || { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 };
    player.stats = extra.stats || { totalRuns: 0, totalKills: 0, bestCombo: 0 };

    await db.put('player', player);
    return player;
  }

  async downloadMonsters(db) {
    const result = await this.getMonsters();
    if (!result?.monsters || !Array.isArray(result.monsters)) return false;

    // 서버에 몬스터가 없으면 로컬 데이터 유지
    if (result.monsters.length === 0) return false;

    // 백업: 기존 로컬 몬스터 보관
    const backupAlive = await db.getByIndex('monsters', 'status', 'alive');
    const backupCleared = await db.getByIndex('monsters', 'status', 'cleared');
    const backup = [...backupAlive, ...backupCleared];

    try {
      // 기존 삭제
      for (const m of backup) {
        await db.delete('monsters', m.id);
      }

      // 서버 데이터로 교체
      for (const sm of result.monsters) {
        const extra = typeof sm.data === 'string' ? JSON.parse(sm.data) : (sm.data || {});
        const monster = {
          serverId: sm.id,
          subject: sm.subject || 'math',
          question: sm.question || '',
          answer: sm.answer || '',
          answers: extra.answers || [sm.answer],
          choices: extra.choices || [],
          correctIndex: extra.correctIndex || 0,
          explanation: sm.explanation || '',
          topic: extra.topic || '',
          difficulty: sm.difficulty || 2,
          keywords: extra.keywords || [],
          questionType: extra.questionType || '객관식',
          formula: extra.formula || '',
          imageData: extra.imageData,
          aiAnalysis: extra.aiAnalysis,
          isGenerated: extra.isGenerated || false,
          hp: 80 + (sm.difficulty || 2) * 20,
          maxHp: 80 + (sm.difficulty || 2) * 20,
          createdAt: sm.created_at ? new Date(sm.created_at).getTime() : Date.now(),
          status: sm.status === 'defeated' ? 'cleared' : 'alive',
          stats: extra.stats || { attempts: 0, correct: 0, wrong: 0, lastAttempt: null, averageTime: 0 },
          review: extra.review || { nextReviewDate: null, reviewCount: 0, masteryLevel: 0 }
        };
        await db.add('monsters', monster);
      }

      return true;
    } catch (err) {
      // 실패 시 백업 복구
      console.error('몬스터 데이터 동기화 실패, 백업 복구 시도:', err);
      try {
        const partial = await db.getAll('monsters') || [];
        for (const m of partial) {
          await db.delete('monsters', m.id);
        }
        for (const m of backup) {
          await db.add('monsters', m);
        }
        console.log('몬스터 백업 복구 완료');
      } catch (restoreErr) {
        console.error('몬스터 백업 복구 실패:', restoreErr);
      }
      return false;
    }
  }
}

export const apiService = new ApiService();
