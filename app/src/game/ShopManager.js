// 상점 구매 로직
import { UPGRADES, SHOP_ITEMS, COSMETIC_ITEMS } from '../utils/constants.js';
import { SoundService } from '../services/SoundService.js';
import { Renderer } from '../canvas/Renderer.js';
import { t } from '../i18n/i18n.js';


export class ShopManager {
  constructor(game) {
    this.game = game;
  }

  get player() { return this.game.playerManager.player; }

  // 통일된 가격 계산 함수
  getUpgradePrice(upgradeKey) {
    const upgrade = UPGRADES[upgradeKey];
    if (!upgrade) return 0;
    const currentLevel = this.player.permanentUpgrades?.[upgradeKey] || 0;

    // 가속 가격 체계 (goldBonus 등)
    if (upgrade.priceAccelStart) {
      let price = upgrade.basePrice;
      for (let i = 0; i < currentLevel; i++) {
        let rate = 1.1;
        if (i >= 5) rate = 1.15;
        if (i >= upgrade.priceAccelStart) {
          const tiers = Math.floor((i - upgrade.priceAccelStart) / upgrade.priceAccelInterval) + 1;
          rate = 1.15 + tiers * upgrade.priceAccelStep;
        }
        price *= rate;
      }
      return Math.ceil(price / 10) * 10;
    }

    if (currentLevel >= 5) {
      const baseTo5 = upgrade.basePrice * Math.pow(1.1, 5);
      return Math.ceil(baseTo5 * Math.pow(1.15, currentLevel - 5) / 10) * 10;
    }
    return Math.ceil(upgrade.basePrice * Math.pow(1.1, currentLevel) / 10) * 10;
  }

  async buyUpgrade(upgradeKey) {
    const upgrade = UPGRADES[upgradeKey];
    if (!upgrade) return;

    if (!this.player.permanentUpgrades) {
      this.player.permanentUpgrades = { hp: 0, time: 0, goldBonus: 0, damage: 0 };
    }

    const currentLevel = this.player.permanentUpgrades[upgradeKey] || 0;
    if (currentLevel >= upgrade.maxLevel) return;

    const price = this.getUpgradePrice(upgradeKey);
    if (this.player.gold < price) {
      this.showInsufficientGold(price);
      return;
    }

    this.player.gold -= price;
    this.player.permanentUpgrades[upgradeKey] = currentLevel + 1;

    if (upgradeKey === 'hp') {
      this.player.maxHp += upgrade.value;
      this.player.currentHp = this.player.maxHp;
    }

    SoundService.playClick();
    await this.game.playerManager.save();
    this.game.achievementManager.checkPowerAchievements();

    // 시각 효과: 파티클 + 플래시 + 플로팅 텍스트
    this.game.effects.addParticleExplosion(200, 350, '#22c55e', 15);
    this.game.effects.flashScreen('#22c55e', 0.15);
    this.game.effects.floatingTexts.push({
      x: 200, y: 350,
      text: `-${price}G`,
      color: '#fbbf24',
      fontSize: 18,
      speed: 1.5,
      life: 1000,
      maxLife: 1000,
      alpha: 1,
      scale: 1
    });
  }

  async buyItem(itemKey) {
    const item = SHOP_ITEMS[itemKey];
    if (!item) return;

    if (this.player.gold < item.price) {
      this.showInsufficientGold(item.price);
      return;
    }

    // 랜덤 배경 (색상 테마)
    if (itemKey === 'randomBg') {
      this.player.gold -= item.price;
      SoundService.playClick();
      await this.game.playerManager.save();
      Renderer.setRandomBgTheme();
      this.game.effects.flashScreen('#9333ea', 0.3);
      this.game.render();
      return;
    }

    if (!this.player.inventory) {
      this.player.inventory = { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 };
    }

    this.player.gold -= item.price;
    this.player.inventory[itemKey] = (this.player.inventory[itemKey] || 0) + 1;

    SoundService.playClick();
    await this.game.playerManager.save();

    // 시각 효과: 파티클 + 플래시 + 플로팅 텍스트
    this.game.effects.addParticleExplosion(200, 350, '#fbbf24', 12);
    this.game.effects.flashScreen('#fbbf24', 0.15);
    this.game.effects.floatingTexts.push({
      x: 200, y: 350,
      text: `-${item.price}G`,
      color: '#fbbf24',
      fontSize: 18,
      speed: 1.5,
      life: 1000,
      maxLife: 1000,
      alpha: 1,
      scale: 1
    });
  }

