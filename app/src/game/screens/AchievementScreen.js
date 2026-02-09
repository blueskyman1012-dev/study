// 업적 화면 렌더링 (스크롤 지원)
import { Renderer } from '../../canvas/Renderer.js';
import { SCREENS, COLORS, ACHIEVEMENTS } from '../../utils/constants.js';
import { t } from '../../i18n/i18n.js';

function formatReward(reward) {
  const parts = [];
  if (reward.gold) parts.push(`${reward.gold}G`);
  if (reward.exp) parts.push(`${reward.exp}EXP`);
  return parts.join(' +');
}

function getProgress(achv, player) {
  const c = achv.condition;
  if (!c) return null;
  switch (c.type) {
    case 'combo': return { current: player.stats?.bestCombo || 0, target: c.value };
    case 'clear': return { current: player.stats?.totalClears || 0, target: c.value };
    case 'level': return { current: player.level || 1, target: c.value };
    case 'gold': return { current: player.totalGoldEarned || 0, target: c.value };
    case 'kills': return { current: player.stats?.totalKills || 0, target: c.value };
    case 'subject': return { current: player.subjectCounts?.[c.value] || 0, target: c.count };
    case 'answers': return { current: player.totalCorrectAnswers || 0, target: c.value };
    case 'damage': return { current: player._cachedDamage || 0, target: c.value };
    case 'hp': return { current: player._cachedMaxHp || 0, target: c.value };
    default: return null;
  }
}

