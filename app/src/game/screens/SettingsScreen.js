// 설정 화면 렌더링 (탭 분류)
import { Renderer } from '../../canvas/Renderer.js';
import { SCREENS, COLORS } from '../../utils/constants.js';
import { SoundService } from '../../services/SoundService.js';
import { geminiService } from '../../services/GeminiService.js';
import { imageAnalysisService } from '../../services/ImageAnalysisService.js';
import { t, getLanguage, setLanguage } from '../../i18n/i18n.js';


// 현재 선택된 탭 (모듈 레벨 상태)
let currentTab = 0;
const TABS = [
  { labelKey: 'settingsTabGame', icon: '🎮' },
  { labelKey: 'settingsTabApi', icon: '🔑' },
  { labelKey: 'settingsTabData', icon: '📦' },
];

// ─── 고정 헤더 (Game.js에서 호출) ───
export function renderSettingsFixedHeader(game) {
  // 배경 (0~96)
  Renderer.roundRect(0, 0, 400, 96, 0, COLORS.BG_SECONDARY);

  // 제목 + 뒤로가기
  Renderer.drawText(t('settingsTitle'), 200, 18, { font: 'bold 18px system-ui', align: 'center' });
  Renderer.drawText(t('back'), 30, 20, { font: '14px system-ui', color: COLORS.ACCENT_LIGHT });
  game.registerClickArea('back', 10, 10, 80, 35, () => game.changeScreen(SCREENS.MAIN));

  // 탭 바 (y:55~91)
  const tabY = 55;
  const tabH = 36;
  const tabW = Math.floor(400 / TABS.length);
  TABS.forEach((tab, i) => {
    const x = i * tabW;
    const isActive = i === currentTab;
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
    game.registerClickArea(`tab_${i}`, x, tabY, tabW, tabH, () => {
      currentTab = i;
      game.scrollY = 0;
      game.scrollMaxY = 0;
    });
  });
}

export function renderSettingsScreen(game) {
  Renderer.drawGrid();

  // 뒤로가기 클릭 (스크롤 보정용)
  game.registerClickArea('back', 10, 10, 80, 35, () => game.changeScreen(SCREENS.MAIN));

  // 고정 헤더 높이 이후부터 콘텐츠 시작
  const contentStartY = 106;

  switch (currentTab) {
    case 0: renderGameTab(game, contentStartY); break;
    case 1: renderApiTab(game, contentStartY); break;
    case 2: renderDataTab(game, contentStartY); break;
  }
}

