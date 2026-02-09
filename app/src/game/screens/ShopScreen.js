// 상점 화면 렌더링 (탭 분류)
import { Renderer, BG_THEMES } from '../../canvas/Renderer.js';
import { SCREENS, COLORS, UPGRADES, SHOP_ITEMS } from '../../utils/constants.js';
import { t } from '../../i18n/i18n.js';


// 현재 선택된 탭 (모듈 레벨 상태)
let currentShopTab = 0;
const SHOP_TABS = [
  { labelKey: 'shopTabUpgrade', icon: '⚡' },
  { labelKey: 'shopTabConsume', icon: '🎒' },
  { labelKey: 'shopTabCosmetic', icon: '🎨' },
];

// 탭별 아이템 분류
const CONSUME_KEYS = ['reviveTicket', 'hintTicket', 'timeBoost', 'doubleGold'];
const COSMETIC_KEYS = ['randomBg'];

// 스탯 미리보기 계산
function getUpgradePreview(game, upgradeKey) {
  const pm = game.playerManager;
  const player = pm.player;
  const upgrade = UPGRADES[upgradeKey];
  const currentLevel = player.permanentUpgrades?.[upgradeKey] || 0;

  if (currentLevel >= upgrade.maxLevel) return null;

  switch (upgradeKey) {
    case 'hp': {
      const currentVal = pm.getTotalMaxHp();
      const nextVal = currentVal + upgrade.value;
      return { current: currentVal, next: nextVal, label: t('shopHp') };
    }
    case 'damage': {
      const currentVal = pm.getTotalDamage();
      const nextVal = currentVal + upgrade.value;
      return { current: currentVal, next: nextVal, label: t('shopAtk') };
    }
    case 'time': {
      const currentVal = pm.getTotalTime();
      const nextVal = currentVal + upgrade.value;
      return { current: currentVal, next: nextVal, label: t('shopTime') };
    }
    case 'goldBonus': {
      const currentVal = (player.permanentUpgrades?.goldBonus || 0) * upgrade.value;
      const nextVal = currentVal + upgrade.value;
      return { current: currentVal + '%', next: nextVal + '%', label: t('shopGoldBonus') };
    }
    default:
      return null;
  }
}

export function renderShopScreen(game) {
  const player = game.playerManager.player;
  const shopManager = game.shopManager;
  const W = 400, H = 700;

  Renderer.drawGrid();

  // === 헤더 (0~50) ===
  Renderer.roundRect(0, 0, W, 50, 0, COLORS.BG_SECONDARY);
  Renderer.drawText(t('shopTitle'), W / 2, 16, { font: 'bold 20px system-ui', align: 'center' });

  Renderer.drawText(t('back'), 30, 18, { font: '15px system-ui', color: COLORS.ACCENT_LIGHT });
  game.registerClickArea('back', 0, 0, 90, 50, () => game.changeScreen(SCREENS.MAIN));

  Renderer.roundRect(275, 10, 115, 32, 10, 'rgba(251,191,36,0.15)');
  Renderer.drawText(`💰 ${player.gold.toLocaleString()}G`, 332, 18, {
    font: 'bold 15px system-ui', color: COLORS.WARNING, align: 'center'
  });

  // === 탭 바 (50~86) ===
  const tabY = 50;
  const tabH = 36;
  const tabW = Math.floor(W / SHOP_TABS.length);
  SHOP_TABS.forEach((tab, i) => {
    const x = i * tabW;
    const isActive = i === currentShopTab;
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
    game.registerClickArea(`shop_tab_${i}`, x, tabY, tabW, tabH, () => {
      if (currentShopTab !== i) {
        currentShopTab = i;
        game.scrollY = 0;
        game.scrollMaxY = 0;
        game.effects.flashScreen(COLORS.ACCENT, 0.05);
      }
    });
  });

  const contentStartY = tabY + tabH + 12;

  switch (currentShopTab) {
    case 0: renderUpgradeTab(game, player, shopManager, contentStartY, W, H); break;
    case 1: renderConsumeTab(game, player, shopManager, contentStartY, W, H); break;
    case 2: renderCosmeticTab(game, player, shopManager, contentStartY, W, H); break;
  }
}

