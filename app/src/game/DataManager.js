// 데이터 관리 (초기화, 내보내기, 불러오기)
import { SCREENS } from '../utils/constants.js';
import { safeRemoveItem } from '../utils/storage.js';
import { apiService } from '../services/ApiService.js';
import { t } from '../i18n/i18n.js';

export class DataManager {
  constructor(game) {
    this.game = game;
  }

  get db() { return this.game.db; }

  async resetAllProblems() {
    const game = this.game;
    const monsters = game.monsterManager.monsters;
    if (monsters.length === 0) { await game.showModal(t('noProblemsToReset')); return; }

    if (!await game.showConfirm(t('confirmReset', monsters.length))) return;
    if (!await game.showConfirm(t('confirmResetFinal', monsters.length))) return;

    try {
      for (const monster of monsters) { await this.db.delete('monsters', monster.id); }
      game.monsterManager.monsters = [];
      await game.showModal(t('resetDone', monsters.length));
      game.render();
    } catch (error) {
      console.error('문제 초기화 오류:', error);
      await game.showModal(t('resetError'));
    }
  }

  async resetAccount() {
    const game = this.game;
    if (!await game.showConfirm(t('confirmAccountReset'))) return;
    if (!await game.showConfirm(t('confirmAccountResetFinal'))) return;

    try {
      await this.db.clear('runs');
      await this.db.clear('items');
      const newPlayer = game.playerManager.createNewPlayer();
      await this.db.put('player', newPlayer);
      game.playerManager.player = newPlayer;
      game.playerManager.player.maxHp = game.playerManager.getTotalMaxHp();
      game.playerManager.player.currentHp = game.playerManager.player.maxHp;
      game.achievementManager.initDailyMissions();
      if (apiService.isLoggedIn()) {
        apiService.putPlayer(newPlayer).catch(e => console.warn('서버 동기화 실패:', e.message));
      }
      safeRemoveItem('guide_shown');

      await game.showModal(t('accountResetDone'));
      game.changeScreen(SCREENS.MAIN);
    } catch (error) {
      console.error('계정 초기화 오류:', error);
      await game.showModal(t('accountResetError'));
    }
  }

  async exportProblems() {
    const game = this.game;
    const monsters = game.monsterManager.monsters;
    if (monsters.length === 0) { await game.showModal(t('noExportData')); return; }

    try {
      const exportData = monsters.map(m => ({
        question: m.question, answer: m.answer, answers: m.answers,
        choices: m.choices, correctIndex: m.correctIndex, explanation: m.explanation,
        topic: m.topic, difficulty: m.difficulty, keywords: m.keywords,
        subject: m.subject, questionType: m.questionType, formula: m.formula
      }));

      const dataStr = JSON.stringify({ version: '1.0', exportDate: new Date().toISOString(), count: exportData.length, problems: exportData }, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('exportFilename')}_${new Date().toISOString().slice(0, 10)}_${exportData.length}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await game.showModal(t('exported', exportData.length));
    } catch (error) {
      console.error('내보내기 오류:', error);
      await game.showModal(t('exportError'));
    }
  }

  importProblems() {
    const game = this.game;
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.problems || !Array.isArray(data.problems)) { await game.showModal(t('invalidFile')); return; }
        if (data.problems.length === 0) { await game.showModal(t('noImportData')); return; }
        if (!await game.showConfirm(t('confirmImport', data.problems.length))) return;

        let addedCount = 0;
        for (const problem of data.problems) {
          if (!problem.question) continue;
          const monster = {
            id: Date.now() + Math.random(), subject: problem.subject || 'math',
            createdAt: Date.now(), status: 'alive', question: problem.question,
            answer: problem.answer || '', answers: problem.answers || [problem.answer],
            choices: problem.choices || [], correctIndex: problem.correctIndex || 0,
            explanation: problem.explanation || '', topic: problem.topic || '',
            difficulty: problem.difficulty || 2, keywords: problem.keywords || [],
            questionType: problem.questionType || t('multipleChoice'), formula: problem.formula || '',
            hp: 100, maxHp: 100
          };
          await this.db.add('monsters', monster);
          game.monsterManager.monsters.push(monster);
          addedCount++;
        }
        await game.showModal(t('imported', addedCount));
        game.render();
      } catch (error) {
        console.error('불러오기 오류:', error);
        await game.showModal(t('importError'));
      }
    };
    input.click();
  }
}
