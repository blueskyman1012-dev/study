// 메인 화면 렌더링
import { Renderer } from '../../canvas/Renderer.js';
import { SCREENS, COLORS } from '../../utils/constants.js';
import { geminiService } from '../../services/GeminiService.js';
import { problemGeneratorService } from '../../services/ProblemGeneratorService.js';
import { t } from '../../i18n/i18n.js';

export function renderMainScreen(game) {
  const player = game.playerManager.player;

  if (player) {
    game.playerManager.resetHp();
  }

  Renderer.drawGrid();

  // 타이틀
  Renderer.drawText(t('title'), 200, 30, {
    font: 'bold 40px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center', stroke: true
  });
  Renderer.drawText(t('subtitle'), 200, 78, {
    font: '15px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });

  // === 플레이어 정보 카드 ===
  Renderer.roundRect(20, 105, 360, 130, 14, COLORS.BG_CARD);

  // 레벨 (정사각형 76x76)
  Renderer.roundRect(32, 117, 76, 76, 14, 'rgba(99,102,241,0.2)');
  Renderer.drawText('LV', 70, 133, {
    font: '12px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center', stroke: true
  });
  const levelDisplay = player.level >= 100 ? 'MAX' : `${player.level}`;
  const levelFont = player.level >= 100 ? 'bold 22px system-ui' : 'bold 30px system-ui';
  const levelColor = player.level >= 100 ? '#fbbf24' : COLORS.ACCENT_LIGHT;
  Renderer.drawText(levelDisplay, 70, 162, {
    font: levelFont, color: levelColor, align: 'center', baseline: 'middle', stroke: true
  });
  game.registerClickArea('levelDetail', 32, 117, 76, 76, () => game.showLevelProgress());

  // 골드 (우상단)
  Renderer.roundRect(280, 114, 90, 28, 8, 'rgba(251,191,36,0.15)');
  Renderer.drawText(`💰 ${player.gold.toLocaleString()}G`, 325, 122, {
    font: 'bold 13px system-ui', color: COLORS.WARNING, align: 'center', stroke: true
  });

  // HP 바 (레벨 오른쪽)
  Renderer.drawText('HP', 122, 158, { font: 'bold 11px system-ui', color: COLORS.TEXT_SECONDARY, stroke: true });
  Renderer.drawHPBar(148, 155, 160, 16, player.currentHp, player.maxHp, COLORS.HP_PLAYER);
  Renderer.drawText(`${Math.round(player.currentHp)}/${player.maxHp}`, 314, 158, {
    font: '11px system-ui', color: COLORS.TEXT_PRIMARY, stroke: true
  });

  // EXP 바 (HP 바 아래)
  const isMaxLevel = player.level >= 100;
  const expProgress = isMaxLevel ? 1 : game.playerManager.getLevelProgress();
  const expRequired = isMaxLevel ? 0 : game.playerManager.getExpForLevel(player.level);
  Renderer.drawText('EXP', 122, 188, { font: 'bold 11px system-ui', color: COLORS.TEXT_SECONDARY, stroke: true });
  Renderer.roundRect(148, 185, 160, 16, 8, COLORS.BG_SECONDARY);
  if (expProgress > 0) {
    Renderer.roundRect(148, 185, Math.max(8, 160 * expProgress), 16, 8, isMaxLevel ? '#fbbf24' : COLORS.ACCENT);
  }
  Renderer.drawText(isMaxLevel ? 'MAX' : `${player.exp}/${expRequired}`, 314, 188, { font: '11px system-ui', color: COLORS.TEXT_PRIMARY, stroke: true });

  // === 스탯 바 (시간 제거, 4개 아이템) ===
  const totalDmg = game.playerManager.getTotalDamage();
  const inv = player.inventory || {};

  Renderer.roundRect(20, 250, 175, 42, 12, COLORS.BG_CARD);
  Renderer.drawText(`⚔️${totalDmg}`, 65, 267, { font: 'bold 14px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center', stroke: true });
  Renderer.drawText(`🪶${inv.reviveTicket || 0}`, 155, 267, { font: 'bold 14px system-ui', color: COLORS.WARNING, align: 'center', stroke: true });

  // 문제 보기 버튼 (독립 버튼)
  Renderer.drawButton(205, 250, 175, 42, `📋 ${t('problemViewer')}`, {
    bgColor: COLORS.BG_CARD, borderColor: 'rgba(99,102,241,0.4)', fontSize: 13, stroke: true
  });
  game.registerClickArea('problemViewer', 205, 250, 175, 42, () => game.showProblemViewer());

  // === 던전 입장 ===
  Renderer.drawButton(20, 310, 360, 65, t('enterDungeon'), { bgColor: COLORS.ACCENT, fontSize: 22, stroke: true });
  game.registerClickArea('dungeon', 20, 310, 360, 65, () => game.changeScreen(SCREENS.DUNGEON_SELECT));

  // ── y=390~460: HTML 오답등록 버튼 ──

  // === 통계 & 상점 & 설정 & 업적 ===
  const menuBtnW = 85;
  const menuBtnH = 55;
  const menuBtnGap = 8;
  const menuStartX = 20;
  const menuY = 480;

  Renderer.drawButton(menuStartX, menuY, menuBtnW, menuBtnH, t('stats'), { bgColor: COLORS.BG_CARD, borderColor: '#38bdf8', fontSize: 15, stroke: true });
  game.registerClickArea('stats', menuStartX, menuY, menuBtnW, menuBtnH, () => game.changeScreen(SCREENS.STATS));

  Renderer.drawButton(menuStartX + (menuBtnW + menuBtnGap), menuY, menuBtnW, menuBtnH, t('shop'), { bgColor: COLORS.BG_CARD, borderColor: '#22c55e', fontSize: 15, stroke: true });
  game.registerClickArea('shop', menuStartX + (menuBtnW + menuBtnGap), menuY, menuBtnW, menuBtnH, () => game.changeScreen(SCREENS.SHOP));

  Renderer.drawButton(menuStartX + (menuBtnW + menuBtnGap) * 2, menuY, menuBtnW, menuBtnH, t('achievement'), { bgColor: COLORS.BG_CARD, borderColor: '#fbbf24', fontSize: 15, stroke: true });
  game.registerClickArea('achievement', menuStartX + (menuBtnW + menuBtnGap) * 2, menuY, menuBtnW, menuBtnH, () => game.changeScreen(SCREENS.ACHIEVEMENT));

  Renderer.drawButton(menuStartX + (menuBtnW + menuBtnGap) * 3, menuY, menuBtnW + 3, menuBtnH, t('settings'), { bgColor: COLORS.BG_CARD, borderColor: COLORS.TEXT_SECONDARY, fontSize: 15, stroke: true });
  game.registerClickArea('settings', menuStartX + (menuBtnW + menuBtnGap) * 3, menuY, menuBtnW + 3, menuBtnH, () => game.changeScreen(SCREENS.SETTINGS));

  // === AI 상태 ===
  const hasSmilePrintKey = problemGeneratorService.hasApiKey();
  if (hasSmilePrintKey) {
    Renderer.drawButton(20, 555, 360, 48, t('aiGenerate'), {
      bgColor: '#1d4ed8', borderColor: '#4b8df8', fontSize: 16, stroke: true
    });
    game.registerClickArea('aiGenerate', 20, 555, 360, 48, () => game.showAIGenerateMenu());
  } else {
    Renderer.roundRect(20, 555, 360, 40, 12, COLORS.BG_CARD);
    const hasGemini = geminiService.hasApiKey();
    const aiStatus = hasGemini ? t('aiConnected') : t('aiNotConnected');
    Renderer.drawText(aiStatus, 200, 570, {
      font: '13px system-ui', color: hasGemini ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY, align: 'center', stroke: true
    });
  }

  // 슬로건
  Renderer.drawText(t('slogan'), 200, 665, {
    font: '14px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
}