// ─── 강화 탭 ───
function renderUpgradeTab(game, player, shopManager, startY, W, H) {
  const upgrades = Object.entries(UPGRADES);
  const cardH = 110;
  let y = startY;

  // === 스탯 요약 패널 ===
  const panelH = 60;
  const panelX = 10, panelW = W - 20;

  // 그래디언트 배경
  Renderer.drawGradientCard(panelX, y, panelW, panelH, 10, 'rgba(99,102,241,0.12)', 'rgba(99,102,241,0.04)');
  // 인디고 테두리
  Renderer.ctx.save();
  Renderer.ctx.strokeStyle = 'rgba(99,102,241,0.3)';
  Renderer.ctx.lineWidth = 1;
  Renderer.ctx.beginPath();
  Renderer.ctx.roundRect(panelX, y, panelW, panelH, 10);
  Renderer.ctx.stroke();
  Renderer.ctx.restore();

  // 타이틀
  Renderer.drawText(t('shopStatSummary'), panelX + 12, y + 8, {
    font: 'bold 11px system-ui', color: COLORS.ACCENT_LIGHT
  });

  // 4컬럼 스탯 표시
  const pm = game.playerManager;
  const stats = [
    { label: t('shopHp'), value: pm.getTotalMaxHp(), color: '#22c55e' },
    { label: t('shopAtk'), value: pm.getTotalDamage(), color: '#ef4444' },
    { label: t('shopTime'), value: pm.getTotalTime(), color: '#3b82f6' },
    { label: t('shopGoldBonus'), value: (player.permanentUpgrades?.goldBonus || 0) * (UPGRADES.goldBonus?.value || 15) + '%', color: '#fbbf24' },
  ];
  const colW = panelW / 4;
  stats.forEach((s, i) => {
    const cx = panelX + colW * i + colW / 2;
    Renderer.drawText(s.label, cx, y + 26, {
      font: '10px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center'
    });
    Renderer.drawText(String(s.value), cx, y + 40, {
      font: 'bold 14px system-ui', color: s.color, align: 'center'
    });
  });

  y += panelH + 10;

  // === 업그레이드 카드 ===
  upgrades.forEach(([key, upgrade]) => {
    const currentLevel = player.permanentUpgrades?.[key] || 0;
    const isMaxed = currentLevel >= upgrade.maxLevel;
    const price = shopManager.getUpgradePrice(key);
    const canBuy = player.gold >= price && !isMaxed;

    const innerH = cardH - 6;

    // 그래디언트 카드 배경
    Renderer.drawGradientCard(10, y, W - 20, innerH, 12, '#1e1e2e', '#16161f');

    // 왼쪽 악센트 테두리
    if (isMaxed) {
      Renderer.roundRect(10, y + 6, 3, innerH - 12, 1.5, COLORS.SUCCESS);
    } else if (canBuy) {
      Renderer.roundRect(10, y + 6, 3, innerH - 12, 1.5, COLORS.ACCENT);
    }

    // 구매 불가 시 어둡게 처리 (오버레이)
    if (!canBuy && !isMaxed) {
      Renderer.roundRect(10, y, W - 20, innerH, 12, 'rgba(0,0,0,0.35)');
    }

    // 왼쪽 아이콘 원형 영역
    const iconCX = 42;
    const iconCY = y + innerH / 2;
    Renderer.roundRect(iconCX - 18, iconCY - 18, 36, 36, 18, isMaxed ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.15)');
    Renderer.drawText(upgrade.icon, iconCX, iconCY - 10, { font: '22px system-ui', align: 'center' });

    // 이름 + 레벨 뱃지
    const nameY = y + 14;
    Renderer.drawText(t(upgrade.nameKey), 72, nameY, {
      font: 'bold 15px system-ui', color: COLORS.TEXT_PRIMARY
    });

    // 레벨 뱃지
    const lvText = isMaxed ? t('shopMaxReached') : `Lv.${currentLevel}`;
    const lvColor = isMaxed ? COLORS.SUCCESS : COLORS.ACCENT_LIGHT;
    const lvBgColor = isMaxed ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.2)';
    const nameWidth = Renderer.ctx.measureText(t(upgrade.nameKey)).width;
    Renderer.roundRect(72 + nameWidth + 6, nameY - 2, 48, 18, 9, lvBgColor);
    Renderer.drawText(lvText, 72 + nameWidth + 30, nameY + 1, {
      font: 'bold 10px system-ui', color: lvColor, align: 'center'
    });

    // 프로그레스 바 (160px 넓이) + 레벨 마커 점
    const barX = 72, barW = 160, barH = 8, barY = nameY + 22;
    const fillRatio = currentLevel / upgrade.maxLevel;
    Renderer.roundRect(barX, barY, barW, barH, 4, COLORS.BG_SECONDARY);
    if (fillRatio > 0) {
      Renderer.roundRect(barX, barY, Math.round(barW * fillRatio), barH, 4, isMaxed ? COLORS.SUCCESS : COLORS.ACCENT);
    }
    // 레벨 마커 점
    for (let i = 1; i < upgrade.maxLevel; i++) {
      const mx = barX + Math.round(barW * (i / upgrade.maxLevel));
      Renderer.drawCircle(mx, barY + barH / 2, 1.5, i <= currentLevel ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.1)');
    }
    Renderer.drawText(`${currentLevel}/${upgrade.maxLevel}`, barX + barW + 8, barY - 2, {
      font: '12px system-ui', color: isMaxed ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY
    });

    // 스탯 미리보기
    const preview = getUpgradePreview(game, key);
    if (preview) {
      const previewY = barY + 16;
      Renderer.drawText(`${preview.label}: `, 72, previewY, {
        font: '12px system-ui', color: COLORS.TEXT_SECONDARY
      });
      const labelW = Renderer.ctx.measureText(`${preview.label}: `).width;
      Renderer.drawText(String(preview.current), 72 + labelW, previewY, {
        font: 'bold 12px system-ui', color: '#fff'
      });
      const curW = Renderer.ctx.measureText(String(preview.current)).width;
      Renderer.drawText(' → ', 72 + labelW + curW, previewY, {
        font: '12px system-ui', color: COLORS.TEXT_SECONDARY
      });
      const arrowW = Renderer.ctx.measureText(' → ').width;
      Renderer.drawText(String(preview.next), 72 + labelW + curW + arrowW, previewY, {
        font: 'bold 12px system-ui', color: COLORS.SUCCESS
      });
    }

    // 설명
    const descY = y + innerH - 18;
    Renderer.drawText(t(upgrade.descKey), 72, descY, { font: '11px system-ui', color: COLORS.TEXT_SECONDARY });

    // 버튼
    const btnW = 88, btnH = 30;
    const btnX = W - 10 - btnW - 8;
    const btnY = y + Math.round((innerH - btnH) / 2);

    if (isMaxed) {
      // MAX 버튼: 초록 그래디언트
      Renderer.drawGradientCard(btnX, btnY, btnW, btnH, 8, '#22c55e', '#16a34a');
      Renderer.drawText(t('shopMaxReached'), btnX + btnW / 2, btnY + 8, { font: 'bold 13px system-ui', color: '#000', align: 'center' });
    } else {
      const btnColor = canBuy ? COLORS.WARNING : COLORS.BG_SECONDARY;
      Renderer.roundRect(btnX, btnY, btnW, btnH, 8, btnColor);
      Renderer.drawText(`${price}G`, btnX + btnW / 2, btnY + 8, {
        font: 'bold 13px system-ui', color: canBuy ? '#000' : COLORS.TEXT_SECONDARY, align: 'center'
      });
      // 구매 가능이든 불가든 클릭 영역 등록
      game.registerClickArea(`upgrade_${key}`, btnX, btnY, btnW, btnH, () => shopManager.buyUpgrade(key));
    }

    y += cardH;
  });

  y += 20;
  game.scrollMaxY = Math.max(0, y - H);
}

