// 유저 통계 집계 매니저
export class StatsManager {
  constructor(game) {
    this.game = game;
  }

  async aggregateStats() {
    const db = this.game.db;
    const runs = await db.getAll('runs') || [];
    const monsters = await db.getAll('monsters') || [];

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

    // 시간순 정렬 (연승 계산용)
    const sortedRuns = [...runs].sort((a, b) => (a.startTime || 0) - (b.startTime || 0));

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
    }

    // 전체 평균 정답률
    if (stats.totalAnswers > 0) {
      stats.avgAccuracy = Math.round((stats.totalCorrect / stats.totalAnswers) * 100);
    }

    // 최근 10런
    const recent10 = sortedRuns.slice(-10);
    stats.recentRuns = recent10.map(r => ({
      result: r.result,
      accuracy: r.totalAnswers > 0 ? Math.round((r.correctAnswers / r.totalAnswers) * 100) : 0,
      combo: r.bestCombo || 0,
      gold: r.earnedGold || 0,
      duration: (r.startTime && r.endTime) ? r.endTime - r.startTime : 0,
      date: r.startTime || 0
    }));

    // 최근 승률/정답률
    if (recent10.length > 0) {
      const recentClears = recent10.filter(r => r.result === 'clear').length;
      stats.recentWinRate = Math.round((recentClears / recent10.length) * 100);
      const recentTotal = recent10.reduce((s, r) => s + (r.totalAnswers || 0), 0);
      const recentCorrect = recent10.reduce((s, r) => s + (r.correctAnswers || 0), 0);
      stats.recentAccuracy = recentTotal > 0 ? Math.round((recentCorrect / recentTotal) * 100) : 0;
    }

    // 몬스터 과목별/난이도별 집계
    for (const m of monsters) {
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
    }

    this.game.cachedStats = stats;
    return stats;
  }
}
