// 오답 등록 화면 + AI분석
import { Renderer } from '../../canvas/Renderer.js';
import { SCREENS, COLORS, SUBJECTS } from '../../utils/constants.js';
import { t } from '../../i18n/i18n.js';

export function renderRegisterScreen(game) {
  Renderer.drawGrid();

  // 헤더
  Renderer.roundRect(0, 0, 400, 60, 0, COLORS.BG_SECONDARY);
  Renderer.drawText(t('subjectSelect'), 200, 20, { font: 'bold 18px system-ui', align: 'center' });

  Renderer.drawText(t('cancel'), 30, 22, { font: '14px system-ui', color: COLORS.ACCENT_LIGHT });
  game.registerClickArea('back', 10, 10, 80, 40, () => {
    game.pendingImage = null;
    game.changeScreen(SCREENS.MAIN);
  });

  // 이미지 미리보기 (로딩 중 중복 생성 방지)
  if (game.pendingImage && !game.previewImageLoaded && !game._previewImageLoading) {
    game._previewImageLoading = true;
    game.previewImg = new Image();
    game.previewImg.onload = () => { game.previewImageLoaded = true; game._previewImageLoading = false; };
    game.previewImg.onerror = () => { game._previewImageLoading = false; };
    game.previewImg.src = game.pendingImage;
  }

  Renderer.roundRect(50, 80, 300, 200, 16, COLORS.BG_CARD);
  if (game.previewImg && game.previewImg.complete) {
    const maxW = 280, maxH = 180;
    const ratio = Math.min(maxW / game.previewImg.width, maxH / game.previewImg.height);
    const w = game.previewImg.width * ratio;
    const h = game.previewImg.height * ratio;
    const x = 50 + (300 - w) / 2;
    const y = 80 + (200 - h) / 2;
    Renderer.drawImage(game.previewImg, x, y, w, h);
  } else {
    Renderer.drawText(t('capturedPhoto'), 200, 170, {
      font: '16px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
  }

  Renderer.drawText(t('selectSubject'), 200, 310, {
    font: '16px system-ui', color: COLORS.TEXT_PRIMARY, align: 'center'
  });

  // 과목 선택
  const subjects = Object.values(SUBJECTS);
  const btnWidth = 170, btnHeight = 60;

  subjects.forEach((subj, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 20 + col * (btnWidth + 10);
    const y = 350 + row * (btnHeight + 15);

    Renderer.drawButton(x, y, btnWidth, btnHeight, `${subj.icon} ${t(subj.nameKey)}`, {
      bgColor: COLORS.BG_CARD, borderColor: subj.color, fontSize: 16
    });
    game.registerClickArea(`subject_${subj.id}`, x, y, btnWidth, btnHeight, () => game.completeRegister(subj.id));
  });

  // 취소 버튼
  Renderer.drawButton(100, 510, 200, 45, t('cancel'), {
    bgColor: COLORS.BG_SECONDARY, borderColor: COLORS.TEXT_SECONDARY, fontSize: 14
  });
  game.registerClickArea('retake', 100, 510, 200, 45, () => game.startRegister());
}
