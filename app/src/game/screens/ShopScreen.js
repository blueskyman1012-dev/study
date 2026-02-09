// 상점 화면 렌더링 (탭 분류)
import { Renderer } from '../../canvas/Renderer.js';
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
      currentShopTab = i;
      game.scrollY = 0;
      game.scrollMaxY = 0;
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
  const cardH = 90;
  let y = startY;

  upgrades.forEach(([key, upgrade]) => {
    const currentLevel = player.permanentUpgrades?.[key] || 0;
    const isMaxed = currentLevel >= upgrade.maxLevel;
    const price = shopManager.getUpgradePrice(key);
    const canBuy = player.gold >= price && !isMaxed;

    const innerH = cardH - 6;
    const cardAlpha = (!canBuy && !isMaxed) ? 0.5 : 1.0;

    // 카드 배경
    Renderer.roundRect(10, y, W - 20, innerH, 12, COLORS.BG_CARD);

    // 왼쪽 악센트 테두리
    if (isMaxed) {
      Renderer.roundRect(10, y + 6, 3, innerH - 12, 1.5, COLORS.SUCCESS);
    } else if (canBuy) {
      Renderer.roundRect(10, y + 6, 3, innerH - 12, 1.5, COLORS.ACCENT);
    }

    // 구매 불가 시 어둡게 처리 (오버레이)
    if (cardAlpha < 1.0) {
      Renderer.roundRect(10, y, W - 20, innerH, 12, 'rgba(0,0,0,0.35)');
    }

    // 왼쪽 아이콘 원형 영역
    const iconCX = 42;
    const iconCY = y + innerH / 2;
    Renderer.roundRect(iconCX - 18, iconCY - 18, 36, 36, 18, isMaxed ? 'rgba(34,197,94,0.2)' : 'rgba(99,102,241,0.15)');
    Renderer.drawText(upgrade.icon, iconCX, iconCY - 10, { font: '22px system-ui', align: 'center' });

    // 이름
    const nameY = y + Math.round(innerH * 0.25);
    Renderer.drawText(t(upgrade.nameKey), 72, nameY, {
      font: 'bold 15px system-ui', color: COLORS.TEXT_PRIMARY
    });

    // 프로그레스 바 (130px 넓이)
    const barX = 72, barW = 130, barH = 8, barY = nameY + 18;
    const fillRatio = currentLevel / upgrade.maxLevel;
    Renderer.roundRect(barX, barY, barW, barH, 4, COLORS.BG_SECONDARY);
    if (fillRatio > 0) {
      Renderer.roundRect(barX, barY, Math.round(barW * fillRatio), barH, 4, isMaxed ? COLORS.SUCCESS : COLORS.ACCENT);
    }
    Renderer.drawText(`${currentLevel}/${upgrade.maxLevel}`, barX + barW + 8, barY - 2, {
      font: '12px system-ui', color: isMaxed ? COLORS.SUCCESS : COLORS.TEXT_SECONDARY
    });

    // 설명
    const descY = y + Math.round(innerH * 0.72);
    Renderer.drawText(t(upgrade.descKey), 72, descY, { font: '12px system-ui', color: COLORS.TEXT_SECONDARY });

    // 버튼
    const btnW = 88, btnH = 30;
    const btnX = W - 10 - btnW - 8;
    const btnY = y + Math.round((innerH - btnH) / 2);

    if (isMaxed) {
      Renderer.roundRect(btnX, btnY, btnW, btnH, 8, COLORS.SUCCESS);
      Renderer.drawText('✓ MAX', btnX + btnW / 2, btnY + 8, { font: 'bold 13px system-ui', color: '#000', align: 'center' });
    } else {
      const btnColor = canBuy ? COLORS.WARNING : COLORS.BG_SECONDARY;
      Renderer.roundRect(btnX, btnY, btnW, btnH, 8, btnColor);
      Renderer.drawText(`${price}G`, btnX + btnW / 2, btnY + 8, {
        font: 'bold 13px system-ui', color: canBuy ? '#000' : COLORS.TEXT_SECONDARY, align: 'center'
      });
      if (canBuy) {
        game.registerClickArea(`upgrade_${key}`, btnX, btnY, btnW, btnH, () => shopManager.buyUpgrade(key));
      }
    }

    y += cardH;
  });

  y += 20;
  game.scrollMaxY = Math.max(0, y - H);
}

// ─── 아이템 탭 ───
function renderConsumeTab(game, player, shopManager, startY, W, H) {
  const cardH = 90;
  let y = startY;

  CONSUME_KEYS.forEach((key) => {
    const item = SHOP_ITEMS[key];
    if (!item) return;
    const owned = player.inventory?.[key] || 0;
    const canBuy = player.gold >= item.price;

    const innerH = cardH - 6;

    // 카드 배경
    Renderer.roundRect(10, y, W - 20, innerH, 12, COLORS.BG_CARD);

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

    // 보유 수량 뱃지 (이름 옆 고정 위치)
    if (owned > 0) {
      Renderer.roundRect(175, nameY - 4, 44, 22, 11, 'rgba(99,102,241,0.25)');
      Renderer.drawText(`×${owned}`, 197, nameY, { font: 'bold 12px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center' });
    } else {
      Renderer.drawText('×0', 197, nameY, { font: '12px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
    }

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
    if (canBuy) {
      game.registerClickArea(`buy_${key}`, btnX, btnY, btnW, btnH, () => shopManager.buyItem(key));
    }

    y += cardH;
  });

  y += 20;
  game.scrollMaxY = Math.max(0, y - H);
}

// ─── 꾸미기 탭 ───
function renderCosmeticTab(game, player, shopManager, startY, W, H) {
  const cardH = 90;
  let y = startY;

  COSMETIC_KEYS.forEach((key) => {
    const item = SHOP_ITEMS[key];
    if (!item) return;
    const canBuy = player.gold >= item.price;

    const innerH = cardH - 6;

    // 카드 배경
    Renderer.roundRect(10, y, W - 20, innerH, 12, COLORS.BG_CARD);

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
    if (canBuy) {
      game.registerClickArea(`buy_${key}`, btnX, btnY, btnW, btnH, () => shopManager.buyItem(key));
    }

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
      currentShopTab = i;
      game.scrollY = 0;
      game.scrollMaxY = 0;
    });
  });
}
