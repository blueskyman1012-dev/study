// 통계 화면 렌더링 (프리미엄)
import { Renderer } from '../../canvas/Renderer.js';
import { SCREENS, COLORS, SUBJECTS } from '../../utils/constants.js';
import { t } from '../../i18n/i18n.js';

// 시간을 읽기 좋은 포맷으로
function formatDuration(ms) {
  if (!ms || ms <= 0) return '-';
  const totalSec = Math.floor(ms / 1000);
  const hr = Math.floor(totalSec / 3600);
  const min = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (hr > 0) return `${hr}${t('stats_hr')} ${min}${t('stats_min')}`;
  if (min > 0) return `${min}${t('stats_min')} ${sec}${t('stats_sec')}`;
  return `${sec}${t('stats_sec')}`;
}

// 아크 링 그리기 (승률/정답률 원형 게이지)
function drawArcRing(ctx, cx, cy, radius, thickness, ratio, color, bgColor) {
  // 배경 링
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI * 1.5);
  ctx.strokeStyle = bgColor || 'rgba(255,255,255,0.08)';
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.stroke();

  // 값 링
  if (ratio > 0) {
    const endAngle = -Math.PI / 2 + (Math.PI * 2 * Math.min(ratio, 1));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

// 소형 링 (과목별)
function drawSmallRing(ctx, cx, cy, radius, thickness, ratio, color) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI * 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = thickness;
  ctx.lineCap = 'round';
  ctx.stroke();

  if (ratio > 0) {
    const endAngle = -Math.PI / 2 + (Math.PI * 2 * Math.min(ratio, 1));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, endAngle);
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

export function renderStatsScreen(game) {
  const stats = game.cachedStats || {};
  const ctx = Renderer.ctx;
  Renderer.drawGrid();

  // 뒤로가기 (고정 헤더 영역이지만 클릭 영역은 스크롤 보정 필요)
  game.registerClickArea('back', 10, 10, 80, 40, () => game.changeScreen(SCREENS.MAIN));

  // 빈 데이터 처리
  if (!stats.totalRuns || stats.totalRuns === 0) {
    Renderer.drawText(t('stats_noData'), 200, 300, {
      font: 'bold 18px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
    });
    Renderer.drawText(t('stats_noDataSub'), 200, 330, {
      font: '14px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
    return;
  }

  const accuracy = stats.totalAnswers > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswers) * 100) : 0;

  // ─── A. 히어로 배너 (y:75, h:180) ───
  Renderer.drawGradientCard(20, 75, 360, 180, 14, '#1e1e2e', '#151520');
  Renderer.roundRect(20, 75, 360, 180, 14, null, 'rgba(99,102,241,0.3)');

  // 큰 승률 아크 링 (중앙)
  ctx.save();
  drawArcRing(ctx, 200, 160, 45, 10, stats.winRate / 100,
    stats.winRate >= 60 ? COLORS.SUCCESS : stats.winRate >= 30 ? COLORS.WARNING : COLORS.DANGER);
  // 승률 텍스트 (링 안)
  Renderer.drawText(`${stats.winRate}%`, 200, 148, {
    font: 'bold 22px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
  });
  Renderer.drawText(t('stats_winRate'), 200, 175, {
    font: '11px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  ctx.restore();

  // 3열 요약 (런/정답률/콤보)
  const summaryY = 225;
  // 총 런
  Renderer.drawText(`${stats.totalRuns}`, 80, summaryY, {
    font: 'bold 18px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center'
  });
  Renderer.drawText(t('totalRuns'), 80, summaryY + 20, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  // 정답률
  Renderer.drawText(`${accuracy}%`, 200, summaryY, {
    font: 'bold 18px system-ui', color: accuracy >= 70 ? COLORS.SUCCESS : COLORS.WARNING, align: 'center'
  });
  Renderer.drawText(t('stats_accuracy'), 200, summaryY + 20, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  // 최고 콤보
  Renderer.drawText(`${stats.bestCombo}`, 320, summaryY, {
    font: 'bold 18px system-ui', color: COLORS.WARNING, align: 'center'
  });
  Renderer.drawText(t('bestCombo'), 320, summaryY + 20, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });

  // ─── B. 연승 & 시간 (y:270, h:90) ───
  // 왼쪽 미니카드: 연승
  Renderer.drawGradientCard(20, 270, 172, 90, 12, '#1a1a28', '#151520');
  Renderer.roundRect(20, 270, 172, 90, 12, null, 'rgba(251,191,36,0.2)');
  Renderer.drawText('🔥 ' + t('stats_streak'), 106, 285, {
    font: 'bold 12px system-ui', color: COLORS.WARNING, align: 'center'
  });
  Renderer.drawText(`${stats.currentStreak}`, 66, 315, {
    font: 'bold 22px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
  });
  Renderer.drawText(t('stats_currentStreak'), 66, 340, {
    font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  Renderer.drawText(`${stats.bestStreak}`, 146, 315, {
    font: 'bold 22px system-ui', color: COLORS.WARNING, align: 'center'
  });
  Renderer.drawText(t('stats_bestStreak'), 146, 340, {
    font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });

  // 오른쪽 미니카드: 시간
  Renderer.drawGradientCard(208, 270, 172, 90, 12, '#1a1a28', '#151520');
  Renderer.roundRect(208, 270, 172, 90, 12, null, 'rgba(56,189,248,0.2)');
  Renderer.drawText('⏱️ ' + t('stats_time'), 294, 285, {
    font: 'bold 12px system-ui', color: '#38bdf8', align: 'center'
  });
  Renderer.drawText(formatDuration(stats.totalPlayTime), 294, 315, {
    font: 'bold 16px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
  });
  Renderer.drawText(t('stats_totalPlayTime'), 294, 340, {
    font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });

  // ─── C. 과목별 성과 (y:375, h:220) ───
  Renderer.drawGradientCard(20, 375, 360, 220, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, 375, 360, 220, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('📚 ' + t('stats_subjectPerf'), 40, 393, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  const subjectEntries = [
    { key: 'math', ...SUBJECTS.MATH },
    { key: 'english', ...SUBJECTS.ENGLISH },
    { key: 'korean', ...SUBJECTS.KOREAN },
    { key: 'science', ...SUBJECTS.SCIENCE }
  ];

  let sy = 425;
  for (const subj of subjectEntries) {
    const count = stats.bySubject?.[subj.key] || 0;
    const sa = stats.subjectAccuracy?.[subj.key];
    const subjAcc = (sa && sa.attempts > 0) ? Math.round((sa.correct / sa.attempts) * 100) : 0;

    // 소형 정답률 링
    ctx.save();
    drawSmallRing(ctx, 52, sy + 12, 16, 4, subjAcc / 100, subj.color);
    Renderer.drawText(`${subjAcc}%`, 52, sy + 6, {
      font: 'bold 9px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
    });
    ctx.restore();

    // 과목명
    Renderer.drawText(`${subj.icon} ${t(subj.nameKey)}`, 80, sy, {
      font: '12px system-ui', color: COLORS.TEXT_PRIMARY
    });
    // 문제 수
    Renderer.drawText(`${count}`, 355, sy, {
      font: 'bold 12px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
    });

    // 바 차트
    const maxSubjCount = Math.max(1, ...subjectEntries.map(s => stats.bySubject?.[s.key] || 0));
    const barMaxW = 170;
    const barW = count > 0 ? Math.max(5, barMaxW * count / maxSubjCount) : 0;
    Renderer.roundRect(150, sy + 16, barMaxW, 8, 4, 'rgba(255,255,255,0.06)');
    if (barW > 0) {
      Renderer.roundRect(150, sy + 16, barW, 8, 4, subj.color);
    }
    // 정답률 텍스트 (바 옆)
    if (sa && sa.attempts > 0) {
      Renderer.drawText(`${sa.correct}/${sa.attempts}`, 355, sy + 18, {
        font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
      });
    }

    sy += 45;
  }

  // ─── D. 난이도 분석 (y:610, h:160) ───
  Renderer.drawGradientCard(20, 610, 360, 160, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, 610, 360, 160, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('🎯 ' + t('stats_diffAnalysis'), 40, 628, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  const diffLabels = [
    { key: 1, name: t('easy'), color: COLORS.SUCCESS, gradStart: '#16a34a', gradEnd: '#22c55e' },
    { key: 2, name: t('normal'), color: COLORS.WARNING, gradStart: '#d97706', gradEnd: '#fbbf24' },
    { key: 3, name: t('hard'), color: COLORS.DANGER, gradStart: '#dc2626', gradEnd: '#ef4444' }
  ];

  let dy = 658;
  for (const diff of diffLabels) {
    const count = stats.byDifficulty?.[diff.key] || 0;
    const da = stats.difficultyAccuracy?.[diff.key];
    const diffAcc = (da && da.attempts > 0) ? Math.round((da.correct / da.attempts) * 100) : 0;

    Renderer.drawText(diff.name, 40, dy, { font: 'bold 12px system-ui', color: diff.color });
    Renderer.drawText(`${count}`, 120, dy, { font: '12px system-ui', color: COLORS.TEXT_SECONDARY });

    // 그라데이션 바
    const barMaxW = 180;
    const maxDiffCount = Math.max(1, ...diffLabels.map(d => stats.byDifficulty?.[d.key] || 0));
    const barW = count > 0 ? Math.max(5, barMaxW * count / maxDiffCount) : 0;

    Renderer.roundRect(140, dy - 4, barMaxW, 12, 6, 'rgba(255,255,255,0.06)');
    if (barW > 0) {
      const gradient = ctx.createLinearGradient(140, 0, 140 + barW, 0);
      gradient.addColorStop(0, diff.gradStart);
      gradient.addColorStop(1, diff.gradEnd);
      Renderer.roundRect(140, dy - 4, barW, 12, 6, gradient);
    }

    // 정답률
    Renderer.drawText(`${diffAcc}%`, 355, dy, {
      font: 'bold 12px system-ui', color: diffAcc >= 70 ? COLORS.SUCCESS : diffAcc >= 40 ? COLORS.WARNING : COLORS.DANGER, align: 'right'
    });

    dy += 38;
  }

  // ─── E. 플레이 기록 2x2 (y:785, h:130) ───
  Renderer.drawText('🏆 ' + t('stats_playStats'), 40, 800, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  // 미니카드 4개 (2×2)
  const miniCards = [
    { label: t('stats_wins'), value: `${stats.totalClears}`, color: COLORS.SUCCESS, icon: '✅' },
    { label: t('stats_losses'), value: `${stats.totalFails}`, color: COLORS.DANGER, icon: '💀' },
    { label: t('bestCombo'), value: `${stats.bestCombo}`, color: COLORS.WARNING, icon: '🔥' },
    { label: t('stats_gold'), value: `${(stats.totalGoldEarned || 0).toLocaleString()}`, color: '#fbbf24', icon: '💰' }
  ];

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const mx = 20 + col * 185;
    const my = 822 + row * 52;
    const card = miniCards[i];

    Renderer.drawGradientCard(mx, my, 172, 46, 10, '#1a1a28', '#151520');
    Renderer.drawText(`${card.icon} ${card.label}`, mx + 12, my + 10, {
      font: '10px system-ui', color: COLORS.TEXT_SECONDARY
    });
    Renderer.drawText(card.value, mx + 160, my + 10, {
      font: 'bold 16px system-ui', color: card.color, align: 'right'
    });
  }

  // ─── F. 최근 전적 (y:930, h:280) ───
  Renderer.drawGradientCard(20, 930, 360, 280, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, 930, 360, 280, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('📈 ' + t('stats_recentBattle'), 40, 948, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  // 최근 승률/정답률 미니배지
  Renderer.drawText(`${t('stats_recentWinRate')}: ${stats.recentWinRate}%`, 355, 948, {
    font: '11px system-ui', color: stats.recentWinRate >= 50 ? COLORS.SUCCESS : COLORS.DANGER, align: 'right'
  });

  const recentRuns = stats.recentRuns || [];

  if (recentRuns.length >= 2) {
    // 스파크라인 그래프 (정답률 추이)
    const graphX = 45;
    const graphY = 975;
    const graphW = 330;
    const graphH = 80;

    // 그래프 배경
    Renderer.roundRect(graphX - 5, graphY - 5, graphW + 10, graphH + 10, 8, 'rgba(0,0,0,0.2)');

    // 가이드 라인
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let pct = 0; pct <= 100; pct += 25) {
      const ly = graphY + graphH - (graphH * pct / 100);
      ctx.beginPath();
      ctx.moveTo(graphX, ly);
      ctx.lineTo(graphX + graphW, ly);
      ctx.stroke();
    }

    // 데이터 점 계산
    const points = recentRuns.map((r, i) => ({
      x: graphX + (i / (recentRuns.length - 1)) * graphW,
      y: graphY + graphH - (graphH * r.accuracy / 100)
    }));

    // 그라데이션 면적
    const areaGrad = ctx.createLinearGradient(0, graphY, 0, graphY + graphH);
    areaGrad.addColorStop(0, 'rgba(99,102,241,0.3)');
    areaGrad.addColorStop(1, 'rgba(99,102,241,0.02)');

    ctx.beginPath();
    ctx.moveTo(points[0].x, graphY + graphH);
    for (const p of points) ctx.lineTo(p.x, p.y);
    ctx.lineTo(points[points.length - 1].x, graphY + graphH);
    ctx.closePath();
    ctx.fillStyle = areaGrad;
    ctx.fill();

    // 꺾은선
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = COLORS.ACCENT_LIGHT;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 점
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.ACCENT;
      ctx.fill();
      ctx.strokeStyle = COLORS.ACCENT_LIGHT;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Y축 라벨
    Renderer.drawText('100%', graphX - 8, graphY - 2, {
      font: '8px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
    });
    Renderer.drawText('50%', graphX - 8, graphY + graphH / 2 - 2, {
      font: '8px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
    });
    Renderer.drawText('0%', graphX - 8, graphY + graphH - 2, {
      font: '8px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
    });
  }

  // 최근 런 목록
  let ry = 1070;
  const displayRuns = recentRuns.slice(-5).reverse();
  for (const run of displayRuns) {
    const isWin = run.result === 'clear';
    const icon = isWin ? '✅' : '💀';
    const dateStr = run.date ? new Date(run.date).toLocaleDateString() : '-';

    Renderer.drawText(`${icon} ${dateStr}`, 40, ry, {
      font: '11px system-ui', color: isWin ? COLORS.SUCCESS : COLORS.DANGER
    });
    Renderer.drawText(`${run.accuracy}%`, 180, ry, {
      font: 'bold 11px system-ui', color: run.accuracy >= 70 ? COLORS.SUCCESS : COLORS.WARNING, align: 'center'
    });
    Renderer.drawText(`x${run.combo}`, 240, ry, {
      font: '11px system-ui', color: COLORS.WARNING, align: 'center'
    });
    Renderer.drawText(`${run.gold}G`, 300, ry, {
      font: '11px system-ui', color: '#fbbf24', align: 'center'
    });
    Renderer.drawText(formatDuration(run.duration), 365, ry, {
      font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
    });
    ry += 24;
  }

  // ─── G. 심화 통계 (y:1225, h:140) ───
  Renderer.drawGradientCard(20, 1225, 360, 140, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, 1225, 360, 140, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('🔬 ' + t('stats_advanced'), 40, 1243, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  const advStats = [
    { label: t('stats_avgAccuracy'), value: `${stats.avgAccuracy}%`, color: COLORS.SUCCESS },
    { label: t('stats_avgGoldPerRun'), value: `${stats.avgGoldPerRun}G`, color: '#fbbf24' },
    { label: t('stats_shortestClear'), value: formatDuration(stats.shortestClear), color: '#38bdf8' },
    { label: t('stats_longestRun'), value: formatDuration(stats.longestRun), color: COLORS.TEXT_SECONDARY },
    { label: t('stats_totalDefeated'), value: `${stats.totalDefeated}`, color: COLORS.DANGER }
  ];

  let ay = 1270;
  for (let i = 0; i < advStats.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ax = 40 + col * 180;
    const apy = ay + row * 28;

    Renderer.drawText(advStats[i].label, ax, apy, {
      font: '11px system-ui', color: COLORS.TEXT_SECONDARY
    });
    Renderer.drawText(advStats[i].value, ax + 160, apy, {
      font: 'bold 12px system-ui', color: advStats[i].color, align: 'right'
    });
  }

  // ─── H. 하단 여백 ───
  // 스크롤 최대값 설정 (전체 콘텐츠 높이 - 화면 높이)
  const totalContentHeight = 1420;
  game.scrollMaxY = Math.max(0, totalContentHeight - 700);
}
