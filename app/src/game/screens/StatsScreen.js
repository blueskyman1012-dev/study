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

  // ─── A. 히어로 배너 ───
  Renderer.drawGradientCard(20, y, 360, 180, 14, '#1e1e2e', '#151520');
  Renderer.roundRect(20, y, 360, 180, 14, null, 'rgba(99,102,241,0.3)');

  ctx.save();
  drawArcRing(ctx, 200, y + 85, 45, 10, stats.winRate / 100,
    stats.winRate >= 60 ? COLORS.SUCCESS : stats.winRate >= 30 ? COLORS.WARNING : COLORS.DANGER);
  Renderer.drawText(`${stats.winRate}%`, 200, y + 73, {
    font: 'bold 22px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
  });
  Renderer.drawText(t('stats_winRate'), 200, y + 100, {
    font: '11px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  ctx.restore();

  // 3열 요약
  const summaryY = y + 150;
  Renderer.drawText(`${stats.totalRuns}`, 80, summaryY, {
    font: 'bold 18px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center'
  });
  Renderer.drawText(t('totalRuns'), 80, summaryY + 20, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  Renderer.drawText(`${accuracy}%`, 200, summaryY, {
    font: 'bold 18px system-ui', color: accuracy >= 70 ? COLORS.SUCCESS : COLORS.WARNING, align: 'center'
  });
  Renderer.drawText(t('stats_accuracy'), 200, summaryY + 20, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  Renderer.drawText(`${stats.bestCombo}`, 320, summaryY, {
    font: 'bold 18px system-ui', color: COLORS.WARNING, align: 'center'
  });
  Renderer.drawText(t('bestCombo'), 320, summaryY + 20, {
    font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  y += 190;

  // ─── B. 연승 & 시간 ───
  // 왼쪽: 연승
  Renderer.drawGradientCard(20, y, 172, 90, 12, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 172, 90, 12, null, 'rgba(251,191,36,0.2)');
  Renderer.drawText('🔥 ' + t('stats_streak'), 106, y + 15, {
    font: 'bold 12px system-ui', color: COLORS.WARNING, align: 'center'
  });
  Renderer.drawText(`${stats.currentStreak}`, 66, y + 45, {
    font: 'bold 22px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
  });
  Renderer.drawText(t('stats_currentStreak'), 66, y + 70, {
    font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  Renderer.drawText(`${stats.bestStreak}`, 146, y + 45, {
    font: 'bold 22px system-ui', color: COLORS.WARNING, align: 'center'
  });
  Renderer.drawText(t('stats_bestStreak'), 146, y + 70, {
    font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });

  // 오른쪽: 시간
  Renderer.drawGradientCard(208, y, 172, 90, 12, '#1a1a28', '#151520');
  Renderer.roundRect(208, y, 172, 90, 12, null, 'rgba(56,189,248,0.2)');
  Renderer.drawText('⏱️ ' + t('stats_time'), 294, y + 15, {
    font: 'bold 12px system-ui', color: '#38bdf8', align: 'center'
  });
  Renderer.drawText(formatDuration(stats.totalPlayTime), 294, y + 45, {
    font: 'bold 16px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
  });
  Renderer.drawText(t('stats_totalPlayTime'), 294, y + 70, {
    font: '9px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  y += 100;

  // ─── C. 플레이 기록 2x2 ───
  Renderer.drawText('🏆 ' + t('stats_playStats'), 40, y + 15, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

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
    const my = y + 37 + row * 52;
    const card = miniCards[i];

    Renderer.drawGradientCard(mx, my, 172, 46, 10, '#1a1a28', '#151520');
    Renderer.drawText(`${card.icon} ${card.label}`, mx + 12, my + 10, {
      font: '10px system-ui', color: COLORS.TEXT_SECONDARY
    });
    Renderer.drawText(card.value, mx + 160, my + 10, {
      font: 'bold 16px system-ui', color: card.color, align: 'right'
    });
  }
  y += 145;

  // ─── D. 아이템 사용 통계 ───
  Renderer.drawGradientCard(20, y, 360, 120, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, 120, 14, null, 'rgba(251,191,36,0.2)');
  Renderer.drawText('🎒 ' + t('stats_itemUsage'), 40, y + 18, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  const itemData = [
    { icon: '⏭️', label: t('stats_skipTotal'), value: stats.totalSkips || 0, color: COLORS.TEXT_PRIMARY },
    { icon: '💡', label: t('stats_hintTotal'), value: stats.totalHints || 0, color: '#fbbf24' },
    { icon: '⏰', label: t('stats_timeBoostTotal'), value: stats.totalTimeBoosts || 0, color: '#38bdf8' },
    { icon: '🪶', label: t('stats_reviveTotal'), value: stats.totalRevives || 0, color: COLORS.SUCCESS },
    { icon: '⏱️', label: t('stats_timeoutTotal'), value: stats.totalTimeouts || 0, color: COLORS.DANGER }
  ];

  for (let i = 0; i < itemData.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const ix = 40 + col * 115;
    const iy = y + 42 + row * 36;
    const d = itemData[i];
    Renderer.drawText(`${d.icon} ${d.label}`, ix, iy, { font: '10px system-ui', color: COLORS.TEXT_SECONDARY });
    Renderer.drawText(`${d.value}`, ix + 95, iy, { font: 'bold 13px system-ui', color: d.color, align: 'right' });
  }
  y += 130;

  const totalContentHeight = y + 40;
  game.scrollMaxY = Math.max(0, totalContentHeight - 700);
}

// ━━━ 탭1: 과목 ━━━
function renderSubjectTab(game, stats, ctx, startY) {
  let y = startY;

  // ─── A. 과목별 정답률 링+바 차트 ───
  Renderer.drawGradientCard(20, y, 360, 220, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, 220, 14, null, 'rgba(99,102,241,0.2)');
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

    ctx.save();
    drawSmallRing(ctx, 52, sy + 12, 16, 4, subjAcc / 100, subj.color);
    Renderer.drawText(`${subjAcc}%`, 52, sy + 6, {
      font: 'bold 9px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
    });
    ctx.restore();

    Renderer.drawText(`${subj.icon} ${t(subj.nameKey)}`, 80, sy, {
      font: '12px system-ui', color: COLORS.TEXT_PRIMARY
    });
    Renderer.drawText(`${count}`, 355, sy, {
      font: 'bold 12px system-ui', color: COLORS.TEXT_SECONDARY, align: 'right'
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
  y += 230;

  // ─── B. 과목별 오답 분석 (정답/오답 바) ───
  const wrongSubjects = stats.wrongBySubject || {};
  const correctSubjects = stats.correctBySubject || {};
  const allAnalysisSubjects = new Set([...Object.keys(wrongSubjects), ...Object.keys(correctSubjects)]);

  if (allAnalysisSubjects.size > 0) {
    const subjH = 45 + allAnalysisSubjects.size * 34;
    Renderer.drawGradientCard(20, y, 360, subjH, 14, '#1a1a28', '#151520');
    Renderer.roundRect(20, y, 360, subjH, 14, null, 'rgba(239,68,68,0.2)');
    Renderer.drawText('📊 ' + t('stats_wrongBySubject'), 40, y + 18, {
      font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
    });

    const subjectInfo = {
      math: SUBJECTS.MATH, english: SUBJECTS.ENGLISH,
      korean: SUBJECTS.KOREAN, science: SUBJECTS.SCIENCE
    };

    let wy = y + 42;
    for (const subj of allAnalysisSubjects) {
      const info = subjectInfo[subj];
      const icon = info?.icon || '📝';
      const name = t(info?.nameKey || subj);
      const cCount = correctSubjects[subj] || 0;
      const wCount = wrongSubjects[subj] || 0;
      const totalSubj = cCount + wCount;
      const wrongRate = totalSubj > 0 ? Math.round((wCount / totalSubj) * 100) : 0;

      Renderer.drawText(`${icon} ${name}`, 40, wy, { font: '12px system-ui', color: COLORS.TEXT_PRIMARY });

      const barX = 130;
      const barMaxW = 130;
      const barTotal = Math.max(1, totalSubj);
      const correctBarW = Math.max(0, barMaxW * cCount / barTotal);
      const wrongBarW = Math.max(0, barMaxW * wCount / barTotal);

      Renderer.roundRect(barX, wy - 4, barMaxW, 10, 5, 'rgba(255,255,255,0.06)');
      if (correctBarW > 0) Renderer.roundRect(barX, wy - 4, correctBarW, 10, 5, COLORS.SUCCESS);
      if (wrongBarW > 0) Renderer.roundRect(barX + correctBarW, wy - 4, wrongBarW, 10, 5, COLORS.DANGER);

      Renderer.drawText(`✅${cCount} ❌${wCount}`, 280, wy - 2, { font: '9px system-ui', color: COLORS.TEXT_SECONDARY });
      Renderer.drawText(`${wrongRate}%`, 355, wy - 2, {
        font: 'bold 10px system-ui', color: wrongRate >= 50 ? COLORS.DANGER : COLORS.WARNING, align: 'right'
      });

      wy += 34;
    }
    y += subjH + 10;
  }

  // ─── C. 유형(topic)별 오답 TOP8 ───
  const wrongTopics = stats.wrongByTopic || {};
  const correctTopics = stats.correctByTopic || {};
  const allTopics = new Set([...Object.keys(wrongTopics), ...Object.keys(correctTopics)]);

  if (allTopics.size > 0) {
    const topicEntries = [...allTopics].map(topic => ({
      topic,
      correct: correctTopics[topic] || 0,
      wrong: wrongTopics[topic] || 0
    })).sort((a, b) => b.wrong - a.wrong).slice(0, 8);

    const topicH = 45 + topicEntries.length * 28;
    Renderer.drawGradientCard(20, y, 360, topicH, 14, '#1a1a28', '#151520');
    Renderer.roundRect(20, y, 360, topicH, 14, null, 'rgba(168,85,247,0.2)');
    Renderer.drawText('📝 ' + t('stats_topicAnalysis'), 40, y + 18, {
      font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
    });

    let ty = y + 42;
    for (const entry of topicEntries) {
      const label = entry.topic.length > 10 ? entry.topic.substring(0, 10) + '..' : entry.topic;
      const totalT = entry.correct + entry.wrong;
      const wrongRate = totalT > 0 ? Math.round((entry.wrong / totalT) * 100) : 0;

      Renderer.drawText(label, 40, ty, { font: '11px system-ui', color: COLORS.TEXT_PRIMARY });
      Renderer.drawText(`✅${entry.correct}`, 210, ty, { font: '10px system-ui', color: COLORS.SUCCESS, align: 'center' });
      Renderer.drawText(`❌${entry.wrong}`, 270, ty, { font: '10px system-ui', color: COLORS.DANGER, align: 'center' });
      Renderer.drawText(`${wrongRate}%`, 355, ty, {
        font: 'bold 10px system-ui', color: wrongRate >= 50 ? COLORS.DANGER : COLORS.WARNING, align: 'right'
      });

      ty += 28;
    }
    y += topicH + 10;
  }

  const totalContentHeight = y + 40;
  game.scrollMaxY = Math.max(0, totalContentHeight - 700);
}

// ━━━ 탭2: 분석 ━━━
function renderAnalysisTab(game, stats, ctx, startY) {
  let y = startY;

  // ─── A. 난이도별 정답률 + 문제수 그래디언트 바 ───
  Renderer.drawGradientCard(20, y, 360, 160, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, 160, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('🎯 ' + t('stats_diffAnalysis'), 40, y + 18, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  const diffLabels = [
    { key: 1, name: t('easy'), color: COLORS.SUCCESS, gradStart: '#16a34a', gradEnd: '#22c55e' },
    { key: 2, name: t('normal'), color: COLORS.WARNING, gradStart: '#d97706', gradEnd: '#fbbf24' },
    { key: 3, name: t('hard'), color: COLORS.DANGER, gradStart: '#dc2626', gradEnd: '#ef4444' }
  ];

  let dy = y + 48;
  for (const diff of diffLabels) {
    const count = stats.byDifficulty?.[diff.key] || 0;
    const da = stats.difficultyAccuracy?.[diff.key];
    const diffAcc = (da && da.attempts > 0) ? Math.round((da.correct / da.attempts) * 100) : 0;

    Renderer.drawText(diff.name, 40, dy, { font: 'bold 12px system-ui', color: diff.color });
    Renderer.drawText(`${count}`, 120, dy, { font: '12px system-ui', color: COLORS.TEXT_SECONDARY });

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

    Renderer.drawText(`${diffAcc}%`, 355, dy, {
      font: 'bold 12px system-ui', color: diffAcc >= 70 ? COLORS.SUCCESS : diffAcc >= 40 ? COLORS.WARNING : COLORS.DANGER, align: 'right'
    });

    dy += 38;
  }
  y += 170;

  // ─── B. 난이도별 오답 바 ───
  const wrongByDiff = stats.wrongByDifficulty || {};
  if (Object.keys(wrongByDiff).length > 0) {
    const diffH = 45 + Object.keys(wrongByDiff).length * 30;
    Renderer.drawGradientCard(20, y, 360, diffH, 14, '#1a1a28', '#151520');
    Renderer.roundRect(20, y, 360, diffH, 14, null, 'rgba(239,68,68,0.15)');
    Renderer.drawText('🎯 ' + t('stats_diffWrong'), 40, y + 18, {
      font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
    });

    const diffNames = { '1': t('easy'), '2': t('normal'), '3': t('hard') };
    const diffColors = { '1': COLORS.SUCCESS, '2': COLORS.WARNING, '3': COLORS.DANGER };
    const maxWrong = Math.max(1, ...Object.values(wrongByDiff));

    let dfy = y + 42;
    for (const diff of ['1', '2', '3']) {
      const cnt = wrongByDiff[diff];
      if (cnt === undefined) continue;

      Renderer.drawText(diffNames[diff] || diff, 50, dfy, {
        font: 'bold 12px system-ui', color: diffColors[diff] || COLORS.TEXT_SECONDARY
      });

      const barMaxW = 180;
      const barW = Math.max(5, barMaxW * cnt / maxWrong);
      Renderer.roundRect(120, dfy - 4, barMaxW, 12, 6, 'rgba(255,255,255,0.06)');
      Renderer.roundRect(120, dfy - 4, barW, 12, 6, diffColors[diff] || COLORS.DANGER);

      Renderer.drawText(`${cnt}`, 320, dfy, {
        font: 'bold 12px system-ui', color: diffColors[diff] || COLORS.DANGER, align: 'center'
      });

      dfy += 30;
    }
    y += diffH + 10;
  }

  // ─── C. 심화 통계 ───
  Renderer.drawGradientCard(20, y, 360, 140, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, 140, 14, null, 'rgba(99,102,241,0.2)');
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

  let ay = y + 45;
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
  y += 150;

  // ─── D. 최근 전적 그래프 + 런 목록 ───
  Renderer.drawGradientCard(20, y, 360, 280, 14, '#1a1a28', '#151520');
  Renderer.roundRect(20, y, 360, 280, 14, null, 'rgba(99,102,241,0.2)');
  Renderer.drawText('📈 ' + t('stats_recentBattle'), 40, y + 18, {
    font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT
  });

  Renderer.drawText(`${t('stats_recentWinRate')}: ${stats.recentWinRate}%`, 355, y + 18, {
    font: '11px system-ui', color: stats.recentWinRate >= 50 ? COLORS.SUCCESS : COLORS.DANGER, align: 'right'
  });

  const recentRuns = stats.recentRuns || [];

  if (recentRuns.length >= 2) {
    const graphX = 45;
    const graphY = y + 45;
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

  // 최근 런 목록
  let ry = y + 140;
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
  y += 290;

  const totalContentHeight = y + 40;
  game.scrollMaxY = Math.max(0, totalContentHeight - 700);
}
