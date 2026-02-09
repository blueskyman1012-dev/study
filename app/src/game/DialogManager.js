// 다이얼로그/모달 관리 (showModal, showConfirm, showPrompt, showLevelProgress 등)
import { Renderer } from '../canvas/Renderer.js';
import { GAME_CONFIG, LEVEL_CONFIG, COLORS, UPGRADES } from '../utils/constants.js';
import { t } from '../i18n/i18n.js';

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class DialogManager {
  constructor(game) {
    this.game = game;
  }

  showAnalyzingScreen(apiName = 'AI') {
    Renderer.clear(); Renderer.drawGrid();
    Renderer.drawText(t('analyzing', apiName), 200, 300, { font: 'bold 24px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center' });
    Renderer.drawText(t('analyzingDesc'), 200, 350, { font: '16px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  }

  showGeneratingScreen(count) {
    Renderer.clear(); Renderer.drawGrid();
    Renderer.drawText(t('generating'), 200, 280, { font: 'bold 24px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center' });
    Renderer.drawText(t('generatingDesc', count), 200, 330, { font: '16px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
    Renderer.drawText(t('pleaseWait'), 200, 370, { font: '14px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  }

  showModal(message) {
    return new Promise((resolve) => {
      const existing = document.getElementById('custom-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'custom-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

      modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:20px;width:320px;max-height:80vh;overflow-y:auto;color:#e2e8f0;border:1px solid #6366f1;">
          <div style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin-bottom:16px;">${escapeHtml(message)}</div>
          <button id="modal-ok-btn" style="width:100%;padding:12px;border:none;border-radius:10px;background:#6366f1;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('close')}</button>
        </div>
      `;

      document.body.appendChild(modal);
      document.getElementById('modal-ok-btn').onclick = () => { modal.remove(); resolve(); };
      modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(); } };
    });
  }

  showQuestionModal(question, topic, choices) {
    return new Promise((resolve) => {
      const existing = document.getElementById('custom-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'custom-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;justify-content:center;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

      const topicHtml = topic ? `<div style="font-size:12px;color:#94a3b8;margin-bottom:10px;">📌 ${escapeHtml(topic)}</div>` : '';
      let choicesHtml = '';
      if (choices.length > 0) {
        const choiceItems = choices.map((c, i) =>
          `<div style="padding:10px 14px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:10px;font-size:16px;line-height:1.5;color:#e2e8f0;"><span style="color:#818cf8;font-weight:bold;margin-right:8px;">${i + 1}.</span>${escapeHtml(String(c))}</div>`
        ).join('');
        choicesHtml = `<div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);">${choiceItems}</div>`;
      }

      modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:24px;width:340px;max-height:85vh;overflow-y:auto;color:#e2e8f0;border:1px solid #6366f1;">
          <div style="font-size:12px;font-weight:bold;color:#818cf8;margin-bottom:12px;text-align:center;">🔍 ${escapeHtml(t('questionLabel'))}</div>
          ${topicHtml}
          <div style="font-size:20px;font-weight:bold;line-height:1.6;word-break:keep-all;overflow-wrap:break-word;">${escapeHtml(question)}</div>
          ${choicesHtml}
          <button id="modal-ok-btn" style="width:100%;padding:12px;border:none;border-radius:10px;background:#6366f1;color:white;font-size:16px;font-weight:bold;cursor:pointer;margin-top:16px;">${t('close')}</button>
        </div>
      `;

      document.body.appendChild(modal);
      document.getElementById('modal-ok-btn').onclick = () => { modal.remove(); resolve(); };
      modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(); } };
    });
  }

  showConfirm(message) {
    return new Promise((resolve) => {
      const existing = document.getElementById('custom-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'custom-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

      modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:20px;width:320px;max-height:80vh;overflow-y:auto;color:#e2e8f0;border:1px solid #6366f1;">
          <div style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin-bottom:16px;">${escapeHtml(message)}</div>
          <div style="display:flex;gap:10px;">
            <button id="modal-cancel-btn" style="flex:1;padding:12px;border:none;border-radius:10px;background:#374151;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('cancel') || '취소'}</button>
            <button id="modal-ok-btn" style="flex:1;padding:12px;border:none;border-radius:10px;background:#6366f1;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('confirm') || '확인'}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      document.getElementById('modal-ok-btn').onclick = () => { modal.remove(); resolve(true); };
      document.getElementById('modal-cancel-btn').onclick = () => { modal.remove(); resolve(false); };
      modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
    });
  }

  showPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
      const existing = document.getElementById('custom-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'custom-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;justify-content:center;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

      modal.innerHTML = `
        <div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 100%);border-radius:16px;padding:20px;width:320px;max-height:80vh;overflow-y:auto;color:#e2e8f0;border:1px solid #6366f1;">
          <div style="white-space:pre-wrap;font-size:15px;line-height:1.6;margin-bottom:12px;">${escapeHtml(message)}</div>
          <input id="modal-input" type="text" value="${escapeHtml(defaultValue)}" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid #4b5563;border-radius:8px;background:#0f172a;color:#e2e8f0;font-size:15px;margin-bottom:12px;">
          <div style="display:flex;gap:10px;">
            <button id="modal-cancel-btn" style="flex:1;padding:12px;border:none;border-radius:10px;background:#374151;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('cancel') || '취소'}</button>
            <button id="modal-ok-btn" style="flex:1;padding:12px;border:none;border-radius:10px;background:#6366f1;color:white;font-size:16px;font-weight:bold;cursor:pointer;">${t('confirm') || '확인'}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const input = document.getElementById('modal-input');
      const modalContent = modal.firstElementChild;

      setTimeout(() => {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);

      const adjustForKeyboard = () => {
        if (window.visualViewport) {
          const vpHeight = window.visualViewport.height;
          modalContent.style.maxHeight = `${vpHeight * 0.7}px`;
          modal.style.alignItems = 'flex-start';
          modal.style.paddingTop = `${Math.max(20, (vpHeight - modalContent.offsetHeight) / 3)}px`;
        }
      };
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', adjustForKeyboard);
      }

      const cleanup = (value) => {
        if (window.visualViewport) {
          window.visualViewport.removeEventListener('resize', adjustForKeyboard);
        }
        modal.remove();
        resolve(value);
      };

      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') cleanup(input.value); });
      document.getElementById('modal-ok-btn').onclick = () => cleanup(input.value);
      document.getElementById('modal-cancel-btn').onclick = () => cleanup(null);
      modal.onclick = (e) => { if (e.target === modal) cleanup(null); };
    });
  }

  showLevelProgress() {
    const pm = this.game.playerManager;
    const player = pm.player;
    const level = player.level;
    const currentExp = player.exp;
    const expForCurrentLevel = pm.getExpForLevel(level);
    const progress = pm.getLevelProgress();
    const progressPercent = Math.round(progress * 100);

    const hpBonus = pm.getLevelBonusHp();
    const damageBonus = pm.getLevelBonusDamage();
    const timeBonus = pm.getLevelBonusTime();

    const totalHp = pm.getTotalMaxHp();
    const totalDamage = pm.getTotalDamage();
    const totalTime = pm.getTotalTime(this.game.currentMonster?.difficulty);

    const nextDamageLevel = Math.ceil(level / LEVEL_CONFIG.damageLevelInterval) * LEVEL_CONFIG.damageLevelInterval + 1;
    const nextTimeLevel = Math.ceil(level / LEVEL_CONFIG.timeLevelInterval) * LEVEL_CONFIG.timeLevelInterval + 1;

    const existingModal = document.getElementById('level-modal');
    if (existingModal) existingModal.remove();

    let hpDetail = `${t('base')} ${GAME_CONFIG.DEFAULT_HP}`;
    if (hpBonus > 0) hpDetail += ` + ${t('level')} ${hpBonus}`;
    if (player.permanentUpgrades?.hp > 0) hpDetail += ` + ${t('upgrade')} ${player.permanentUpgrades.hp * UPGRADES.hp.value}`;

    let dmgDetail = `${t('base')} ${GAME_CONFIG.DEFAULT_DAMAGE}`;
    if (damageBonus > 0) dmgDetail += ` + ${t('level')} ${damageBonus}`;
    if (player.permanentUpgrades?.damage > 0) dmgDetail += ` + ${t('upgrade')} ${player.permanentUpgrades.damage * UPGRADES.damage.value}`;

    let timeDetail = `${t('base')} ${GAME_CONFIG.DEFAULT_TIME}`;
    if (timeBonus > 0) timeDetail += ` + ${t('level')} ${timeBonus}`;
    if (player.permanentUpgrades?.time > 0) timeDetail += ` + ${t('upgrade')} ${player.permanentUpgrades.time * UPGRADES.time.value}`;

    const goldBonusLevel = player.permanentUpgrades?.goldBonus || 0;
    const goldBonusPercent = goldBonusLevel * UPGRADES.goldBonus.value;
    const goldMultiplier = 100 + goldBonusPercent;
    let goldDetail = `${t('base')} 100%`;
    if (goldBonusPercent > 0) goldDetail += ` + ${t('upgrade')} ${goldBonusPercent}%`;

    const modal = document.createElement('div');
    modal.id = 'level-modal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; justify-content: center; align-items: center; font-family: system-ui, -apple-system, sans-serif;`;

    modal.innerHTML = `
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 16px; padding: 20px; width: 340px; max-height: 80vh; overflow-y: auto; color: #e2e8f0; border: 1px solid #6366f1;">
        <h2 style="margin: 0 0 15px; text-align: center; color: #818cf8;">${t('levelProgress')}</h2>
        <div style="background: rgba(99,102,241,0.15); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 24px; font-weight: bold; color: #818cf8;">LV.${level}</span>
            <span style="color: #94a3b8;">/ ${LEVEL_CONFIG.displayMaxLevel}</span>
          </div>
          <div style="background: #0a0a0f; border-radius: 8px; height: 20px; overflow: hidden;">
            <div style="background: linear-gradient(90deg, #6366f1, #818cf8); height: 100%; width: ${progressPercent}%;"></div>
          </div>
          <div style="text-align: center; margin-top: 5px; font-size: 13px; color: #94a3b8;">${currentExp} / ${expForCurrentLevel} EXP (${progressPercent}%)</div>
        </div>
        <div style="background: rgba(34,197,94,0.1); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #22c55e;">${t('currentStats')}</div>
          <div style="font-size: 13px; line-height: 1.8;">
            <div>❤️ HP: <b>${totalHp}</b> <span style="color:#94a3b8; font-size:11px;">(${hpDetail})</span></div>
            <div>⚔️ ${t('attack')}: <b>${totalDamage}</b> <span style="color:#94a3b8; font-size:11px;">(${dmgDetail})</span></div>
            <div>⏱️ ${t('time')}: <b>${totalTime}${t('seconds')}</b> <span style="color:#94a3b8; font-size:11px;">(${timeDetail})</span></div>
            <div>💰 ${t('stats_gold')}: <b>${goldMultiplier}%</b> <span style="color:#94a3b8; font-size:11px;">(${goldDetail})</span></div>
          </div>
        </div>
        <div style="background: rgba(251,191,36,0.1); border-radius: 10px; padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #fbbf24;">${t('nextBonus')}</div>
          <div style="font-size: 13px; line-height: 1.8;">
            ${level >= LEVEL_CONFIG.maxLevel
              ? `<div style="color:#fbbf24;font-weight:bold;">${t('maxLevelBonus')}</div>`
              : `<div>${t('level')} ${level + 1}: ❤️ HP +1</div>
            ${nextDamageLevel <= LEVEL_CONFIG.displayMaxLevel ? `<div>${t('level')} ${nextDamageLevel}: ⚔️ ${t('attack')} +${LEVEL_CONFIG.damagePerLevels}</div>` : ''}
            ${nextTimeLevel <= LEVEL_CONFIG.displayMaxLevel ? `<div>${t('level')} ${nextTimeLevel}: ⏱️ ${t('time')} +${LEVEL_CONFIG.timePerLevels}${t('seconds')}</div>` : ''}`}
          </div>
        </div>
        <div style="background: rgba(99,102,241,0.1); border-radius: 10px; padding: 12px; margin-bottom: 15px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #818cf8;">${t('expGain')}</div>
          <div style="font-size: 13px; line-height: 1.8;">
            <div>${t('correctAnswer')}: <b>+${LEVEL_CONFIG.expPerCorrect}</b> EXP</div>
            <div>${t('monsterKill')}: <b>+${LEVEL_CONFIG.expPerMonsterKill}</b> EXP</div>
            <div>${t('normalBossLabel')} 👹: <b>+${LEVEL_CONFIG.expPerNormalBoss}</b> EXP</div>
            <div>${t('midBossLabel')} 👿: <b>+${LEVEL_CONFIG.expPerMidBoss}</b> EXP</div>
            <div>${t('finalBossLabel')} 🐉: <b>+${LEVEL_CONFIG.expPerFinalBoss}</b> EXP</div>
          </div>
        </div>
        <button id="close-level-modal" style="width: 100%; padding: 12px; border: none; border-radius: 10px; background: #6366f1; color: white; font-size: 16px; font-weight: bold; cursor: pointer;">${t('close')}</button>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('close-level-modal').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  }
}
