// 통계 화면 렌더링 (3탭 시스템)
import { Renderer } from '../../canvas/Renderer.js';
import { SCREENS, COLORS, SUBJECTS } from '../../utils/constants.js';
import { t } from '../../i18n/i18n.js';

// 모듈 레벨 탭 상태
let currentStatsTab = 0;
const STATS_TABS = [
  { labelKey: 'stats_tabOverview', icon: '📊' },
  { labelKey: 'stats_tabSubject', icon: '📚' },
  { labelKey: 'stats_tabAnalysis', icon: '🎯' },
];

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
  ctx.beginPath();
  ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI * 1.5);
  ctx.strokeStyle = bgColor || 'rgba(255,255,255,0.08)';
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

// ─── 고정 헤더 (Game.js에서 호출) ───
export function renderStatsFixedHeader(game) {
  // 배경 (0~96)
  Renderer.roundRect(0, 0, 400, 96, 0, COLORS.BG_SECONDARY);

  // 제목 + 뒤로가기
  Renderer.drawText(t('statsTitle'), 200, 18, { font: 'bold 18px system-ui', align: 'center' });
  Renderer.drawText(t('back'), 30, 20, { font: '14px system-ui', color: COLORS.ACCENT_LIGHT });
  game.registerClickArea('back', 10, 10, 80, 35, () => game.changeScreen(SCREENS.MAIN));

  // 탭 바 (y:55~91)
  const tabY = 55;
  const tabH = 36;
  const tabW = Math.floor(400 / STATS_TABS.length);
  STATS_TABS.forEach((tab, i) => {
    const x = i * tabW;
    const isActive = i === currentStatsTab;
    Renderer.roundRect(x, tabY, tabW, tabH, 0, isActive ? COLORS.ACCENT : COLORS.BG_CARD);
    if (isActive) {
      Renderer.roundRect(x + 10, tabY + tabH - 3, tabW - 20, 3, 1.5, COLORS.ACCENT_LIGHT);
    }
    const label = `${tab.icon} ${t(tab.labelKey)}`;
    Renderer.drawText(label, x + tabW / 2, tabY + 8, {
      font: `${isActive ? 'bold ' : ''}12px system-ui`,
      color: isActive ? '#fff' : COLORS.TEXT_SECONDARY,
      align: 'center'
    });
    game.registerClickArea(`stats_tab_${i}`, x, tabY, tabW, tabH, () => {
      currentStatsTab = i;
      game.scrollY = 0;
      game.scrollMaxY = 0;
    });
  });
}