// ─── 게임 설정 탭 ───
function renderGameTab(game, startY) {
  let y = startY;

  // 사운드 설정
  Renderer.roundRect(20, y, 360, 90, 16, COLORS.BG_CARD);
  Renderer.drawText(t('soundSettings'), 200, y + 20, { font: 'bold 14px system-ui', align: 'center' });

  const bgmOn = SoundService.bgmEnabled;
  const sfxOn = SoundService.sfxEnabled;

  Renderer.drawButton(35, y + 40, 155, 38, bgmOn ? t('bgmOn') : t('bgmOff'), {
    bgColor: bgmOn ? 'rgba(99,102,241,0.2)' : COLORS.BG_SECONDARY, borderColor: bgmOn ? COLORS.ACCENT : COLORS.TEXT_SECONDARY, fontSize: 13
  });
  game.registerClickArea('toggleBgm', 35, y + 40, 155, 38, () => { SoundService.toggleBgm(); });

  Renderer.drawButton(210, y + 40, 155, 38, sfxOn ? t('sfxOn') : t('sfxOff'), {
    bgColor: sfxOn ? 'rgba(34,197,94,0.15)' : COLORS.BG_SECONDARY, borderColor: sfxOn ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY, fontSize: 13
  });
  game.registerClickArea('toggleSfx', 210, y + 40, 155, 38, () => { SoundService.toggleSfx(); });
  y += 105;

  // 언어 설정
  Renderer.roundRect(20, y, 360, 90, 16, COLORS.BG_CARD);
  Renderer.drawText(t('langSettings'), 200, y + 20, { font: 'bold 14px system-ui', align: 'center' });

  const langs = [
    { code: 'ko', label: '한국어' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'zh', label: '中文' }
  ];
  const currentLang = getLanguage();
  const langBtnW = 80;
  const langStartX = 22;

  langs.forEach((lang, i) => {
    const x = langStartX + i * (langBtnW + 6);
    const isSelected = currentLang === lang.code;
    Renderer.drawButton(x, y + 42, langBtnW, 36, lang.label, {
      bgColor: isSelected ? COLORS.ACCENT : COLORS.BG_SECONDARY,
      borderColor: isSelected ? COLORS.ACCENT_LIGHT : COLORS.TEXT_SECONDARY,
      fontSize: 12
    });
    game.registerClickArea(`lang_${lang.code}`, x, y + 42, langBtnW, 36, () => {
      setLanguage(lang.code);
    });
  });
  y += 105;

  // UI 투명도
  Renderer.roundRect(20, y, 360, 90, 16, COLORS.BG_CARD);
  Renderer.drawText(t('uiOpacityTitle'), 200, y + 20, { font: 'bold 14px system-ui', align: 'center' });

  const opacity = Renderer.getUiOpacity();
  const opacityPercent = Math.round(opacity * 100);

  const sliderX = 50;
  const sliderY = y + 48;
  const sliderW = 230;
  const sliderH = 12;
  Renderer.roundRect(sliderX, sliderY, sliderW, sliderH, 6, COLORS.BG_SECONDARY);
  const fillW = sliderW * ((opacity - 0.1) / 0.9);
  if (fillW > 0) {
    Renderer.roundRect(sliderX, sliderY, Math.max(6, fillW), sliderH, 6, COLORS.ACCENT);
  }

  const handleX = sliderX + fillW - 8;
  Renderer.roundRect(Math.max(sliderX - 4, handleX), sliderY - 4, 16, 20, 8, COLORS.ACCENT_LIGHT);

  Renderer.drawText(`${opacityPercent}%`, sliderX + sliderW + 15, sliderY - 2, {
    font: 'bold 14px system-ui', color: COLORS.TEXT_PRIMARY
  });

  game.registerDragArea('opacitySlider', sliderX - 10, sliderY - 15, sliderW + 20, 40, (clickX) => {
    const ratio = Math.max(0, Math.min(1, (clickX - sliderX) / sliderW));
    Renderer.setUiOpacity(0.1 + ratio * 0.9);
  });

  Renderer.drawButton(310, y + 40, 30, 30, '-', { bgColor: COLORS.BG_SECONDARY, borderColor: COLORS.TEXT_SECONDARY, fontSize: 16 });
  game.registerClickArea('opacityDown', 310, y + 40, 30, 30, () => {
    Renderer.setUiOpacity(opacity - 0.1);
  });
  Renderer.drawButton(345, y + 40, 30, 30, '+', { bgColor: COLORS.BG_SECONDARY, borderColor: COLORS.TEXT_SECONDARY, fontSize: 16 });
  game.registerClickArea('opacityUp', 345, y + 40, 30, 30, () => {
    Renderer.setUiOpacity(opacity + 0.1);
  });
  y += 105;

  game.scrollMaxY = Math.max(0, y - 700);
}