// ─── 아이템 탭 ───
function renderConsumeTab(game, player, shopManager, startY, W, H) {
  const cardH = 105;
  let y = startY;

  CONSUME_KEYS.forEach((key) => {
    const item = SHOP_ITEMS[key];
    if (!item) return;
    const owned = player.inventory?.[key] || 0;
    const canBuy = player.gold >= item.price;
    const canBuyBulk = player.gold >= item.price * 5;

    const innerH = cardH - 6;

    // 그래디언트 카드 배경
    Renderer.drawGradientCard(10, y, W - 20, innerH, 12, '#1e1e2e', '#16161f');

    // 왼쪽 악센트 테두리
    if (canBuy) {
      Renderer.roundRect(10, y + 6, 3, innerH - 12, 1.5, COLORS.ACCENT);
    }

    // 구매 불가 시 어둡게
    if (!canBuy) {
      Renderer.roundRect(10, y, W - 20, innerH, 12, 'rgba(0,0,0,0.35)');
    }

    // 왼쪽 아이콘 원형 영역
    const iconCX = 42;
    const iconCY = y + innerH / 2 - 5;
    Renderer.roundRect(iconCX - 18, iconCY - 18, 36, 36, 18, 'rgba(99,102,241,0.15)');
    Renderer.drawText(item.icon, iconCX, iconCY - 10, { font: '22px system-ui', align: 'center' });

    // 이름
    const nameY = y + 14;
    Renderer.drawText(t(item.nameKey), 72, nameY, {
      font: 'bold 15px system-ui', color: COLORS.TEXT_PRIMARY
    });

    // 수량 뱃지 (이름 옆)
    if (owned > 0) {
      Renderer.roundRect(175, nameY - 4, 44, 22, 11, 'rgba(99,102,241,0.25)');
      Renderer.drawText(`×${owned}`, 197, nameY, { font: 'bold 12px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center' });
    } else {
      Renderer.drawText('×0', 197, nameY, { font: '12px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
    }

    // 설명
    const descY = nameY + 20;
    Renderer.drawText(t(item.descKey), 72, descY, { font: '12px system-ui', color: COLORS.TEXT_SECONDARY });

    // 사용법 힌트 (신규)
    if (item.hintKey) {
      const hintY = descY + 16;
      Renderer.drawText(`💡 ${t(item.hintKey)}`, 72, hintY, {
        font: '11px system-ui', color: 'rgba(251,191,36,0.7)'
      });
    }

    // ×1 구매 버튼
    const btnW = 88, btnH = 28;
    const btnX = W - 10 - btnW - 8;
    const btnY = y + 14;
    const btnColor = canBuy ? COLORS.WARNING : COLORS.BG_SECONDARY;
    Renderer.roundRect(btnX, btnY, btnW, btnH, 8, btnColor);
    Renderer.drawText(`${item.price}G`, btnX + btnW / 2, btnY + 7, {
      font: 'bold 13px system-ui', color: canBuy ? '#000' : COLORS.TEXT_SECONDARY, align: 'center'
    });
    // 구매 가능이든 불가든 클릭 영역 등록
    game.registerClickArea(`buy_${key}`, btnX, btnY, btnW, btnH, () => shopManager.buyItem(key));

    // ×5 대량 구매 버튼
    const bulkBtnW = 88, bulkBtnH = 26;
    const bulkBtnX = btnX;
    const bulkBtnY = btnY + btnH + 6;
    const bulkPrice = item.price * 5;
    const bulkColor = canBuyBulk ? 'rgba(251,191,36,0.7)' : COLORS.BG_SECONDARY;
    Renderer.roundRect(bulkBtnX, bulkBtnY, bulkBtnW, bulkBtnH, 6, bulkColor);
    Renderer.drawText(`×5 ${bulkPrice}G`, bulkBtnX + bulkBtnW / 2, bulkBtnY + 6, {
      font: 'bold 11px system-ui', color: canBuyBulk ? '#000' : COLORS.TEXT_SECONDARY, align: 'center'
    });
    // 터치 영역 40px로 확장
    game.registerClickArea(`bulkbuy_${key}`, bulkBtnX, bulkBtnY - 7, bulkBtnW, 40, () => shopManager.buyItemBulk(key, 5));

    y += cardH;
  });

  y += 20;
  game.scrollMaxY = Math.max(0, y - H);
}

// ─── 꾸미기 탭 ───
function renderCosmeticTab(game, player, shopManager, startY, W, H) {
  let y = startY;

  // === 현재 테마 표시 패널 ===
  const panelH = 50;
  const panelX = 10, panelW = W - 20;
  Renderer.drawGradientCard(panelX, y, panelW, panelH, 10, 'rgba(99,102,241,0.12)', 'rgba(99,102,241,0.04)');
  Renderer.ctx.save();
  Renderer.ctx.strokeStyle = 'rgba(99,102,241,0.3)';
  Renderer.ctx.lineWidth = 1;
  Renderer.ctx.beginPath();
  Renderer.ctx.roundRect(panelX, y, panelW, panelH, 10);
  Renderer.ctx.stroke();
  Renderer.ctx.restore();

  const currentThemeId = Renderer.getCurrentBgThemeId();
  const currentTheme = BG_THEMES.find(th => th.id === currentThemeId) || BG_THEMES[0];

  Renderer.drawText(t('shopCurrentTheme'), panelX + 12, y + 10, {
    font: 'bold 11px system-ui', color: COLORS.ACCENT_LIGHT
  });

  // 컬러 스와치 원형
  Renderer.drawCircle(panelX + 12 + Renderer.ctx.measureText(t('shopCurrentTheme')).width + 16, y + 17, 7, currentTheme.grid);

  // 테마 이름
  Renderer.drawText(t('theme_' + currentThemeId), panelX + 12, y + 30, {
    font: 'bold 14px system-ui', color: COLORS.TEXT_PRIMARY
  });

  y += panelH + 10;

  // === 테마 미리보기 (7개 원형 스와치) ===
  const swatchH = 50;
  Renderer.drawGradientCard(10, y, panelW, swatchH, 10, '#1e1e2e', '#16161f');

  const swatchCount = BG_THEMES.length;
  const swatchSpacing = panelW / (swatchCount + 1);
  BG_THEMES.forEach((theme, i) => {
    const cx = 10 + swatchSpacing * (i + 1);
    const cy = y + swatchH / 2;
    const isActive = theme.id === currentThemeId;
    const radius = isActive ? 14 : 12;

    // 외곽 링 (활성 테마)
    if (isActive) {
      Renderer.drawCircle(cx, cy, radius + 3, null, '#fff');
    }

    // 컬러 스와치
    Renderer.drawCircle(cx, cy, radius, theme.grid);

    // 체크마크 (활성 테마)
    if (isActive) {
      Renderer.drawText('✓', cx, cy - 7, {
        font: 'bold 12px system-ui', color: '#fff', align: 'center'
      });
    }
  });

  y += swatchH + 10;

  // === 랜덤 배경 카드 ===
  const cardH = 90;
  COSMETIC_KEYS.forEach((key) => {
    const item = SHOP_ITEMS[key];
    if (!item) return;
    const canBuy = player.gold >= item.price;

    const innerH = cardH - 6;

    // 그래디언트 카드 배경
    Renderer.drawGradientCard(10, y, W - 20, innerH, 12, '#1e1e2e', '#16161f');

    // 왼쪽 악센트 테두리
    if (canBuy) {
      Renderer.roundRect(10, y + 6, 3, innerH - 12, 1.5, COLORS.ACCENT);
    }

    // 구매 불가 시 어둡게
    if (!canBuy) {
      Renderer.roundRect(10, y, W - 20, innerH, 12, 'rgba(0,0,0,0.35)');
    }

    // 왼쪽 아이콘 원형 영역
    const iconCX = 42;
    const iconCY = y + innerH / 2;
    Renderer.roundRect(iconCX - 18, iconCY - 18, 36, 36, 18, 'rgba(99,102,241,0.15)');
    Renderer.drawText(item.icon, iconCX, iconCY - 10, { font: '22px system-ui', align: 'center' });

    // 이름
    const nameY = y + Math.round(innerH * 0.3);
    Renderer.drawText(t(item.nameKey), 72, nameY, {
      font: 'bold 15px system-ui', color: COLORS.TEXT_PRIMARY
    });

    // 설명
    const descY = y + Math.round(innerH * 0.62);
    Renderer.drawText(t(item.descKey), 72, descY, { font: '12px system-ui', color: COLORS.TEXT_SECONDARY });

    // 구매 버튼
    const btnW = 88, btnH = 30;
    const btnX = W - 10 - btnW - 8;
    const btnY = y + Math.round((innerH - btnH) / 2);
    const btnColor = canBuy ? COLORS.WARNING : COLORS.BG_SECONDARY;
    Renderer.roundRect(btnX, btnY, btnW, btnH, 8, btnColor);
    Renderer.drawText(`${item.price}G`, btnX + btnW / 2, btnY + 8, {
      font: 'bold 13px system-ui', color: canBuy ? '#000' : COLORS.TEXT_SECONDARY, align: 'center'
    });
    // 구매 가능이든 불가든 클릭 영역 등록
    game.registerClickArea(`buy_${key}`, btnX, btnY, btnW, btnH, () => shopManager.buyItem(key));

    y += cardH;
  });

  y += 20;
  game.scrollMaxY = Math.max(0, y - H);
}

// 고정 헤더 + 탭 바 렌더링 (Game.js에서 스크롤 복원 후 호출)
export function renderShopFixedHeader(game) {
  const W = 400;
  const player = game.playerManager.player;

  // 헤더 배경 (0~86)
  Renderer.roundRect(0, 0, W, 86, 0, COLORS.BG_SECONDARY);

  // 헤더 텍스트
  Renderer.drawText(t('shopTitle'), W / 2, 16, { font: 'bold 20px system-ui', align: 'center' });
  Renderer.drawText(t('back'), 30, 18, { font: '15px system-ui', color: COLORS.ACCENT_LIGHT });
  game.registerClickArea('back', 0, 0, 90, 50, () => game.changeScreen(SCREENS.MAIN));

  // 골드 표시
  Renderer.roundRect(275, 10, 115, 32, 10, 'rgba(251,191,36,0.15)');
  Renderer.drawText(`💰 ${player.gold.toLocaleString()}G`, 332, 18, {
    font: 'bold 15px system-ui', color: COLORS.WARNING, align: 'center'
  });

  // 탭 바 (50~86)
  const tabY = 50;
  const tabH = 36;
  const tabW = Math.floor(W / SHOP_TABS.length);
  SHOP_TABS.forEach((tab, i) => {
    const x = i * tabW;
    const isActive = i === currentShopTab;
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
    game.registerClickArea(`shop_tab_${i}`, x, tabY, tabW, tabH, () => {
      if (currentShopTab !== i) {
        currentShopTab = i;
        game.scrollY = 0;
        game.scrollMaxY = 0;
        game.effects.flashScreen(COLORS.ACCENT, 0.05);
      }
    });
  });
}