// ─── 메인 렌더 함수 ───
export function renderStatsScreen(game) {
  const stats = game.cachedStats || {};
  const ctx = Renderer.ctx;
  Renderer.drawGrid();

  // 뒤로가기 클릭 (스크롤 보정용)
  game.registerClickArea('back', 10, 10, 80, 40, () => game.changeScreen(SCREENS.MAIN));

  // 빈 데이터
  if (!stats.totalRuns || stats.totalRuns === 0) {
    Renderer.drawText(t('stats_noData'), 200, 300, {
      font: 'bold 18px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
    });
    Renderer.drawText(t('stats_noDataSub'), 200, 330, {
      font: '14px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
    return;
  }

  // 고정 헤더 높이 이후부터 콘텐츠 시작
  const contentStartY = 106;

  switch (currentStatsTab) {
    case 0: renderOverviewTab(game, stats, ctx, contentStartY); break;
    case 1: renderSubjectTab(game, stats, ctx, contentStartY); break;
    case 2: renderAnalysisTab(game, stats, ctx, contentStartY); break;
  }
}

// ━━━ 탭0: 종합 ━━━
function renderOverviewTab(game, stats, ctx, startY) {
  let y = startY;
  const accuracy = stats.totalAnswers > 0
    ? Math.round((stats.totalCorrect / stats.totalAnswers) * 100) : 0;

  // ─── A. 트리플 링 히어로 ───
  Renderer.drawGradientCard(20, y, 360, 130, 14, '#1e1e2e', '#151520');
  Renderer.roundRect(20, y, 360, 130, 14, null, 'rgba(99,102,241,0.25)');

  const rings = [
    { cx: 80,  label: t('stats_accuracy'), value: accuracy, color: accuracy >= 70 ? '#22c55e' : '#fbbf24', r: 30, lw: 6 },
    { cx: 200, label: t('stats_winRate'),   value: stats.winRate, color: stats.winRate >= 60 ? '#22c55e' : stats.winRate >= 30 ? '#fbbf24' : '#ef4444', r: 40, lw: 8 },
    { cx: 320, label: t('bestCombo'),       value: stats.bestCombo, color: '#fbbf24', r: 30, lw: 6, isRaw: true },
  ];

  ctx.save();
  for (const ring of rings) {
    const cy = y + 58;
    const ratio = ring.isRaw ? Math.min(ring.value / 30, 1) : ring.value / 100;
    drawArcRing(ctx, ring.cx, cy, ring.r, ring.lw, ratio, ring.color);
    Renderer.drawText(ring.isRaw ? `${ring.value}` : `${ring.value}%`, ring.cx, cy - 8, {
      font: `bold ${ring.r >= 40 ? 20 : 16}px system-ui`, color: COLORS.TEXT_PRIMARY, align: 'center'
    });
    Renderer.drawText(ring.label, ring.cx, cy + 12, {
      font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
  }
  ctx.restore();

  y += 140;

  // ─── B. 승/패+연승 & 시간+플레이 (2열 카드) ───
  const dualW = 175;
  const dualH = 90;
  const dualGap = 10;

  // 좌측 카드: 승/패 + 연승
  Renderer.drawGradientCard(20, y, dualW, dualH, 10, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, dualW, dualH, 10, null, 'rgba(34,197,94,0.2)');
  Renderer.drawText('⚔️ ' + t('stats_wins') + '/' + t('stats_losses'), 108, y + 10, {
    font: 'bold 11px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
  });
  Renderer.drawText(`${stats.totalClears}`, 62, y + 38, {
    font: 'bold 22px system-ui', color: COLORS.SUCCESS, align: 'center'
  });
  Renderer.drawText(t('stats_wins'), 62, y + 58, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  Renderer.drawText(`${stats.totalFails}`, 140, y + 38, {
    font: 'bold 22px system-ui', color: COLORS.DANGER, align: 'center'
  });
  Renderer.drawText(t('stats_losses'), 140, y + 58, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  // 연승 (하단)
  Renderer.drawText(`🔥 ${stats.currentStreak}/${stats.bestStreak}`, 108, y + 76, {
    font: '10px system-ui', color: COLORS.WARNING, align: 'center'
  });

  // 우측 카드: 시간 + 플레이
  const rightX = 20 + dualW + dualGap;
  Renderer.drawGradientCard(rightX, y, dualW, dualH, 10, '#1a1a28', '#151520');
  Renderer.roundRect(rightX, y, dualW, dualH, 10, null, 'rgba(56,189,248,0.2)');
  Renderer.drawText('⏱️ ' + t('stats_time'), rightX + dualW / 2, y + 10, {
    font: 'bold 11px system-ui', color: '#38bdf8', align: 'center'
  });
  Renderer.drawText(formatDuration(stats.totalPlayTime), rightX + dualW / 2, y + 40, {
    font: 'bold 18px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
  });
  Renderer.drawText(t('stats_totalPlayTime'), rightX + dualW / 2, y + 60, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  Renderer.drawText(`${t('totalRuns')}: ${stats.totalRuns}`, rightX + dualW / 2, y + 76, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  y += dualH + 10;

  // ─── C. 골드 + 아이템 통합 카드 ───
  Renderer.drawGradientCard(20, y, 360, 80, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, 80, 14, null, 'rgba(251,191,36,0.15)');

  // 골드 (상단 크게)
  Renderer.drawText('💰', 45, y + 18, { font: '18px system-ui', align: 'center' });
  Renderer.drawText(`${(stats.totalGoldEarned || 0).toLocaleString()}G`, 200, y + 16, {
    font: 'bold 22px system-ui', color: '#fbbf24', align: 'center'
  });

  // 구분선
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(35, y + 42);
  ctx.lineTo(365, y + 42);
  ctx.stroke();
  ctx.restore();

  // 아이템 (1행 아이콘+숫자)
  const itemData = [
    { icon: '⏭️', value: stats.totalSkips || 0, color: COLORS.TEXT_PRIMARY },
    { icon: '💡', value: stats.totalHints || 0, color: '#fbbf24' },
    { icon: '⏰', value: stats.totalTimeBoosts || 0, color: '#38bdf8' },
    { icon: '🪶', value: stats.totalRevives || 0, color: COLORS.SUCCESS },
    { icon: '⏱️', value: stats.totalTimeouts || 0, color: COLORS.DANGER }
  ];

  const itemStartX = 40;
  const itemSpacing = 68;
  for (let i = 0; i < itemData.length; i++) {
    const ix = itemStartX + i * itemSpacing;
    const d = itemData[i];
    Renderer.drawText(`${d.icon}`, ix, y + 56, { font: '13px system-ui', align: 'center' });
    Renderer.drawText(`${d.value}`, ix + 22, y + 56, {
      font: 'bold 12px system-ui', color: d.color
    });
  }
  y += 90;

  const totalContentHeight = y + 40;
  game.scrollMaxY = Math.max(0, totalContentHeight - 700);
}

// ━━━ 탭1: 과목 ━━━
function renderSubjectTab(game, stats, ctx, startY) {
  let y = startY;

  // ─── A. 과목별 정답률 링+바 차트 (정답/오답 수 통합) ───
  const wrongSubjects = stats.wrongBySubject || {};
  const correctSubjects = stats.correctBySubject || {};

  Renderer.drawGradientCard(20, y, 360, 230, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, 230, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('📚 ' + t('stats_subjectPerf'), 40, y + 18, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  const subjectEntries = [
    { key: 'math', ...SUBJECTS.MATH },
    { key: 'english', ...SUBJECTS.ENGLISH },
    { key: 'korean', ...SUBJECTS.KOREAN },
    { key: 'science', ...SUBJECTS.SCIENCE }
  ];

  let sy = y + 50;
  for (const subj of subjectEntries) {
    const count = stats.bySubject?.[subj.key] || 0;
    const sa = stats.subjectAccuracy?.[subj.key];
    const subjAcc = (sa && sa.attempts > 0) ? Math.round((sa.correct / sa.attempts) * 100) : 0;
    const cCount = correctSubjects[subj.key] || 0;
    const wCount = wrongSubjects[subj.key] || 0;

    ctx.save();
    drawSmallRing(ctx, 52, sy + 12, 16, 4, subjAcc / 100, subj.color);
    Renderer.drawText(`${subjAcc}%`, 52, sy + 6, {
      font: 'bold 9px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
    });
    ctx.restore();

    Renderer.drawText(`${subj.icon} ${t(subj.nameKey)}`, 80, sy, {
      font: '12px system-ui', color: COLORS.TEXT_PRIMARY
    });
    // 정답/오답 수 표시
    Renderer.drawText(`✅${cCount} ❌${wCount}`, 355, sy, {
      font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
    });

    const maxSubjCount = Math.max(1, ...subjectEntries.map(s => stats.bySubject?.[s.key] || 0));
    const barMaxW = 170;
    const barW = count > 0 ? Math.max(5, barMaxW * count / maxSubjCount) : 0;
    Renderer.roundRect(150, sy + 16, barMaxW, 8, 4, 'rgba(255,255,255,0.06)');
    if (barW > 0) {
      Renderer.roundRect(150, sy + 16, barW, 8, 4, subj.color);
    }
    if (sa && sa.attempts > 0) {
      Renderer.drawText(`${sa.correct}/${sa.attempts}`, 355, sy + 18, {
        font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
      });
    }

    sy += 45;
  }
  y += 240;

  // ─── B. 유형별 오답률 TOP ───
  const subjectTopics = stats.subjectTopics || {};
  const subjectInfo = {
    math: SUBJECTS.MATH, english: SUBJECTS.ENGLISH,
    korean: SUBJECTS.KOREAN, science: SUBJECTS.SCIENCE
  };

  // 전 과목 유형을 모아서 오답률 기준 정렬
  const allTopicList = [];
  for (const [subj, topicMap] of Object.entries(subjectTopics)) {
    if (!topicMap) continue;
    for (const [topic, d] of Object.entries(topicMap)) {
      const attempts = d.attempts || 0;
      const correct = d.correct || 0;
      const wrong = attempts - correct;
      if (attempts >= 2 && wrong > 0) {
        const wrongRate = Math.round((wrong / attempts) * 100);
        allTopicList.push({
          topic, subject: subj, attempts, correct, wrong, wrongRate,
          icon: subjectInfo[subj]?.icon || '📝',
          color: subjectInfo[subj]?.color || COLORS.TEXT_PRIMARY
        });
      }
    }
  }
  allTopicList.sort((a, b) => b.wrongRate - a.wrongRate || b.wrong - a.wrong);
  const topItems = allTopicList.slice(0, 5);

  if (topItems.length > 0) {
    const topCardH = 44 + topItems.length * 30;
    Renderer.drawGradientCard(20, y, 360, topCardH, 14, '#1a1a28', '#151520');
    Renderer.roundRect(20, y, 360, topCardH, 14, null, 'rgba(239,68,68,0.25)');
    Renderer.drawText('🚨 ' + t('stats_weakTopics'), 40, y + 16, {
      font: 'bold 14px system-ui', color: COLORS.DANGER
    });

    let wy = y + 42;
    for (const item of topItems) {
      const label = item.topic.length > 6 ? item.topic.substring(0, 6) + '..' : item.topic;

      // 과목 아이콘 + 유형명
      Renderer.drawText(`${item.icon} ${label}`, 40, wy, {
        font: '12px system-ui', color: COLORS.TEXT_PRIMARY
      });

      // 오답률 바
      const barX = 155;
      const barMaxW = 120;
      const barW = Math.max(4, barMaxW * item.wrongRate / 100);
      Renderer.roundRect(barX, wy - 2, barMaxW, 10, 5, 'rgba(255,255,255,0.06)');
      Renderer.roundRect(barX, wy - 2, barW, 10, 5,
        item.wrongRate >= 60 ? COLORS.DANGER : item.wrongRate >= 40 ? COLORS.WARNING : 'rgba(239,68,68,0.4)');

      // 오답률 %
      Renderer.drawText(`${item.wrongRate}%`, 295, wy, {
        font: 'bold 12px system-ui',
        color: item.wrongRate >= 60 ? COLORS.DANGER : item.wrongRate >= 40 ? COLORS.WARNING : COLORS.TEXT_SECONDARY,
        align: 'center'
      });

      // 오답/시도
      Renderer.drawText(`❌${item.wrong}/${item.attempts}`, 355, wy, {
        font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
      });

      wy += 30;
    }
    y += topCardH + 10;
  }

  // ─── C. 과목별 문제유형 상세 ───

  for (const subj of subjectEntries) {
    const topicMap = subjectTopics[subj.key];
    if (!topicMap || Object.keys(topicMap).length === 0) continue;

    const topicList = Object.entries(topicMap)
      .map(([topic, d]) => ({
        topic,
        attempts: d.attempts || 0,
        correct: d.correct || 0,
        wrong: (d.attempts || 0) - (d.correct || 0)
      }))
      .filter(e => e.attempts > 0)
      .sort((a, b) => b.attempts - a.attempts);

    if (topicList.length === 0) continue;

    const headerH = 38;
    const rowH = 26;
    const cardH = headerH + topicList.length * rowH + 8;

    Renderer.drawGradientCard(20, y, 360, cardH, 14, '#1a1a28', '#151520');
    Renderer.roundRect(20, y, 360, cardH, 14, null, `${subj.color}33`);

    // 과목 헤더
    Renderer.drawText(`${subj.icon} ${t(subj.nameKey)} ${t('stats_topicDetail') || '유형별'}`, 40, y + 14, {
      font: 'bold 13px system-ui', color: subj.color
    });
    // 컬럼 헤더
    Renderer.drawText(t('stats_colAttempts') || '횟수', 218, y + 16, {
      font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
    Renderer.drawText(t('stats_colCorrectRate') || '정답률', 274, y + 16, {
      font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
    Renderer.drawText(t('stats_colWrongRate') || '오답률', 340, y + 16, {
      font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });

    let ty = y + headerH;
    for (const entry of topicList) {
      const label = entry.topic.length > 8 ? entry.topic.substring(0, 8) + '..' : entry.topic;
      const correctRate = Math.round((entry.correct / entry.attempts) * 100);
      const wrongRate = 100 - correctRate;

      // 유형명
      Renderer.drawText(label, 40, ty + 2, {
        font: '11px system-ui', color: COLORS.TEXT_PRIMARY
      });

      // 미니 바 (정답/오답 비율)
      const barX = 135;
      const barW = 60;
      const correctW = Math.max(0, barW * correctRate / 100);
      Renderer.roundRect(barX, ty, barW, 8, 4, 'rgba(255,255,255,0.06)');
      if (correctW > 0) Renderer.roundRect(barX, ty, Math.max(2, correctW), 8, 4, COLORS.SUCCESS);
      if (correctW < barW) Renderer.roundRect(barX + correctW, ty, Math.max(2, barW - correctW), 8, 4, COLORS.DANGER);

      // 푼 횟수
      Renderer.drawText(`${entry.attempts}`, 218, ty + 2, {
        font: 'bold 11px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
      });
      // 정답률
      Renderer.drawText(`${correctRate}%`, 274, ty + 2, {
        font: 'bold 11px system-ui', color: correctRate >= 70 ? COLORS.SUCCESS : COLORS.WARNING, align: 'center'
      });
      // 오답률
      Renderer.drawText(`${wrongRate}%`, 340, ty + 2, {
        font: 'bold 11px system-ui', color: wrongRate >= 50 ? COLORS.DANGER : COLORS.TEXT_SECONDARY, align: 'center'
      });

      ty += rowH;
    }
    y += cardH + 10;
  }

  const totalContentHeight = y + 40;
  game.scrollMaxY = Math.max(0, totalContentHeight - 700);
}

// ━━━ 탭2: 분석 ━━━
function renderAnalysisTab(game, stats, ctx, startY) {
  let y = startY;
  const recentRuns = stats.recentRuns || [];

  // ─── A. 최근 전적 그래프 (최상단) ───
  const graphCardH = recentRuns.length >= 2 ? 140 : 50;
  Renderer.drawGradientCard(20, y, 360, graphCardH, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, graphCardH, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('📈 ' + t('stats_recentBattle'), 40, y + 18, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });
  Renderer.drawText(`${t('stats_recentWinRate')}: ${stats.recentWinRate}%`, 355, y + 18, {
    font: '11px system-ui', color: stats.recentWinRate >= 50 ? COLORS.SUCCESS : COLORS.DANGER, align: 'right'
  });

  if (recentRuns.length >= 2) {
    const graphX = 45;
    const graphY = y + 40;
    const graphW = 330;
    const graphH = 80;

    Renderer.roundRect(graphX - 5, graphY - 5, graphW + 10, graphH + 10, 8, 'rgba(0,0,0,0.2)');

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

    const points = recentRuns.map((r, i) => ({
      x: graphX + (i / (recentRuns.length - 1)) * graphW,
      y: graphY + graphH - (graphH * r.accuracy / 100)
    }));

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

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = COLORS.ACCENT_LIGHT;
    ctx.lineWidth = 2;
    ctx.stroke();

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
  y += graphCardH + 10;

  // ─── B. 최근 런 목록 ───
  const displayRuns = recentRuns.slice(-5).reverse();
  if (displayRuns.length > 0) {
    const runHeaderH = 18;
    const runListH = 30 + runHeaderH + displayRuns.length * 24;
    Renderer.drawGradientCard(20, y, 360, runListH, 14, '#1a1a28', '#151520');
    Renderer.roundRect(20, y, 360, runListH, 14, null, 'rgba(99,102,241,0.15)');

    // 컬럼 헤더
    const hdrY = y + 14;
    Renderer.drawText(t('stats_colDate') || '날짜', 60, hdrY, {
      font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
    Renderer.drawText(t('stats_colCorrectRate') || '정답률', 180, hdrY, {
      font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
    Renderer.drawText(t('stats_colCombo') || '콤보', 240, hdrY, {
      font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
    Renderer.drawText(t('stats_colGold') || '골드', 300, hdrY, {
      font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
    Renderer.drawText(t('stats_colTime') || '시간', 360, hdrY, {
      font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
    });

    let ry = y + 14 + runHeaderH;
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
    y += runListH + 10;
  }

  // ─── C. 난이도별 통합 (정답률 + 오답 수 한 카드) ───
  const diffLabels = [
    { key: 1, name: t('easy'), color: COLORS.SUCCESS, gradStart: '#16a34a', gradEnd: '#22c55e' },
    { key: 2, name: t('normal'), color: COLORS.WARNING, gradStart: '#d97706', gradEnd: '#fbbf24' },
    { key: 3, name: t('hard'), color: COLORS.DANGER, gradStart: '#dc2626', gradEnd: '#ef4444' }
  ];
  const wrongByDiff = stats.wrongByDifficulty || {};

  Renderer.drawGradientCard(20, y, 360, 155, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, 155, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('🎯 ' + t('stats_diffAnalysis'), 40, y + 18, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  let dy = y + 45;
  for (const diff of diffLabels) {
    const count = stats.byDifficulty?.[diff.key] || 0;
    const da = stats.difficultyAccuracy?.[diff.key];
    const diffAcc = (da && da.attempts > 0) ? Math.round((da.correct / da.attempts) * 100) : 0;
    const wrongCnt = wrongByDiff[diff.key] || 0;

    Renderer.drawText(diff.name, 40, dy, { font: 'bold 12px system-ui', color: diff.color });

    // 문제 수 + 오답 수
    Renderer.drawText(`${count}`, 100, dy, { font: '11px system-ui', color: COLORS.TEXT_SECONDARY });
    if (wrongCnt > 0) {
      Renderer.drawText(`(❌${wrongCnt})`, 120, dy, { font: '10px system-ui', color: COLORS.DANGER });
    }

    // 바
    const barMaxW = 160;
    const maxDiffCount = Math.max(1, ...diffLabels.map(d => stats.byDifficulty?.[d.key] || 0));
    const barW = count > 0 ? Math.max(5, barMaxW * count / maxDiffCount) : 0;

    Renderer.roundRect(165, dy - 4, barMaxW, 12, 6, 'rgba(255,255,255,0.06)');
    if (barW > 0) {
      const gradient = ctx.createLinearGradient(165, 0, 165 + barW, 0);
      gradient.addColorStop(0, diff.gradStart);
      gradient.addColorStop(1, diff.gradEnd);
      Renderer.roundRect(165, dy - 4, barW, 12, 6, gradient);
    }

    Renderer.drawText(`${diffAcc}%`, 365, dy, {
      font: 'bold 12px system-ui', color: diffAcc >= 70 ? COLORS.SUCCESS : diffAcc >= 40 ? COLORS.WARNING : COLORS.DANGER, align: 'right'
    });

    dy += 34;
  }
  y += 165;

  // ─── D. 심화 통계 ───
  Renderer.drawGradientCard(20, y, 360, 132, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, 132, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('🔬 ' + t('stats_advanced'), 40, y + 18, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  const advStats = [
    { label: t('stats_avgAccuracy'), value: `${stats.avgAccuracy}%`, color: COLORS.SUCCESS },
    { label: t('stats_avgGoldPerRun'), value: `${stats.avgGoldPerRun}G`, color: '#fbbf24' },
    { label: t('stats_shortestClear'), value: formatDuration(stats.shortestClear), color: '#38bdf8' },
    { label: t('stats_longestRun'), value: formatDuration(stats.longestRun), color: COLORS.TEXT_SECONDARY },
    { label: t('stats_totalDefeated'), value: `${stats.totalDefeated}`, color: COLORS.DANGER }
  ];

  let ay = y + 40;
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
  y += 142;

  const totalContentHeight = y + 40;
  game.scrollMaxY = Math.max(0, totalContentHeight - 700);
}
