// 결과 화면 렌더링
import { Renderer } from '../../canvas/Renderer.js';
import { SCREENS, GAME_CONFIG, COLORS, SUBJECTS } from '../../utils/constants.js';
import { t } from '../../i18n/i18n.js';

export function renderResultScreen(game) {
  Renderer.drawGrid();

  const isWin = game.currentRun?.result === 'clear';
  const title = isWin ? t('cleared') : t('failed');
  const titleColor = isWin ? COLORS.SUCCESS : COLORS.DANGER;
  const run = game.currentRun;
  const ctx = Renderer.ctx;

  // 과목별/유형별 데이터 준비
  const correctBySubject = run?.correctBySubject || {};
  const wrongBySubject = run?.wrongBySubject || {};
  const allSubjects = new Set([...Object.keys(correctBySubject), ...Object.keys(wrongBySubject)]);
  const wrongByTopic = run?.wrongByTopic || {};
  const correctByTopic = run?.correctByTopic || {};
  const allTopics = new Set([...Object.keys(wrongByTopic), ...Object.keys(correctByTopic)]);
  const wrongByDiff = run?.wrongByDifficulty || {};
  const hasDiffData = Object.keys(wrongByDiff).length > 0;

  // 카드 높이 동적 계산 (구분선/패딩 포함)
  let cardH = 200; // 기본 통계 5줄
  cardH += 80;     // 아이템 사용 섹션
  if (allSubjects.size > 0) cardH += 25 + allSubjects.size * 20;
  if (allTopics.size > 0) cardH += 35 + Math.min(allTopics.size, 5) * 18;
  if (hasDiffData) cardH += 35 + Object.keys(wrongByDiff).length * 18;

  // 전체 콘텐츠 높이 = 타이틀(55) + 카드여백(90) + 카드 + 버튼(65)
  const totalContentH = 90 + cardH + 65;
  game.scrollMaxY = Math.max(0, totalContentH - GAME_CONFIG.CANVAS_HEIGHT);
  const scrollY = game.scrollY || 0;

  Renderer.drawText(title, 200, 55 - scrollY, { font: 'bold 28px system-ui', color: titleColor, align: 'center' });

  // 메인 카드
  Renderer.roundRect(25, 90 - scrollY, 350, cardH, 16, COLORS.BG_CARD);

  let y = 115 - scrollY;

  // 기존 통계
  Renderer.drawText(`${t('stageLabel')}: ${game.stage}/${GAME_CONFIG.STAGES_PER_DUNGEON}`, 200, y, {
    font: '14px system-ui', align: 'center'
  });
  y += 28;
  Renderer.drawText(`${t('defeatedMonsters')}: ${run?.defeatedMonsters?.length || 0}`, 200, y, {
    font: '14px system-ui', align: 'center'
  });
  y += 28;
  Renderer.drawText(`${t('bestCombo')}: ${run?.bestCombo || 0}`, 200, y, {
    font: '14px system-ui', align: 'center'
  });
  y += 28;

  const correct = run?.correctAnswers || 0;
  const total = run?.totalAnswers || 0;
  const accuracyPercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  Renderer.drawText(`${t('accuracyLabel')}: ${accuracyPercent}% (${correct}/${total})`, 200, y, {
    font: '14px system-ui', align: 'center'
  });
  y += 28;

  Renderer.drawText(`${t('earnedGold')}: +${run?.earnedGold || 0}G`, 200, y, {
    font: 'bold 16px system-ui', color: COLORS.WARNING, align: 'center'
  });
  y += 22;

  // ── 구분선: 아이템 사용 ──
  _drawDivider(ctx, 50, y, 300);
  y += 15;

  Renderer.drawText(t('result_itemUsage'), 200, y, {
    font: 'bold 12px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center'
  });
  y += 20;

  const skipCount = run?.skipCount || 0;
  const hintCount = run?.hintCount || 0;
  const timeBoostCount = run?.timeBoostCount || 0;
  const reviveCount = run?.reviveCount || 0;
  const timeoutCount = run?.timeoutCount || 0;

  Renderer.drawText(`⏭️${skipCount}`, 65, y, { font: '11px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  Renderer.drawText(`💡${hintCount}`, 135, y, { font: '11px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  Renderer.drawText(`⏰${timeBoostCount}`, 205, y, { font: '11px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  Renderer.drawText(`🪶${reviveCount}`, 275, y, { font: '11px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  Renderer.drawText(`⏱️${timeoutCount}`, 340, y, { font: '11px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  y += 20;

  // ── 과목별 정답/오답 ──
  if (allSubjects.size > 0) {
    _drawDivider(ctx, 50, y, 300);
    y += 15;

    const subjectInfo = {
      math: SUBJECTS.MATH, english: SUBJECTS.ENGLISH,
      korean: SUBJECTS.KOREAN, science: SUBJECTS.SCIENCE
    };

    for (const subj of allSubjects) {
      const info = subjectInfo[subj];
      const icon = info?.icon || '📝';
      const name = t(info?.nameKey || subj);
      const c = correctBySubject[subj] || 0;
      const w = wrongBySubject[subj] || 0;

      Renderer.drawText(`${icon}${name}`, 55, y, { font: '11px system-ui', color: COLORS.TEXT_PRIMARY });
      Renderer.drawText(`✅${c}`, 220, y, { font: '11px system-ui', color: COLORS.SUCCESS, align: 'center' });
      Renderer.drawText(`❌${w}`, 290, y, { font: '11px system-ui', color: COLORS.DANGER, align: 'center' });

      const totalS = c + w;
      if (totalS > 0) {
        const rate = Math.round((c / totalS) * 100);
        Renderer.drawText(`${rate}%`, 345, y, { font: 'bold 11px system-ui', color: rate >= 70 ? COLORS.SUCCESS : COLORS.WARNING, align: 'right' });
      }
      y += 20;
    }
  }

  // ── 유형(topic)별 오답 ──
  if (allTopics.size > 0) {
    _drawDivider(ctx, 50, y, 300);
    y += 15;

    Renderer.drawText(t('stats_topicAnalysis'), 200, y, {
      font: 'bold 11px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center'
    });
    y += 16;

    // 오답 많은 순 정렬, 최대 5개
    const topicEntries = [...allTopics].map(topic => ({
      topic,
      correct: correctByTopic[topic] || 0,
      wrong: wrongByTopic[topic] || 0
    })).sort((a, b) => b.wrong - a.wrong).slice(0, 5);

    for (const entry of topicEntries) {
      const label = entry.topic.length > 8 ? entry.topic.substring(0, 8) + '..' : entry.topic;
      Renderer.drawText(label, 55, y, { font: '10px system-ui', color: COLORS.TEXT_PRIMARY });
      Renderer.drawText(`✅${entry.correct}`, 210, y, { font: '10px system-ui', color: COLORS.SUCCESS, align: 'center' });
      Renderer.drawText(`❌${entry.wrong}`, 270, y, { font: '10px system-ui', color: COLORS.DANGER, align: 'center' });
      const totalT = entry.correct + entry.wrong;
      const wrongRate = totalT > 0 ? Math.round((entry.wrong / totalT) * 100) : 0;
      Renderer.drawText(`${t('stats_wrongRate')}${wrongRate}%`, 345, y, {
        font: 'bold 10px system-ui', color: wrongRate >= 50 ? COLORS.DANGER : COLORS.TEXT_SECONDARY, align: 'right'
      });
      y += 18;
    }
  }

  // ── 난이도별 오답 ──
  if (hasDiffData) {
    _drawDivider(ctx, 50, y, 300);
    y += 15;

    Renderer.drawText(t('stats_diffWrong'), 200, y, {
      font: 'bold 11px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center'
    });
    y += 16;

    const diffNames = { '1': t('easy'), '2': t('normal'), '3': t('hard') };
    const diffColors = { '1': COLORS.SUCCESS, '2': COLORS.WARNING, '3': COLORS.DANGER };

    for (const [diff, cnt] of Object.entries(wrongByDiff).sort((a, b) => Number(b[0]) - Number(a[0]))) {
      Renderer.drawText(`${diffNames[diff] || diff}`, 100, y, {
        font: '11px system-ui', color: diffColors[diff] || COLORS.TEXT_SECONDARY, align: 'center'
      });
      Renderer.drawText(`❌ ${cnt}`, 250, y, {
        font: 'bold 11px system-ui', color: COLORS.DANGER, align: 'center'
      });
      y += 18;
    }
  }

  // 메인 버튼
  const btnY = 90 + cardH + 15 - scrollY;
  Renderer.drawButton(100, btnY, 200, 50, t('toMain'), { bgColor: COLORS.ACCENT });
  game.registerClickArea('toMain', 100, btnY, 200, 50, () => { game.changeScreen(SCREENS.MAIN); });
}

function _drawDivider(ctx, x, y, w) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.restore();
}
