// 다이얼로그/모달 관리 (showModal, showConfirm, showPrompt, showLevelProgress, showProblemViewer 등)
import { Renderer } from '../canvas/Renderer.js';
import { GAME_CONFIG, LEVEL_CONFIG, COLORS, UPGRADES } from '../utils/constants.js';
import { t } from '../i18n/i18n.js';
import { cleanQuestionText, renderProblemCard } from '../utils/textCleaner.js';

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
    this._lastDismissTime = 0;
  }

  _onDismiss() {
    this._lastDismissTime = Date.now();
  }

  showAnalyzingScreen(apiName = 'AI') {
    Renderer.clear();
    Renderer.drawText(t('analyzing', apiName), 200, 300, { font: 'bold 24px system-ui', color: COLORS.ACCENT_LIGHT, align: 'center' });
    Renderer.drawText(t('analyzingDesc'), 200, 350, { font: '16px system-ui', color: COLORS.TEXT_SECONDARY, align: 'center' });
  }

  showGeneratingScreen(count) {
    Renderer.clear();
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
      document.getElementById('modal-ok-btn').onclick = () => { modal.remove(); this._onDismiss(); resolve(); };
      modal.onclick = (e) => { if (e.target === modal) { modal.remove(); this._onDismiss(); resolve(); } };
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
      document.getElementById('modal-ok-btn').onclick = () => { modal.remove(); this._onDismiss(); resolve(true); };
      document.getElementById('modal-cancel-btn').onclick = () => { modal.remove(); this._onDismiss(); resolve(false); };
      modal.onclick = (e) => { if (e.target === modal) { modal.remove(); this._onDismiss(); resolve(false); } };
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
        this._onDismiss();
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

  // 등록된 문제 보기
  async showProblemViewer() {
    const db = this.game.db;
    const alive = await db.getByIndex('monsters', 'status', 'alive');
    const cleared = await db.getByIndex('monsters', 'status', 'cleared');
    const allMonsters = [...alive, ...cleared].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const existing = document.getElementById('problem-viewer-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'problem-viewer-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:10000;display:flex;flex-direction:column;align-items:center;font-family:system-ui,-apple-system,sans-serif;';

    const renderCards = (filter) => {
      let list = allMonsters;
      if (filter === 'image') list = allMonsters.filter(m => m.imageData);

      if (list.length === 0) {
        return `<div style="text-align:center;color:#94a3b8;padding:40px 0;font-size:15px;">${escapeHtml(t('problemViewerEmpty'))}</div>`;
      }

      return list.map((m) => {
        let imgSrc = m.imageData;
        if (!imgSrc) {
          try { imgSrc = renderProblemCard(m); } catch { imgSrc = ''; }
        }

        const imgHtml = imgSrc
          ? `<img src="${imgSrc}" style="width:100%;border-radius:10px;cursor:pointer;display:block;" onclick="this.classList.toggle('pv-expanded');this.style.maxHeight=this.classList.contains('pv-expanded')?'none':'300px'" />`
          : `<div style="padding:16px;background:rgba(99,102,241,0.1);border-radius:10px;color:#e2e8f0;font-size:15px;line-height:1.6;word-break:keep-all;">${escapeHtml(cleanQuestionText(m.question) || '문제 없음')}</div>`;

        return `<div style="margin-bottom:12px;" data-monster-id="${m.id}">
          ${imgHtml}
          <div style="margin-top:6px;padding:8px 12px;background:rgba(30,30,60,0.8);border-radius:8px;font-size:13px;color:#94a3b8;">${escapeHtml(t('answerLabel'))}: <span style="color:#22c55e;font-weight:bold;">${escapeHtml(m.answer || '?')}</span></div>
        </div>`;
      }).join('');
    };

    const imageCount = allMonsters.filter(m => m.imageData).length;

    modal.innerHTML = `
      <div style="width:100%;max-width:400px;height:100%;display:flex;flex-direction:column;">
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:16px 20px 12px;border-bottom:1px solid rgba(99,102,241,0.3);flex-shrink:0;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:18px;font-weight:bold;color:#e2e8f0;">${escapeHtml(t('problemViewer'))} <span style="font-size:14px;color:#818cf8;">(${allMonsters.length})</span></span>
            <button id="pv-close" style="background:none;border:none;color:#94a3b8;font-size:24px;cursor:pointer;padding:0 4px;">✕</button>
          </div>
          <div style="display:flex;gap:8px;" id="pv-filters">
            <button class="pv-filter-btn active" data-filter="all" style="padding:6px 14px;border-radius:8px;border:1px solid rgba(99,102,241,0.4);background:rgba(99,102,241,0.3);color:#e2e8f0;font-size:13px;cursor:pointer;">${escapeHtml(t('filterAll'))} (${allMonsters.length})</button>
            <button class="pv-filter-btn" data-filter="image" style="padding:6px 14px;border-radius:8px;border:1px solid rgba(99,102,241,0.2);background:transparent;color:#94a3b8;font-size:13px;cursor:pointer;">${escapeHtml(t('filterImage'))} (${imageCount})</button>
          </div>
        </div>
        <div id="pv-list" style="flex:1;overflow-y:auto;padding:12px 16px;-webkit-overflow-scrolling:touch;">
          ${renderCards('all')}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 필터 버튼
    modal.querySelectorAll('.pv-filter-btn').forEach(btn => {
      btn.onclick = () => {
        modal.querySelectorAll('.pv-filter-btn').forEach(b => {
          b.style.background = 'transparent';
          b.style.color = '#94a3b8';
          b.style.borderColor = 'rgba(99,102,241,0.2)';
          b.classList.remove('active');
        });
        btn.style.background = 'rgba(99,102,241,0.3)';
        btn.style.color = '#e2e8f0';
        btn.style.borderColor = 'rgba(99,102,241,0.4)';
        btn.classList.add('active');
        document.getElementById('pv-list').innerHTML = renderCards(btn.dataset.filter);
      };
    });

    document.getElementById('pv-close').onclick = () => { modal.remove(); this._onDismiss(); };
    modal.onclick = (e) => { if (e.target === modal) { modal.remove(); this._onDismiss(); } };

    // 이미지 없는 문제에 대해 Canvas 카드 이미지 자동 생성 후 DB 저장
    const noImageMonsters = allMonsters.filter(m => !m.imageData);
    if (noImageMonsters.length > 0) {
      this._generateImagesInBackground(noImageMonsters, db);
    }
  }

  // 이미지 없는 문제들에 대해 Canvas 카드 이미지 생성 후 DB 저장
  async _generateImagesInBackground(monsters, db) {
    for (const m of monsters) {
      if (!document.getElementById('problem-viewer-modal')) return;
      try {
        const imgData = renderProblemCard(m);
        if (imgData) {
          m.imageData = imgData;
          await db.put('monsters', m);
        }
      } catch { /* 실패 무시 */ }
    }
  }
}
