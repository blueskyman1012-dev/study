// 아이템 드랍, 효과 적용
import { DROP_RATES, RARITY } from '../utils/constants.js';
import { SoundService } from '../services/SoundService.js';
import { t } from '../i18n/i18n.js';

export class ItemManager {
  constructor(game) {
    this.game = game;
    this.droppedItem = null;
  }

  checkDrop(monster, game) {
    const bossType = monster.bossType;
    let dropChance = DROP_RATES.MONSTER;

    if (bossType === 'FINAL_BOSS') dropChance = 1.0;
    else if (bossType === 'MID_BOSS') dropChance = 0.7;
    else if (bossType === 'NORMAL_BOSS') dropChance = DROP_RATES.BOSS;

    if (Math.random() < dropChance) {
      const item = this.rollItemDrop(bossType);
      this.onItemDrop(item, game);

      if (bossType === 'FINAL_BOSS' && Math.random() < 0.5) {
        const bonusItem = this.rollItemDrop(bossType);
        setTimeout(() => this.onItemDrop(bonusItem, game), 500);
      }
    }
  }

  rollItemDrop(isBoss) {
    const roll = Math.random();
    let rarity;

    if (roll < RARITY.LEGENDARY.dropRate) {
      rarity = RARITY.LEGENDARY;
    } else if (roll < RARITY.LEGENDARY.dropRate + RARITY.EPIC.dropRate) {
      rarity = RARITY.EPIC;
    } else if (roll < RARITY.LEGENDARY.dropRate + RARITY.EPIC.dropRate + RARITY.RARE.dropRate) {
      rarity = RARITY.RARE;
    } else {
      rarity = RARITY.NORMAL;
    }

    const items = this.getItemsByRarity(rarity);
    const item = items[Math.floor(Math.random() * items.length)];
    return { ...item, rarity };
  }

  getItemsByRarity(rarity) {
    const itemPool = {
      normal: [
        { name: t('item.hpPotion'), effect: 'hp', value: 10, icon: '❤️' },
        { name: t('item.timeSand'), effect: 'time', value: 5, icon: '⏳' },
        { name: t('item.smallGoldBag'), effect: 'gold', value: 20, icon: '💰' }
      ],
      rare: [
        { name: t('item.highHpPotion'), effect: 'hp', value: 25, icon: '💖' },
        { name: t('item.timeCrystal'), effect: 'time', value: 10, icon: '⌛' },
        { name: t('item.goldBag'), effect: 'gold', value: 50, icon: '💎' },
        { name: t('item.comboBooster'), effect: 'combo', value: 3, icon: '🔥' }
      ],
      epic: [
        { name: t('item.holyGrail'), effect: 'hp', value: 50, icon: '🏆' },
        { name: t('item.freeHint'), effect: 'freeHint', value: 1, icon: '💡' },
        { name: t('item.reviveFeather'), effect: 'revive', value: 1, icon: '🪶' },
        { name: t('item.goldAmulet'), effect: 'goldMulti', value: 1.25, icon: '✨' }
      ],
      legendary: [
        { name: t('item.immortalRing'), effect: 'revive', value: 2, icon: '💍' },
        { name: t('item.timeStop'), effect: 'timeStop', value: 1, icon: '⏱️' },
        { name: t('item.legendaryGold'), effect: 'gold', value: 200, icon: '🥇' },
        { name: t('item.wisdomCrown'), effect: 'allTime', value: 10, icon: '👑' }
      ]
    };
    return itemPool[rarity.id] || itemPool.normal;
  }

  onItemDrop(item, game) {
    const player = game.playerManager.player;

    SoundService.playItemDrop(item.rarity.id);

    switch (item.effect) {
      case 'hp':
        player.currentHp = Math.min(player.maxHp, player.currentHp + item.value);
        break;
      case 'time':
        game.timer += item.value;
        break;
      case 'gold':
        player.gold += item.value;
        game.currentRun.earnedGold += item.value;
        break;
      case 'combo':
        game.combo += item.value;
        break;
      case 'freeHint':
        game.currentRun.freeHints = (game.currentRun.freeHints || 0) + item.value;
        break;
      case 'revive':
        // 버그 수정: 인벤토리에도 부활권 추가
        if (!player.inventory) {
          player.inventory = { reviveTicket: 0, hintTicket: 0, timeBoost: 0, doubleGold: 0 };
        }
        player.inventory.reviveTicket = (player.inventory.reviveTicket || 0) + item.value;
        break;
      case 'goldMulti':
        game.currentRun.goldMultiplier = (game.currentRun.goldMultiplier || 1) * item.value;
        break;
      case 'timeStop':
        game.currentRun.timeStops = (game.currentRun.timeStops || 0) + item.value;
        break;
      case 'allTime':
        game.timer += item.value;
        break;
    }

    // 인벤토리 변경이 있으면 서버에도 저장
    if (['revive', 'gold'].includes(item.effect)) {
      game.playerManager.save();
    }

    this.showItemDropNotification(item);
  }

  showItemDropNotification(item) {
    this.droppedItem = item;
    setTimeout(() => {
      this.droppedItem = null;
    }, 2000);
  }
}
