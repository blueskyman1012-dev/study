// 던전 선택 화면 렌더링
import { Renderer } from '../../canvas/Renderer.js';
import { SCREENS, COLORS } from '../../utils/constants.js';
import { t } from '../../i18n/i18n.js';

export function renderDungeonSelectScreen(game) {
  Renderer.drawGrid();

  // 헤더
  Renderer.drawText(t('dungeonSelect'), 200, 30, {
    font: 'bold 28px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center'
  });
  Renderer.drawText(t('selectDungeon'), 200, 70, {
    font: '15px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });

  // 수학 던전 카드
  const mathMonsters = game.monsterManager.monsters.filter(m => (m.subject || 'math') === 'math');
  Renderer.roundRect(30, 120, 340, 180, 16, COLORS.BG_CARD);
  Renderer.roundRect(30, 120, 340, 180, 16, 'rgba(99,102,241,0.15)');
  Renderer.drawText('📐', 200, 170, { font: '48px system-ui', align: 'center', baseline: 'middle' });
  Renderer.drawText(t('mathDungeon'), 200, 220, {
    font: 'bold 22px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center'
  });
  Renderer.drawText(t('registeredMonsters', mathMonsters.length), 200, 250, {
    font: '14px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  Renderer.drawText(t('mathTopics'), 200, 275, {
    font: '12px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  game.registerClickArea('mathDungeon', 30, 120, 340, 180, () => game.startDungeon('math'));

  // 과학 던전 카드
  const sciMonsters = game.monsterManager.monsters.filter(m => m.subject === 'science');
  Renderer.roundRect(30, 330, 340, 180, 16, COLORS.BG_CARD);
  Renderer.roundRect(30, 330, 340, 180, 16, 'rgba(251,191,36,0.15)');
  Renderer.drawText('🔬', 200, 380, { font: '48px system-ui', align: 'center', baseline: 'middle' });
  Renderer.drawText(t('scienceDungeon'), 200, 430, {
    font: 'bold 22px system-ui', color: COLORS.WARNING, align: 'center'
  });
  Renderer.drawText(t('registeredMonsters', sciMonsters.length), 200, 460, {
    font: '14px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  Renderer.drawText(t('scienceTopics'), 200, 485, {
    font: '12px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
  });
  game.registerClickArea('scienceDungeon', 30, 330, 340, 180, () => game.startDungeon('science'));

  // 뒤로가기
  Renderer.drawButton(30, 560, 340, 55, t('goBack'), {
    bgColor: COLORS.BG_CARD, borderColor: COLORS.TEXT_SECONDARY, fontSize: 18
  });
  game.registerClickArea('back', 30, 560, 340, 55, () => game.changeScreen(SCREENS.MAIN));
}