// ─── API 설정 탭 ───
function renderApiTab(game, startY) {
  let y = startY;

  // SmilePrint API
  Renderer.roundRect(20, y, 360, 110, 16, COLORS.BG_CARD);
  Renderer.drawText(t('smilePrintApi'), 200, y + 20, { font: 'bold 14px system-ui', align: 'center' });

  const hasSmilePrintKey = imageAnalysisService.hasApiKey();
  Renderer.drawText(hasSmilePrintKey ? t('configured') : t('notConfigured'), 200, y + 42, {
    font: '12px system-ui', color: hasSmilePrintKey ? COLORS.SUCCESS : COLORS.DANGER, align: 'center'
  });

  Renderer.drawButton(50, y + 62, 300, 38, t('inputSmilePrintKey'), { bgColor: COLORS.ACCENT, fontSize: 14 });
  game.registerClickArea('setSmilePrintKey', 50, y + 62, 300, 38, () => game.promptSmilePrintApiKey());
  y += 120;

  // Gemini API
  Renderer.roundRect(20, y, 360, 110, 16, COLORS.BG_CARD);
  Renderer.drawText(t('geminiApi'), 200, y + 20, { font: 'bold 14px system-ui', align: 'center' });

  const hasGeminiKey = geminiService.hasApiKey();
  Renderer.drawText(hasGeminiKey ? t('configured') : t('notConfigured'), 200, y + 42, {
    font: '12px system-ui', color: hasGeminiKey ? COLORS.SUCCESS : COLORS.DANGER, align: 'center'
  });

  Renderer.drawButton(50, y + 62, 145, 38, t('geminiKey'), {
    bgColor: COLORS.BG_SECONDARY, borderColor: COLORS.ACCENT, fontSize: 12
  });
  game.registerClickArea('setApiKey', 50, y + 62, 145, 38, () => game.promptApiKey());

  Renderer.drawButton(205, y + 62, 145, 38, t('testGenerate'), {
    bgColor: COLORS.BG_SECONDARY, borderColor: COLORS.WARNING, fontSize: 12
  });
  game.registerClickArea('testAI', 205, y + 62, 145, 38, () => game.testAIGeneration());
  y += 120;

  // API 키 발급 안내
  Renderer.roundRect(20, y, 360, 145, 16, COLORS.BG_CARD);
  Renderer.drawText(t('apiGuide'), 200, y + 20, { font: 'bold 14px system-ui', align: 'center' });

  const instructions = [
    t('smilePrintSection'), t('requestAdmin'), '',
    t('geminiSection'), t('visitAiStudio'), t('createApiKey')
  ];
  instructions.forEach((text, i) => {
    const isBold = text.startsWith('[');
    Renderer.drawText(text, 200, y + 42 + i * 17, {
      font: isBold ? 'bold 11px system-ui' : '11px system-ui',
      color: isBold ? COLORS.TEXT_PRIMARY : COLORS.TEXT_SECONDARY, align: 'center'
    });
  });
  y += 155;

  // AI 기능 설명
  Renderer.roundRect(20, y, 360, 80, 16, COLORS.BG_CARD);
  Renderer.drawText(t('aiFeatures'), 200, y + 18, { font: 'bold 12px system-ui', align: 'center' });

  [t('aiFeature1'), t('aiFeature2'), t('aiFeature3')].forEach((text, i) => {
    Renderer.drawText(text, 200, y + 38 + i * 15, { font: '11px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  });
  y += 90;

  game.scrollMaxY = Math.max(0, y - 700);
}

// ─── 데이터 관리 탭 ───
function renderDataTab(game, startY) {
  let y = startY;

  // 데이터 관리
  Renderer.roundRect(20, y, 360, 130, 16, COLORS.BG_CARD);
  Renderer.drawText(`${t('dataManage')} (${t('problemCount', game.monsterManager.monsters.length)})`, 200, y + 25, {
    font: 'bold 14px system-ui', align: 'center'
  });

  Renderer.drawButton(35, y + 45, 155, 35, t('export'), { bgColor: COLORS.SUCCESS, fontSize: 13 });
  game.registerClickArea('exportProblems', 35, y + 45, 155, 35, () => game.exportProblems());

  Renderer.drawButton(210, y + 45, 155, 35, t('import'), { bgColor: COLORS.ACCENT, fontSize: 13 });
  game.registerClickArea('importProblems', 210, y + 45, 155, 35, () => game.importProblems());

  Renderer.drawButton(35, y + 90, 330, 35, t('resetAll'), { bgColor: COLORS.DANGER, fontSize: 13 });
  game.registerClickArea('resetProblems', 35, y + 90, 330, 35, () => game.resetAllProblems());
  y += 145;

  // 가이드 다시보기
  Renderer.roundRect(20, y, 360, 60, 16, COLORS.BG_CARD);
  Renderer.drawButton(35, y + 10, 330, 40, t('viewGuide'), { bgColor: COLORS.ACCENT, fontSize: 14 });
  game.registerClickArea('viewGuide', 35, y + 10, 330, 40, () => game.showGuide());
  y += 75;

  // 계정 초기화
  Renderer.roundRect(20, y, 360, 80, 16, COLORS.BG_CARD);
  Renderer.drawText(t('resetAccount'), 200, y + 22, { font: 'bold 14px system-ui', align: 'center' });
  Renderer.drawButton(35, y + 40, 330, 35, t('resetAccount'), { bgColor: COLORS.DANGER, fontSize: 13 });
  game.registerClickArea('resetAccount', 35, y + 40, 330, 35, () => game.resetAccount());
  y += 95;

  game.scrollMaxY = Math.max(0, y - 700);
}
