// 전투 화면 렌더링
import { Renderer } from '../../canvas/Renderer.js';
import { GAME_CONFIG, COLORS } from '../../utils/constants.js';
import { t } from '../../i18n/i18n.js';
import { cleanQuestionText } from '../../utils/textCleaner.js';

export function renderBattleScreen(game) {
  const player = game.playerManager.player;
  const monster = game.currentMonster;
  if (!monster) return;

  const effects = game.effects;

  // 상단 HUD
  Renderer.roundRect(0, 0, 400, 80, 0, COLORS.BG_SECONDARY);

  Renderer.drawText('HP', 20, 20, { font: '12px system-ui', color: COLORS.TEXT_SECONDARY });
  Renderer.drawHPBar(50, 18, 150, 18, player.currentHp, player.maxHp, COLORS.HP_PLAYER);
  Renderer.drawText(`${Math.round(player.currentHp)}/${player.maxHp}`, 210, 20, { font: '13px system-ui' });

  Renderer.roundRect(270, 15, 50, 24, 12, COLORS.ACCENT);
  const lvText = player.level >= 100 ? 'MAX' : `LV.${player.level}`;
  const lvColor = player.level >= 100 ? '#fbbf24' : '#ffffff';
  Renderer.drawText(lvText, 295, 20, { font: 'bold 11px system-ui', color: lvColor, align: 'center' });
  Renderer.drawText(`💰 ${player.gold}`, 340, 20, { font: '12px system-ui', color: COLORS.WARNING });

  Renderer.drawText(`${t('stage')} ${game.stage}/${GAME_CONFIG.STAGES_PER_DUNGEON}`, 20, 52, { font: '14px system-ui' });

  const totalAnswers = game.currentRun?.totalAnswers || 0;
  if (totalAnswers >= 5) {
    const accuracy = Math.round(game.getAccuracyRate() * 100);
    const accuracyColor = accuracy >= 80 ? '#ef4444' : accuracy < 50 ? '#22c55e' : COLORS.TEXT_SECONDARY;
    const diffLabel = accuracy >= 80 ? '↑' : accuracy < 50 ? '↓' : '';
    Renderer.drawText(`${t('accuracyRate')} ${accuracy}%${diffLabel}`, 160, 52, { font: '12px system-ui', color: accuracyColor });
  }

  if (game.combo > 0) {
    Renderer.roundRect(280, 45, 100, 24, 12, 'rgba(251,191,36,0.2)');
    Renderer.drawText(`🔥 ${game.combo} COMBO`, 330, 50, {
      font: 'bold 12px system-ui', color: COLORS.WARNING, align: 'center'
    });
  }

  // 몬스터 영역
  const bossType = monster.bossType;
  let monsterBgColor = COLORS.BG_CARD;
  let monsterCircleColor = 'rgba(239,68,68,0.1)';
  let hpBarColor = COLORS.HP_ENEMY;
  let monsterIcon = monster.icon || '👾';
  let iconSize = '50px';

  if (bossType === 'FINAL_BOSS') {
    monsterBgColor = 'rgba(255,0,0,0.2)';
    monsterCircleColor = 'rgba(255,215,0,0.3)';
    hpBarColor = '#ff0000';
    iconSize = '60px';
  } else if (bossType === 'MID_BOSS') {
    monsterBgColor = 'rgba(128,0,128,0.2)';
    monsterCircleColor = 'rgba(128,0,128,0.2)';
    hpBarColor = '#9932cc';
    iconSize = '55px';
  } else if (bossType === 'NORMAL_BOSS') {
    monsterBgColor = 'rgba(255,69,0,0.15)';
    monsterCircleColor = 'rgba(255,69,0,0.2)';
    hpBarColor = '#ff4500';
  }

  Renderer.roundRect(20, 90, 360, 168, 20, monsterBgColor);

  if (bossType) {
    const pulseAlpha = 0.6 + Math.sin(effects.pulseTime / 200) * 0.4;
    const ctx = Renderer.ctx;
    ctx.save();
    ctx.globalAlpha = pulseAlpha;
    Renderer.roundRect(20, 90, 360, 168, 20, null, hpBarColor);
    ctx.restore();
  }

  const breathScale = 1 + Math.sin(effects.pulseTime / 500) * 0.05;
  const circleRadius = 42 * breathScale;
  Renderer.drawCircle(200, 152, circleRadius, monsterCircleColor);

  let displayIconSize = parseInt(iconSize);
  if (effects.bossEntrance > 0) {
    displayIconSize = displayIconSize * (1 + effects.bossEntrance * 0.5);
  }

  Renderer.drawText(monsterIcon, 200, 133, { font: `${displayIconSize}px system-ui`, align: 'center' });
  Renderer.drawText(monster.name || t('wrongMonster'), 200, 205, {
    font: 'bold 16px system-ui', color: bossType === 'FINAL_BOSS' ? '#8b0000' : bossType === 'MID_BOSS' ? '#9932cc' : bossType ? '#ff0000' : COLORS.TEXT_PRIMARY, align: 'center'
  });

  Renderer.drawHPBar(100, 228, 200, 12, monster.hp, monster.maxHp, hpBarColor);
  Renderer.drawText(`HP ${Math.round(monster.hp)}/${monster.maxHp}`, 200, 245, {
    font: '11px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });

  // 문제 카드
  const qCardY = 272;
  const qCardH = 110;
  Renderer.roundRect(20, qCardY, 360, qCardH, 20, COLORS.BG_CARD);
  Renderer.roundRect(20, qCardY, 360, qCardH, 20, null, COLORS.ACCENT);
  Renderer.roundRect(160, qCardY - 12, 80, 24, 12, COLORS.ACCENT);
  Renderer.drawText('QUESTION', 200, qCardY - 7, { font: 'bold 11px system-ui', align: 'center' });

  const questionText = cleanQuestionText(monster.question) || t('loadingQuestion');
  const maxCharsPerLine = 22;
  const maxLines = 5;
  const lineHeight = 18;
  const fontSize = 13;

  const lines = [];
  for (let i = 0; i < questionText.length && lines.length < maxLines; i += maxCharsPerLine) {
    let line = questionText.slice(i, i + maxCharsPerLine);
    if (lines.length === maxLines - 1 && i + maxCharsPerLine < questionText.length) {
      line = line.slice(0, -3) + '...';
    }
    lines.push(line);
  }

  const totalHeight = lines.length * lineHeight;
  const qCenterY = qCardY + qCardH / 2;
  const startY = qCenterY - totalHeight / 2 + lineHeight / 2;

  lines.forEach((line, i) => {
    Renderer.drawText(line, 200, startY + i * lineHeight, { font: `bold ${fontSize}px system-ui`, align: 'center' });
  });

  // 이미지로 보기 버튼
  const imgBtnY = qCardY + qCardH + 6;
  Renderer.drawButton(20, imgBtnY, 360, 34, '📷 이미지로 보기', {
    bgColor: 'rgba(59,130,246,0.2)', borderColor: '#3b82f6', fontSize: 14, stroke: true
  });
  game.registerClickArea('viewQuestion', 20, imgBtnY, 360, 34, () => game.battleManager.showFullQuestion());

  // 선택지
  const choices = monster.choices || ['①', '②', '③', '④'];
  const choiceWidth = 175;
  const choiceHeight = 48;
  const gapX = 10;
  const gapY = 8;
  const startX = 20;
  const choiceStartY = 428;

  choices.forEach((choice, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (choiceWidth + gapX);
    const y = choiceStartY + row * (choiceHeight + gapY);

    Renderer.roundRect(x, y, choiceWidth, choiceHeight, 12, COLORS.BG_CARD);
    Renderer.roundRect(x, y, choiceWidth, choiceHeight, 12, null, 'rgba(99,102,241,0.3)');
    Renderer.drawText(`${i + 1}.`, x + 15, y + choiceHeight / 2 - 5, { font: 'bold 14px system-ui', color: COLORS.ACCENT_LIGHT });

    const choiceStr = String(choice);
    const choiceText = choiceStr.length > 12 ? choiceStr.substring(0, 12) + '...' : choiceStr;
    Renderer.drawText(choiceText, x + 35, y + choiceHeight / 2 - 5, { font: 'bold 16px system-ui', color: COLORS.TEXT_PRIMARY });

    game.registerClickArea(`choice_${i}`, x, y, choiceWidth, choiceHeight, () => game.battleManager.selectAnswer(i));
  });

  // 타이머
  const difficulty = monster.difficulty || 2;
  const maxTime = game.playerManager.getTotalTime(difficulty);
  Renderer.drawTimerBar(100, 545, 200, 12, game.timer, maxTime, effects.pulseTime);

  const timerColor = game.timer < 10 ? COLORS.DANGER : game.timer < maxTime * 0.25 ? COLORS.WARNING : COLORS.TEXT_PRIMARY;
  Renderer.drawText(`⏱️ ${Math.max(0, Math.ceil(game.timer))}${t('seconds')}`, 200, 565, {
    font: 'bold 14px system-ui', color: timerColor, align: 'center'
  });

  // 아이템 드랍 알림
  const droppedItem = game.itemManager.droppedItem;
  if (droppedItem) {
    Renderer.roundRect(50, 130, 300, 50, 12, droppedItem.rarity.color);
    Renderer.drawText(`${droppedItem.icon} ${droppedItem.name} ${t('obtained')}`, 200, 145, {
      font: 'bold 16px system-ui', color: '#000', align: 'center'
    });
    Renderer.drawText(`[${t(droppedItem.rarity.nameKey)}]`, 200, 165, {
      font: '12px system-ui', color: '#333', align: 'center'
    });
  }

  // 하단 버튼
  Renderer.roundRect(0, 600, 400, 100, 0, COLORS.BG_SECONDARY);

  const hintCount = player.inventory?.hintTicket || 0;
  const hasHint = hintCount > 0;
  Renderer.drawButton(8, 620, 88, 46, `💡${hintCount}`, {
    bgColor: hasHint ? 'rgba(251,191,36,0.2)' : 'rgba(100,100,100,0.15)',
    borderColor: hasHint ? 'rgba(251,191,36,0.6)' : 'rgba(100,100,100,0.3)',
    textColor: hasHint ? COLORS.WARNING : COLORS.TEXT_SECONDARY, fontSize: 14
  });
  game.registerClickArea('hint', 8, 620, 88, 46, () => game.battleManager.useHint());

  const hasTimeBoost = (player.inventory?.timeBoost || 0) > 0;
  Renderer.drawButton(104, 620, 88, 46, `⏰${player.inventory?.timeBoost || 0}`, {
    bgColor: hasTimeBoost ? 'rgba(34,197,94,0.2)' : 'rgba(100,100,100,0.15)',
    borderColor: hasTimeBoost ? 'rgba(34,197,94,0.6)' : 'rgba(100,100,100,0.3)',
    textColor: hasTimeBoost ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY, fontSize: 14
  });
  game.registerClickArea('timeBoost', 104, 620, 88, 46, () => game.battleManager.useTimeBoost());

  Renderer.drawButton(200, 620, 88, 46, t('skip'), {
    bgColor: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.5)', textColor: COLORS.DANGER, fontSize: 14
  });
  game.registerClickArea('skip', 200, 620, 88, 46, () => game.battleManager.skipQuestion());

  Renderer.drawButton(296, 620, 96, 46, t('quit'), {
    bgColor: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.5)', textColor: COLORS.ACCENT_LIGHT, fontSize: 14
  });
  game.registerClickArea('quit', 296, 620, 96, 46, () => game.endRun(false));
}
