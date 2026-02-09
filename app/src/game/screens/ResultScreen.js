// 결과 화면 렌더링
import { Renderer } from '../../canvas/Renderer.js';
import { SCREENS, GAME_CONFIG, COLORS } from '../../utils/constants.js';
import { t } from '../../i18n/i18n.js';

export function renderResultScreen(game) {
  Renderer.drawGrid();

  const isWin = game.currentRun?.result === 'clear';
  const title = isWin ? t('cleared') : t('failed');
  const titleColor = isWin ? COLORS.SUCCESS : COLORS.DANGER;

  Renderer.drawText(title, 200, 100, { font: 'bold 32px system-ui', color: titleColor, align: 'center' });

  Renderer.roundRect(50, 160, 300, 230, 20, COLORS.BG_CARD);

  Renderer.drawText(`${t('stageLabel')}: ${game.stage}/${GAME_CONFIG.STAGES_PER_DUNGEON}`, 200, 190, {
    font: '16px system-ui', align: 'center'
  });

  Renderer.drawText(`${t('defeatedMonsters')}: ${game.currentRun?.defeatedMonsters?.length || 0}`, 200, 230, {
    font: '16px system-ui', align: 'center'
  });

  Renderer.drawText(`${t('bestCombo')}: ${game.currentRun?.bestCombo || 0}`, 200, 270, {
    font: '16px system-ui', align: 'center'
  });

  const correct = game.currentRun?.correctAnswers || 0;
  const total = game.currentRun?.totalAnswers || 0;
  const accuracyPercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  Renderer.drawText(`${t('accuracyLabel')}: ${accuracyPercent}% (${correct}/${total})`, 200, 310, {
    font: '16px system-ui', align: 'center'
  });

  Renderer.drawText(`${t('earnedGold')}: +${game.currentRun?.earnedGold || 0}G`, 200, 350, {
    font: 'bold 18px system-ui', color: COLORS.WARNING, align: 'center'
  });

  Renderer.drawButton(100, 420, 200, 60, t('toMain'), { bgColor: COLORS.ACCENT });
  game.registerClickArea('toMain', 100, 420, 200, 60, () => { game.changeScreen(SCREENS.MAIN); });
}