  async buyItemBulk(itemKey, count = 5) {
    const item = SHOP_ITEMS[itemKey];
    if (!item || itemKey === 'randomBg') return;

    const totalPrice = item.price * count;
    if (this.player.gold < totalPrice) {
      this.showInsufficientGold(totalPrice);
      return;
    }

    if (!this.player.inventory) {
      this.player.inventory = { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 };
    }

    this.player.gold -= totalPrice;
    this.player.inventory[itemKey] = (this.player.inventory[itemKey] || 0) + count;

    SoundService.playClick();
    await this.game.playerManager.save();

    // 시각 효과
    this.game.effects.addParticleExplosion(200, 350, '#fbbf24', 20);
    this.game.effects.flashScreen('#fbbf24', 0.2);
    this.game.effects.floatingTexts.push({
      x: 200, y: 350,
      text: `-${totalPrice}G`,
      color: '#fbbf24',
      fontSize: 20,
      speed: 1.5,
      life: 1000,
      maxLife: 1000,
      alpha: 1,
      scale: 1
    });
  }

  async buyCosmetic(category, itemId) {
    const cat = COSMETIC_ITEMS[category];
    if (!cat) return;
    const item = cat.items.find(i => i.id === itemId);
    if (!item || item.price === 0) return;

    const cosmetics = this.player.cosmetics;

    // 테마 카테고리
    if (category === 'theme') {
      if (cosmetics.purchasedThemes.includes(itemId)) {
        // 이미 구매 → 즉시 적용
        Renderer.setBgTheme(itemId);
        SoundService.playClick();
        this.game.render();
        return;
      }
      if (this.player.gold < item.price) {
        this.showInsufficientGold(item.price);
        return;
      }
      this.player.gold -= item.price;
      cosmetics.purchasedThemes.push(itemId);
      Renderer.setBgTheme(itemId);
    } else {
      // particle, damageText, correctFlash
      const purchasedKey = category === 'particle' ? 'purchasedParticles'
        : category === 'damageText' ? 'purchasedDamageText'
        : 'purchasedFlash';
      const activeKey = category === 'particle' ? 'particleStyle'
        : category === 'damageText' ? 'damageTextStyle'
        : 'correctFlash';

      if (cosmetics[purchasedKey].includes(itemId)) {
        // 이미 구매 → 장착 전환
        cosmetics[activeKey] = itemId;
        SoundService.playClick();
        await this.game.playerManager.save();
        this.game.render();
        return;
      }
      if (this.player.gold < item.price) {
        this.showInsufficientGold(item.price);
        return;
      }
      this.player.gold -= item.price;
      cosmetics[purchasedKey].push(itemId);
      cosmetics[activeKey] = itemId;
    }

    SoundService.playClick();
    await this.game.playerManager.save();

    this.game.effects.addParticleExplosion(200, 350, '#9333ea', 15);
    this.game.effects.flashScreen('#9333ea', 0.2);
    this.game.effects.floatingTexts.push({
      x: 200, y: 350,
      text: `-${item.price}G`,
      color: '#fbbf24',
      fontSize: 18,
      speed: 1.5,
      life: 1000,
      maxLife: 1000,
      alpha: 1,
      scale: 1
    });
  }

  equipCosmetic(category, itemId) {
    const cosmetics = this.player.cosmetics;
    if (category === 'theme') {
      if (!cosmetics.purchasedThemes.includes(itemId)) return;
      Renderer.setBgTheme(itemId);
      SoundService.playClick();
      this.game.playerManager.save();
      this.game.render();
    } else {
      const purchasedKey = category === 'particle' ? 'purchasedParticles'
        : category === 'damageText' ? 'purchasedDamageText'
        : 'purchasedFlash';
      const activeKey = category === 'particle' ? 'particleStyle'
        : category === 'damageText' ? 'damageTextStyle'
        : 'correctFlash';
      if (!cosmetics[purchasedKey].includes(itemId)) return;
      cosmetics[activeKey] = itemId;
      SoundService.playClick();
      this.game.playerManager.save();
      this.game.render();
    }
  }

  showInsufficientGold(price) {
    const shortage = price - this.player.gold;
    this.game.effects.shakeScreen(3);
    this.game.effects.floatingTexts.push({
      x: 200, y: 350,
      text: t('shopNotEnoughShort', shortage),
      color: '#ef4444',
      fontSize: 16,
      speed: 1.5,
      life: 1000,
      maxLife: 1000,
      alpha: 1,
      scale: 1
    });
  }
}
