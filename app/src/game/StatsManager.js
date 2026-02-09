// 유저 통계 집계 매니저
export class StatsManager {
  constructor(game) {
    this.game = game;
    this._cachedStats = null;
    this._cacheKey = null;
  }

  // 캐시 무효화 (런 완료/몬스터 등록 시 호출)
  invalidateCache() {
    this._cachedStats = null;
    this._cacheKey = null;
  }

  async aggregateStats() {
    const db = this.game.db;
    const runs = await db.getAll('runs') || [];
    const monsters = await db.getAll('monsters') || [];

    // 캐시 키: 런 수 + 몬스터 수 + 마지막 런 시간
    const lastRunTime = runs.length > 0 ? (runs[runs.length - 1].startTime || 0) : 0;
    const cacheKey = `${runs.length}_${monsters.length}_${lastRunTime}`;
    if (this._cacheKey === cacheKey && this._cachedStats) {
      this.game.cachedStats = this._cachedStats;
      return this._cachedStats;
    }

    const stats = {
      totalRuns: runs.length,
      totalClears: 0,
      totalFails: 0,
      totalAnswers: 0,
      totalCorrect: 0,
      bestCombo: 0,
      totalGoldEarned: 0,
      bySubject: {},
      byDifficulty: { 1: 0, 2: 0, 3: 0 },

      // 아이템 사용 누적
      totalSkips: 0,
      totalHints: 0,
      totalTimeBoosts: 0,
      totalRevives: 0,
      totalTimeouts: 0,
      avgSkipsPerRun: 0,
      avgHintsPerRun: 0,
      wrongBySubject: {},
      correctBySubject: {},
      wrongByTopic: {},
      correctByTopic: {},
      wrongByDifficulty: {},
      subjectTopics: {},   // { math: { '인수분해': { attempts:0, correct:0 }, ... }, ... }

      // 새 메트릭
      winRate: 0,
      totalPlayTime: 0,
      avgRunDuration: 0,
      longestRun: 0,
      shortestClear: 0,
      currentStreak: 0,
      bestStreak: 0,
      recentRuns: [],
      recentWinRate: 0,
      recentAccuracy: 0,
      subjectAccuracy: {},
      difficultyAccuracy: { 1: { attempts: 0, correct: 0 }, 2: { attempts: 0, correct: 0 }, 3: { attempts: 0, correct: 0 } },
      avgAccuracy: 0,
      avgGoldPerRun: 0,
      totalDefeated: 0
    };

    // 시간순 정렬 (연승 계산용) - 이미 정렬되어 있으면 스킵
    let sortedRuns = runs;
    let sorted = true;
    for (let i = 1; i < runs.length; i++) {
      if ((runs[i].startTime || 0) < (runs[i - 1].startTime || 0)) {
        sorted = false;
        break;
      }
    }
    if (!sorted) {
      sortedRuns = [...runs].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));
    }

    let currentStreak = 0;
    let bestStreak = 0;

    for (const run of sortedRuns) {
      if (run.result === 'clear') {
        stats.totalClears++;
        currentStreak++;
        if (currentStreak > bestStreak) bestStreak = currentStreak;
      } else if (run.result === 'failed') {
        stats.totalFails++;
        currentStreak = 0;
      }
      stats.totalAnswers += run.totalAnswers || 0;
      stats.totalCorrect += run.correctAnswers || 0;
      if ((run.bestCombo || 0) > stats.bestCombo) stats.bestCombo = run.bestCombo;
      stats.totalGoldEarned += run.earnedGold || 0;

      // 아이템 사용 누적
      stats.totalSkips += run.skipCount || 0;
      stats.totalHints += run.hintCount || 0;
      stats.totalTimeBoosts += run.timeBoostCount || 0;
      stats.totalRevives += run.reviveCount || 0;
      stats.totalTimeouts += run.timeoutCount || 0;

      // 과목별 정답/오답 누적
      if (run.correctBySubject) {
        for (const [subj, cnt] of Object.entries(run.correctBySubject)) {
          stats.correctBySubject[subj] = (stats.correctBySubject[subj] || 0) + cnt;
        }
      }
      if (run.wrongBySubject) {
        for (const [subj, cnt] of Object.entries(run.wrongBySubject)) {
          stats.wrongBySubject[subj] = (stats.wrongBySubject[subj] || 0) + cnt;
        }
      }

      // 유형(topic)별 누적
      if (run.correctByTopic) {
        for (const [topic, cnt] of Object.entries(run.correctByTopic)) {
          stats.correctByTopic[topic] = (stats.correctByTopic[topic] || 0) + cnt;
        }
      }
      if (run.wrongByTopic) {
        for (const [topic, cnt] of Object.entries(run.wrongByTopic)) {
          stats.wrongByTopic[topic] = (stats.wrongByTopic[topic] || 0) + cnt;
        }
      }

      // 난이도별 오답 누적
      if (run.wrongByDifficulty) {
        for (const [diff, cnt] of Object.entries(run.wrongByDifficulty)) {
          stats.wrongByDifficulty[diff] = (stats.wrongByDifficulty[diff] || 0) + cnt;
        }
      }

      // 시간 통계
      if (run.startTime && run.endTime) {
        const duration = run.endTime - run.startTime;
        stats.totalPlayTime += duration;
        if (duration > stats.longestRun) stats.longestRun = duration;
        if (run.result === 'clear') {
          if (stats.shortestClear === 0 || duration < stats.shortestClear) {
            stats.shortestClear = duration;
          }
        }
      }

      // 처치 몬스터 수
      stats.totalDefeated += (run.defeatedMonsters?.length || 0);
    }

    stats.currentStreak = currentStreak;
    stats.bestStreak = bestStreak;

    // 승률
    if (stats.totalRuns > 0) {
      stats.winRate = Math.round((stats.totalClears / stats.totalRuns) * 100);
      stats.avgRunDuration = stats.totalPlayTime / stats.totalRuns;
      stats.avgGoldPerRun = Math.round(stats.totalGoldEarned / stats.totalRuns);
      stats.avgSkipsPerRun = Math.round((stats.totalSkips / stats.totalRuns) * 10) / 10;
      stats.avgHintsPerRun = Math.round((stats.totalHints / stats.totalRuns) * 10) / 10;
    }

    // 전체 평균 정답률
    if (stats.totalAnswers > 0) {
      stats.avgAccuracy = Math.round((stats.totalCorrect / stats.totalAnswers) * 100);
    }

    // 최근 10런 - 단일 for 루프로 recentClears/recentTotal/recentCorrect 동시 계산
    const recent10 = sortedRuns.slice(-10);
    let recentClears = 0, recentTotal = 0, recentCorrect = 0;
    stats.recentRuns = new Array(recent10.length);
    for (let i = 0; i < recent10.length; i++) {
      const r = recent10[i];
      if (r.result === 'clear') recentClears++;
      recentTotal += r.totalAnswers || 0;
      recentCorrect += r.correctAnswers || 0;
      stats.recentRuns[i] = {
        result: r.result,
        accuracy: r.totalAnswers > 0 ? Math.round((r.correctAnswers / r.totalAnswers) * 100) : 0,
        combo: r.bestCombo || 0,
        gold: r.earnedGold || 0,
        duration: (r.startTime && r.endTime) ? r.endTime - r.startTime : 0,
        date: r.startTime || 0
      };
    }

    if (recent10.length > 0) {
      stats.recentWinRate = Math.round((recentClears / recent10.length) * 100);
      stats.recentAccuracy = recentTotal > 0 ? Math.round((recentCorrect / recentTotal) * 100) : 0;
    }

    // 정적 topic→subject 매핑 (폴백)
    const KNOWN_TOPIC_SUBJECTS = {
      '일차방정식': 'math', '이차방정식': 'math', '인수분해': 'math',
      '함수': 'math', '부등식': 'math', '분수 계산': 'math',
      '비율/퍼센트': 'math', '수열': 'math', '확률': 'math', '도형': 'math',
      '힘과 운동': 'science', '화학반응': 'science', '세포': 'science',
      '지구과학': 'science', '역학': 'science', '전자기': 'science',
      '몰과 반응식': 'science', '유전': 'science'
    };

    // 몬스터 과목별/난이도별 집계
    const topicToSubject = {};
    const monstersById = {};
    for (const m of monsters) {
      if (m.id) monstersById[m.id] = m;
      const subj = m.subject || 'math';
      stats.bySubject[subj] = (stats.bySubject[subj] || 0) + 1;
      const diff = m.difficulty || 2;
      if (stats.byDifficulty[diff] !== undefined) {
        stats.byDifficulty[diff]++;
      }

      // 과목별 정답률
      if (!stats.subjectAccuracy[subj]) {
        stats.subjectAccuracy[subj] = { attempts: 0, correct: 0 };
      }
      stats.subjectAccuracy[subj].attempts += (m.stats?.attempts || 0);
      stats.subjectAccuracy[subj].correct += (m.stats?.correct || 0);

      // 난이도별 정답률
      if (stats.difficultyAccuracy[diff]) {
        stats.difficultyAccuracy[diff].attempts += (m.stats?.attempts || 0);
        stats.difficultyAccuracy[diff].correct += (m.stats?.correct || 0);
      }

      // topic→subject 매핑 구축
      if (m.topic) {
        topicToSubject[m.topic] = subj;
      }
    }

    // 1차: defeatedMonsters에서 유형별 통계 구축 (모든 런 커버)
    for (const run of sortedRuns) {
      if (!run.defeatedMonsters) continue;
      for (const mId of run.defeatedMonsters) {
        const m = monstersById[mId];
        if (!m || !m.topic) continue;
        const subj = m.subject || 'math';
        if (!stats.subjectTopics[subj]) stats.subjectTopics[subj] = {};
        if (!stats.subjectTopics[subj][m.topic]) {
          stats.subjectTopics[subj][m.topic] = { attempts: 0, correct: 0 };
        }
        stats.subjectTopics[subj][m.topic].attempts++;
        stats.subjectTopics[subj][m.topic].correct++;
      }
    }

    // 2차: 런 기반 correctByTopic/wrongByTopic 병합 (더 정확한 데이터로 보정)
    const allTopics = new Set([
      ...Object.keys(stats.correctByTopic),
      ...Object.keys(stats.wrongByTopic)
    ]);
    for (const topic of allTopics) {
      const subj = topicToSubject[topic] || KNOWN_TOPIC_SUBJECTS[topic];
      if (!subj) continue;

      const runCorrect = stats.correctByTopic[topic] || 0;
      const runWrong = stats.wrongByTopic[topic] || 0;
      const runAttempts = runCorrect + runWrong;

      if (!stats.subjectTopics[subj]) stats.subjectTopics[subj] = {};
      if (!stats.subjectTopics[subj][topic]) {
        stats.subjectTopics[subj][topic] = { attempts: 0, correct: 0 };
      }
      const entry = stats.subjectTopics[subj][topic];
      entry.attempts = Math.max(entry.attempts, runAttempts);
      entry.correct = Math.max(entry.correct, runCorrect);
    }

    this.game.cachedStats = stats;
    this._cachedStats = stats;
    this._cacheKey = cacheKey;
    return stats;
  }
}
