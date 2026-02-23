// AI 문제 생성 관리 (API 키 설정, 테스트 생성, 메뉴 기반 생성)
import { geminiService } from '../services/GeminiService.js';
import { imageAnalysisService } from '../services/ImageAnalysisService.js';
import { problemGeneratorService } from '../services/ProblemGeneratorService.js';
import { SCREENS } from '../utils/constants.js';
import { t } from '../i18n/i18n.js';
import { renderProblemCard } from '../utils/textCleaner.js';

export class AIGenerateManager {
  constructor(game) {
    this.game = game;
    this._aiGenerating = false;
  }

  _withTimeout(promise, ms = 60000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(t('timeout') || 'Timeout')), ms))
    ]);
  }

  // 생성 완료 후 즉시 메인화면 복귀 + 결과 모달 표시
  _finishAndShowResult(resultMessage) {
    const game = this.game;
    // 1) 생성 상태 해제
    game.isGenerating = false;
    game._needsRender = true;
    game._removeCancelOverlay();
    // 2) 즉시 메인화면 전환
    game.changeScreen(SCREENS.MAIN);
    // 3) 결과 모달은 메인화면 위에 표시 (await 안함 = 화면전환 안 막힘)
    if (resultMessage) {
      game.showModal(resultMessage);
    }
  }

  async promptApiKey() {
    const key = await this.game.showPrompt(t('inputGeminiKey'));
    if (key && key.trim()) {
      geminiService.setApiKey(key.trim());
      await this.game.showModal(t('geminiKeySaved'));
    }
  }

  async promptSmilePrintApiKey() {
    const key = await this.game.showPrompt(t('inputSmilePrintApiKey'));
    if (key && key.trim()) {
      imageAnalysisService.setApiKey(key.trim());
      await this.game.showModal(t('smilePrintKeySaved'));
    }
  }

  async testAIGeneration() {
    if (this._aiGenerating) return;
    this._aiGenerating = true;
    const game = this.game;
    try {
      let resultMessage = null;
      try {
        game._generationCancelled = false;
        game.isGenerating = true;
        game.generatingMessage = t('testGenerating');
        game.generatingSubMessage = '';
        game._needsRender = true;

        const result = await this._withTimeout(geminiService.generateNewProblems(t('defaultTopic'), t('linearEquation'), 3));

        if (!game._generationCancelled && result && result.problems && result.problems.length > 0) {
          let addedCount = 0;
          for (const p of result.problems) {
            const monster = {
              subject: 'math', question: p.question, answer: p.answer,
              choices: p.choices || [], correctIndex: p.correctIndex || 0,
              explanation: p.explanation || '',
              hp: 80 + (p.difficulty || 1) * 20, maxHp: 80 + (p.difficulty || 1) * 20,
              difficulty: p.difficulty || 1, isGenerated: true, createdAt: Date.now(), status: 'alive'
            };
            monster.imageData = renderProblemCard(monster);
            await game.db.add('monsters', monster);
            addedCount++;
          }
          await game.monsterManager.loadMonsters();
          const p = result.problems[0];
          resultMessage = t('testGenerated', addedCount, p.question, p.answer);
        } else if (!game._generationCancelled) {
          resultMessage = t('generateFailed');
        }
      } catch (err) {
        resultMessage = t('error') + err.message;
      }
      // 즉시 메인화면 전환 + 결과 모달 (await 안함)
      this._finishAndShowResult(resultMessage);
    } finally {
      game.isGenerating = false;
      game._removeCancelOverlay();
      this._aiGenerating = false;
    }
  }

  async showAIGenerateMenu() {
    if (this._aiGenerating) return;
    this._aiGenerating = true;
    try {
      await this._doAIGenerateMenu();
    } finally {
      this.game.isGenerating = false;
      this.game._removeCancelOverlay();
      this._aiGenerating = false;
    }
  }

  async _doAIGenerateMenu() {
    const game = this.game;
    const subjectChoice = await game.showPrompt(t('aiGenerateMenu', t('math'), t('science')));
    if (subjectChoice === null) return;
    const subjectIndex = parseInt(subjectChoice);
    if (isNaN(subjectIndex) || subjectIndex < 1 || subjectIndex > 2) {
      await game.showModal(t('invalidInput')); return;
    }
    const subject = subjectIndex === 1 ? 'math' : 'science';
    const subjectName = subjectIndex === 1 ? t('math') : t('science');

    const topics = problemGeneratorService.getTopics(subject);
    const topicKeys = Object.keys(topics);
    const topicList = Object.entries(topics).map(([key, info], i) => `${i + 1}. ${info.name}`).join('\n');

    const topicChoice = await game.showPrompt(t('aiTopicMenu', subjectName, topicList, topicKeys.length));
    if (topicChoice === null) return;
    const topicIndex = parseInt(topicChoice) - 1;
    if (isNaN(topicIndex) || topicIndex < 0 || topicIndex >= topicKeys.length) {
      await game.showModal(t('invalidInput')); return;
    }
    const selectedTopic = topicKeys[topicIndex];

    const difficultyChoice = await game.showPrompt(t('difficultyMenu', topics[selectedTopic].name, t('easy'), t('normal'), t('hard')), '2');
    if (difficultyChoice === null) return;
    const diff = parseInt(difficultyChoice);
    if (isNaN(diff) || diff < 1 || diff > 3) {
      await game.showModal(t('invalidInput')); return;
    }

    const diffName = [t('easy'), t('normal'), t('hard')][diff - 1];
    const countChoice = await game.showPrompt(t('countMenu', topics[selectedTopic].name, diffName), '5');
    if (countChoice === null) return;
    const count = parseInt(countChoice);
    if (isNaN(count) || count < 1 || count > 10) {
      await game.showModal(t('invalidInput')); return;
    }

    let resultMessage = null;
    try {
      game._generationCancelled = false;
      game.isGenerating = true;
      game.generatingMessage = t('generating');
      game.generatingSubMessage = t('generatingDesc', count);
      game._needsRender = true;
      const problems = await this._withTimeout(problemGeneratorService.generateProblems(selectedTopic, diff, count, subject));

      if (!game._generationCancelled && problems && problems.length > 0) {
        let addedCount = 0;
        for (const p of problems) {
          const monster = {
            subject, question: p.question, answer: p.answer,
            answers: p.answers || [p.answer], choices: p.choices || [],
            correctIndex: p.correctIndex || 0, explanation: p.explanation || '',
            topic: p.topic || topics[selectedTopic].name,
            hp: 80 + (p.difficulty || diff) * 20, maxHp: 80 + (p.difficulty || diff) * 20,
            difficulty: p.difficulty || diff, isGenerated: true, createdAt: Date.now(), status: 'alive'
          };
          monster.imageData = renderProblemCard(monster);
          await game.db.add('monsters', monster);
          addedCount++;
        }
        await game.monsterManager.loadMonsters();
        const example = problems[0];
        resultMessage = t('generated', addedCount, topics[selectedTopic].name, diffName, example.question, example.answer);
      } else if (!game._generationCancelled) {
        resultMessage = t('generateFailed');
      }
    } catch (err) {
      console.error('AI 문제 생성 오류:', err);
      resultMessage = t('error') + err.message;
    }
    // 즉시 메인화면 전환 + 결과 모달 (await 안함)
    this._finishAndShowResult(resultMessage);
  }
}