export function renderAchievementScreen(game) {
  Renderer.drawGrid();

  const player = game.playerManager.player;
  player._cachedDamage = game.playerManager.getTotalDamage();
  player._cachedMaxHp = game.playerManager.getTotalMaxHp();
  const achievements = player.achievements || {};
  const dailyMissions = player.dailyMissions?.missions || [];

  // 주간 미션이 없으면 즉시 초기화
  if (!player.weeklyMissions?.missions?.length) {
    game.achievementManager.initWeeklyMissions();
  }
  const weeklyMissions = player.weeklyMissions?.missions || [];

  // 헤더
  Renderer.roundRect(0, 0, 400, 60, 0, COLORS.BG_SECONDARY);
  Renderer.drawText(t('achievementTitle'), 200, 20, { font: 'bold 18px system-ui', align: 'center' });
  Renderer.drawText(t('back'), 30, 22, { font: '14px system-ui', color: COLORS.ACCENT_LIGHT });
  game.registerClickArea('back', 10, 10, 80, 40, () => game.changeScreen(SCREENS.MAIN));

  let y = 75;

  // === 일일 미션 섹션 ===
  Renderer.drawText(t('dailyMissionTitle'), 200, y + 8, { font: 'bold 16px system-ui', color: COLORS.WARNING, align: 'center' });
  y += 30;

  for (let i = 0; i < dailyMissions.length; i++) {
    const m = dailyMissions[i];
    const cardH = 60;
    Renderer.roundRect(20, y, 360, cardH, 12, COLORS.BG_CARD);

    // 미션 이름
    Renderer.drawText(t(m.nameKey), 35, y + 15, { font: 'bold 13px system-ui', color: COLORS.TEXT_PRIMARY });

    // 진행바
    const barW = 200;
    const barX = 35;
    const barY = y + 32;
    Renderer.roundRect(barX, barY, barW, 10, 5, COLORS.BG_SECONDARY);
    const progress = Math.min(m.progress / m.target, 1);
    if (progress > 0) {
      Renderer.roundRect(barX, barY, Math.max(6, barW * progress), 10, 5, m.completed ? COLORS.SUCCESS : COLORS.ACCENT);
    }
    Renderer.drawText(`${m.progress}/${m.target}`, barX + barW + 10, barY + 2, {
      font: '11px system-ui', color: COLORS.TEXT_SECONDARY
    });

    // 보상 & 수령 버튼
    const btnX = 300;
    const btnY = y + 10;
    if (m.claimed) {
      Renderer.drawText(t('claimed'), btnX + 30, btnY + 18, {
        font: '12px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
      });
    } else if (m.completed) {
      Renderer.roundRect(btnX, btnY, 70, 32, 8, COLORS.SUCCESS);
      Renderer.drawText(formatReward(m.reward), btnX + 35, btnY + 10, {
        font: 'bold 11px system-ui', color: '#fff', align: 'center'
      });
      const idx = i;
      game.registerClickArea('claimDaily_' + i, btnX, btnY, 70, 32, () => {
        if (game.achievementManager.claimDailyReward(idx)) {
          game.render();
        }
      });
    } else {
      Renderer.drawText(formatReward(m.reward), btnX + 35, btnY + 18, {
        font: '11px system-ui', color: COLORS.WARNING, align: 'center'
      });
    }

    y += cardH + 8;
  }

  y += 15;

  // === 주간 미션 섹션 ===
  Renderer.drawText(t('weeklyMissionTitle'), 200, y + 8, { font: 'bold 16px system-ui', color: '#a78bfa', align: 'center' });
  y += 30;

  if (weeklyMissions.length === 0) {
    Renderer.drawText('주간 미션 로딩 중...', 200, y + 10, { font: '13px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
    y += 30;
  }

  for (let i = 0; i < weeklyMissions.length; i++) {
    const m = weeklyMissions[i];
    const cardH = 60;
    Renderer.roundRect(20, y, 360, cardH, 12, COLORS.BG_CARD);

    Renderer.drawText(t(m.nameKey), 35, y + 15, { font: 'bold 13px system-ui', color: COLORS.TEXT_PRIMARY });

    const barW = 200;
    const barX = 35;
    const barY = y + 32;
    Renderer.roundRect(barX, barY, barW, 10, 5, COLORS.BG_SECONDARY);
    const progress = Math.min(m.progress / m.target, 1);
    if (progress > 0) {
      Renderer.roundRect(barX, barY, Math.max(6, barW * progress), 10, 5, m.completed ? COLORS.SUCCESS : '#a78bfa');
    }
    Renderer.drawText(`${m.progress}/${m.target}`, barX + barW + 10, barY + 2, {
      font: '11px system-ui', color: COLORS.TEXT_SECONDARY
    });

    const btnX = 300;
    const btnY = y + 10;
    if (m.claimed) {
      Renderer.drawText(t('claimed'), btnX + 30, btnY + 18, {
        font: '12px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
      });
    } else if (m.completed) {
      Renderer.roundRect(btnX, btnY, 70, 32, 8, COLORS.SUCCESS);
      Renderer.drawText(formatReward(m.reward), btnX + 35, btnY + 10, {
        font: 'bold 11px system-ui', color: '#fff', align: 'center'
      });
      const idx = i;
      game.registerClickArea('claimWeekly_' + i, btnX, btnY, 70, 32, () => {
        if (game.achievementManager.claimWeeklyReward(idx)) {
          game.render();
        }
      });
    } else {
      Renderer.drawText(formatReward(m.reward), btnX + 35, btnY + 18, {
        font: '11px system-ui', color: '#a78bfa', align: 'center'
      });
    }

    y += cardH + 8;
  }

  y += 15;

  // === 업적 목록 ===
  const unlocked = Object.keys(achievements).length;
  const visibleTotal = ACHIEVEMENTS.filter(a => !a.hidden || achievements[a.id]).length;
  Renderer.drawText(t('achievementList', unlocked, visibleTotal), 200, y + 8, {
    font: 'bold 16px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center'
  });
  y += 30;

  const categories = ['combo', 'run', 'boss', 'level', 'gold', 'kills', 'subject', 'study', 'power'];
  const catNames = {
    combo: 'achv_cat_combo', run: 'achv_cat_run', boss: 'achv_cat_boss',
    level: 'achv_cat_level', gold: 'achv_cat_gold', kills: 'achv_cat_kills',
    subject: 'achv_cat_subject', study: 'achv_cat_study', power: 'achv_cat_power'
  };

  for (const cat of categories) {
    const items = ACHIEVEMENTS.filter(a => a.category === cat);
    if (items.length === 0) continue;

    Renderer.drawText(t(catNames[cat]), 30, y + 8, {
      font: 'bold 14px system-ui', color: COLORS.TEXT_SECONDARY
    });
    y += 25;

    for (const achv of items) {
      const isUnlocked = !!achievements[achv.id];

      // 숨겨진 업적: 미해제 시 "???" 표시
      if (achv.hidden && !isUnlocked) {
        const cardH = 50;
        Renderer.roundRect(20, y, 360, cardH, 10, 'rgba(30,30,50,0.6)');
        Renderer.drawText('❓', 42, y + 18, { font: '20px system-ui', align: 'center' });
        Renderer.drawText('???', 65, y + 13, { font: 'bold 13px system-ui', color: '#555' });
        Renderer.drawText(t('hiddenAchievement') || '숨겨진 업적', 65, y + 32, { font: '11px system-ui', color: '#444' });
        Renderer.drawText('????G', 365, y + 18, { font: 'bold 12px system-ui', color: '#555', align: 'right' });
        y += cardH + 6;
        continue;
      }

      const prog = !isUnlocked ? getProgress(achv, player) : null;
      const cardH = prog ? 65 : 50;
      const isHiddenUnlocked = achv.hidden && isUnlocked;
      const bgColor = isHiddenUnlocked ? 'rgba(251,191,36,0.2)' : isUnlocked ? 'rgba(99,102,241,0.15)' : COLORS.BG_CARD;
      const borderColor = isHiddenUnlocked ? '#ffd700' : isUnlocked ? '#fbbf24' : null;
      Renderer.roundRect(20, y, 360, cardH, 10, bgColor, borderColor);

      // 아이콘
      Renderer.drawText(isUnlocked ? achv.icon : '🔒', 42, y + 18, {
        font: '20px system-ui', align: 'center'
      });

      // 이름 & 설명
      const nameColor = isHiddenUnlocked ? '#ffd700' : isUnlocked ? COLORS.TEXT_PRIMARY : COLORS.TEXT_SECONDARY;
      Renderer.drawText(t(achv.nameKey), 65, y + 13, {
        font: `bold 13px system-ui`, color: nameColor
      });
      Renderer.drawText(t(achv.descKey), 65, y + 32, {
        font: '11px system-ui', color: COLORS.TEXT_SECONDARY
      });

      // 진행바 (미해제 + 진행도 있는 업적)
      if (prog) {
        const barX = 65;
        const barY = y + 45;
        const barW = 220;
        const barH = 8;
        const ratio = Math.min(prog.current / prog.target, 1);
        Renderer.roundRect(barX, barY, barW, barH, 4, COLORS.BG_SECONDARY);
        if (ratio > 0) {
          Renderer.roundRect(barX, barY, Math.max(6, barW * ratio), barH, 4, COLORS.ACCENT);
        }
        Renderer.drawText(`${prog.current}/${prog.target}`, barX + barW + 8, barY, {
          font: '10px system-ui', color: COLORS.TEXT_SECONDARY
        });
      }

      // 보상
      let rewardText = achv.rewardExp ? `${achv.reward}G +${achv.rewardExp}XP` : `${achv.reward}G`;
      if (achv.rewardBonusDamage) rewardText += ` +ATK${achv.rewardBonusDamage}`;
      if (achv.rewardBonusHp) rewardText += ` +HP${achv.rewardBonusHp}`;
      Renderer.drawText(rewardText, 365, y + 18, {
        font: 'bold 12px system-ui', color: isUnlocked ? COLORS.WARNING : COLORS.TEXT_SECONDARY, align: 'right'
      });

      y += cardH + 6;
    }
    y += 10;
  }

  // 스크롤 높이 설정
  game.scrollMaxY = Math.max(0, y - 700);
}
